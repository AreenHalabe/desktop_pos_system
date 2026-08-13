import { pool, sql } from "../DataBaseConnections/dbconnection.js";
import { checkToken, SystemError } from "../shared/functionality.js";
import { z } from "zod";


export const createInvoiceFromSupplier = async (req, res) => {
    const supplierId = Number(req.query.supplier_id);
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;
    try {

        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        await checkToken(token);

        const invData = req.body;
        const parsedData = invoiceSchema.parse(invData);

        if (invData.discount > invData.totalPrice) {
            throw new SystemError("قيمه الخصم اكبر من السعر الأساسي", 400);
        }

        await transaction.begin();
        transactionStarted = true;

        const invoiceId = await createPayInvoice(supplierId, parsedData, transaction);



        const [_, stockBatches] = await Promise.all([
            addInvoiceItems(invoiceId, parsedData.items, transaction),
            getStockBatchesByIds(parsedData.items)
        ]);


        await updateStockBatches(parsedData.items, stockBatches, transaction);

        await transaction.commit();

        return res.status(200).json({
            success: true,
            invoice_number : invoiceId,
            message: "تم إنشاء الفاتورة",
        });



    } catch (e) {
        if (transactionStarted) {
            try {
                await transaction.rollback();
            } catch (err) {
                console.error(err);
            }
        }
        const validationErrors = e?.errors || e?.issues;

        if (Array.isArray(validationErrors) && validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: validationErrors[0].message
            });
        }
        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}



async function createPayInvoice(supplierId, parsedData, transaction) {
    const currentTimeStamp = new Date();
    const result = await transaction.request()
        .input("supplier_id", sql.Int, supplierId)
        .input("total_price", sql.Decimal(18, 2), parsedData.totalPrice)
        .input("paied", sql.Decimal(18, 2), 0)
        .input("remaining", sql.Decimal(18, 2), parsedData.totalPrice)
        .input("created_at", sql.DateTime, currentTimeStamp)
        .input("discount", sql.Decimal(9, 2), parsedData.discount)
        .query(`
            INSERT INTO supplier_invoices (supplier_id, total_price, paied, remaining, created_at, discount)
            VALUES (@supplier_id, @total_price, @paied, @remaining, @created_at, @discount);
        `);
    const invoiceId = result.recordset[0].id;

    return invoiceId;
}

async function addInvoiceItems(invoiceId, items, transaction) {
    const request = transaction.request();

    request.input("invoiceId", sql.Int, invoiceId);

    const values = items.map((item, index) => {
        request.input(`itemId${index}`, sql.Int, item.id);
        request.input(`name${index}`, sql.NVarChar, item.name);
        request.input(`quantity${index}`, sql.Int, item.qty);
        request.input(`costPrice${index}`, sql.Decimal(9, 2), item.cost_price);

        return `(
            @invoiceId,
            @itemId${index},
            @name${index},
            @quantity${index},
            @costPrice${index}
        )`;
    });


    await request.query(`
        INSERT INTO invoice_items
            (invoice_id, item_id, name, quantity, cost_price)
        VALUES
            ${values.join(",\n")}
    `);

}


async function getStockBatchesByIds(items) {

    const ids = items.map(item => item.id);

    const request = pool.request();

    const params = ids.map((id, index) => {
        request.input(`id${index}`, sql.Int, id);
        return `@id${index}`;
    });

    const result = await request.query(`
        SELECT *
        FROM stock_batches
        WHERE item_id IN (${params.join(", ")})
        ORDER BY item_id ASC
    `);

    const batches = result.recordset;


    const batchMap = new Map();

    for (const batch of batches) {
        const key = `${batch.item_id}_${batch.cost_price}`;
        batchMap.set(key, batch);
    }

    return batchMap;
}





async function updateStockBatches(items, stockBatches, transaction) {
    const updates = [];
    const inserts = [];
    const currentTimeStamp = new Date();

    // 1. تحديد الـ UPDATE والـ INSERT
    for (const item of items) {
        const key = `${item.id}_${item.cost_price}`;
        const batch = stockBatches.get(key);

        if (batch) {
            updates.push({
                item_id: batch.id,
                quantity: batch.quantity + item.qty,
                remaining_qty: batch.remaining_qty + item.qty
            });
        } else {
            inserts.push({
                item_id: item.id,
                quantity: item.qty,
                remaining_qty: item.qty,
                cost_price: item.cost_price,
                created_at: currentTimeStamp
            });
        }
    }

    await runInsertInvoiceStatment(inserts, transaction),
    await runUpdateInvoiceStatment(updates, transaction)

}

async function runUpdateInvoiceStatment(statment, transaction) {
    if (!statment || statment.length === 0) return;

    const request = transaction.request();

    const values = statment.map((update, index) => {
        request.input(`item_id${index}`, sql.Int, update.item_id);
        request.input(`quantity${index}`, sql.Int, update.quantity);
        request.input(
            `remaining_qty${index}`,
            sql.Int,
            update.remaining_qty
        );

        return `(@id${index}, @quantity${index}, @remaining_qty${index})`;
    });

    await request.query(`
        UPDATE sb
        SET
            sb.quantity = v.quantity,
            sb.remaining_qty = v.remaining_qty
        FROM stock_batches sb
        INNER JOIN (
            VALUES
                ${values.join(",")}
        ) v(id, quantity, remaining_qty)
            ON sb.item_id = v.item_id
    `);
}

async function runInsertInvoiceStatment(statment, transaction) {
    if (!statment || statment.length === 0) return;

    const request = transaction.request();

    const values = statment.map((insert, index) => {
        request.input(`item_id${index}`, sql.Int, insert.item_id);
        request.input(
            `quantity${index}`,
            sql.Int,
            insert.quantity
        );
        request.input(
            `remaining_qty${index}`,
            sql.Int,
            insert.remaining_qty
        );
        request.input(
            `cost_price${index}`,
            sql.Decimal(18, 2),
            insert.cost_price
        );
        request.input(`created_at${index}`, sql.DateTime, insert.created_at);

        return `(
            @item_id${index},
            @quantity${index},
            @remaining_qty${index},
            @cost_price${index},
            @created_at${index}
        )`;
    });

    await request.query(`
        INSERT INTO stock_batches
            (item_id, quantity, remaining_qty, cost_price, created_at)
        VALUES
            ${values.join(",")}
    `);
}





const invoiceSchema = z.object({
    totalPrice: z.preprocess(
        val => Number(val),  // يحول أي شيء إلى Number
        z.number().positive("القيمة يجب أن تكون رقمًا موجبًا")
    ),

    discount: z.preprocess(
        val => Number(val),
        z.number().nonnegative("القيمة الخصم يجب أن تكون صفر أو رقمًا موجبًا")
    ),

    items: z.array(
        z.object({
            cost_price: z.preprocess(
                val => Number(val),
                z.number().positive("سعر التكلفة يجب أن يكون رقمًا موجبًا")
            ),

            qty: z.preprocess(
                val => Number(val),
                z.number().int().positive("الكمية يجب أن تكون رقمًا صحيحًا أكبر من صفر")
            ),

            id: z.preprocess(
                val => Number(val),
                z.number().int("معرف المنتج يجب أن يكون رقمًا صحيحًا")
            )
        })
    )
});
