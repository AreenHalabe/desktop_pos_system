import { pool, sql } from "../DataBaseConnections/dbconnection.js";
import { checkToken, SystemError } from "../shared/functionality.js";
import { z } from "zod";


export const createInvoiceFromSupplier = async (req, res) => {
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

        const invoiceId = await createPayInvoice(parsedData, transaction);

        await addInvoiceItems(invoiceId, parsedData.items, transaction);


          const {
            updateStockBatchs,
            addNewStockBatchs,
            updateItemsStock
        } = await prepareStockBatches(parsedData.items);

        await updateStockBatches(updateStockBatchs, transaction);
        await addNewStockBatches(addNewStockBatchs, transaction);
        await updateStockItems(updateItemsStock, transaction);

        await transaction.commit();

        return res.status(200).json({
            success: true,
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



async function createPayInvoice(parsedData, transaction) {
    const totalPrice = parsedData.total_price - parsedData.discount;
    const currentTimeStamp = new Date();
    
    const result = await transaction.request()
        .input("supplier_id", sql.Int, parsedData.supplier_id)
        .input("total_price", sql.Decimal(18, 2), totalPrice)
        .input("remaining", sql.Decimal(18, 2), totalPrice)
        .input("created_at", sql.DateTime, currentTimeStamp)
        .input("discount", sql.Decimal(15, 2), parsedData.discount)
        .query(`
            INSERT INTO supplier_invoices (supplier_id, total_price, remaining, created_at, discount)
            OUTPUT INSERTED.id
            VALUES (@supplier_id, @total_price, @remaining, @created_at, @discount);
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
        request.input(`quantity${index}`, sql.Decimal(12, 2), item.qty);
        request.input(`costPrice${index}`, sql.Decimal(12, 2), item.cost_price);
        request.input(`unit${index}`, sql.NVarChar, item.unit_name);

        return `(
            @invoiceId,
            @itemId${index},
            @name${index},
            @quantity${index},
            @costPrice${index},
            @unit${index}
        )`;
    });


    await request.query(`
        INSERT INTO item_invoices
            (invoice_id, item_id, name, quantity, cost_price, unit)
        VALUES
            ${values.join(",\n")}
    `);

}



async function updateStockBatches(updateStockBatchs, transaction) {

    if (updateStockBatchs.length === 0) {
        return;
    }

    const request = transaction.request();

    const values = updateStockBatchs.map((batch, index) => {

        request.input(`batchId${index}`, sql.Int, batch.id);
        request.input(
            `quantity${index}`,
            sql.Decimal(18, 2),
            batch.quantity
        );
        request.input(
            `remainingQty${index}`,
            sql.Decimal(18, 2),
            batch.remaining_qty
        );

        return `(
            @batchId${index},
            @quantity${index},
            @remainingQty${index}
        )`;
    });

    await request.query(`
        UPDATE sb
        SET
            sb.quantity = sb.quantity + v.quantity,
            sb.remaining_qty = sb.remaining_qty + v.remaining_qty
        FROM stock_batches sb
        INNER JOIN (
            VALUES
                ${values.join(",\n")}
        ) AS v(id, quantity, remaining_qty)
            ON v.id = sb.id
    `);
}


async function addNewStockBatches(addNewStockBatchs, transaction) {

    if (addNewStockBatchs.length === 0) {
        return;
    }

    const request = transaction.request();

    const values = addNewStockBatchs.map((batch, index) => {

        request.input(`itemId${index}`, sql.Int, batch.item_id);
        request.input(
            `quantity${index}`,
            sql.Decimal(18, 2),
            batch.quantity
        );
        request.input(
            `remainingQty${index}`,
            sql.Decimal(18, 2),
            batch.remaining_qty
        );
        request.input(
            `costPrice${index}`,
            sql.Decimal(18, 3),
            batch.cost_price
        );

        return `(
            @itemId${index},
            @quantity${index},
            @remainingQty${index},
            @costPrice${index}
        )`;
    });

    await request.query(`
        INSERT INTO stock_batches
        (
            item_id,
            quantity,
            remaining_qty,
            cost_price
        )
        VALUES
            ${values.join(",\n")}
    `);
}




async function updateStockItems(updateItemsStock, transaction) {

    if (updateItemsStock.length === 0) {
        return;
    }

    const request = transaction.request();

    const values = updateItemsStock.map((item, index) => {
        request.input(
            `item_id${index}`,
            sql.Int,
            item.item_id
        );

        request.input(
            `quantity${index}`,
            sql.Decimal(18, 2),
            item.new_stock
        );

        return `(
            @item_id${index},
            @quantity${index}
        )`;
    });

    await request.query(`
        UPDATE i
        SET
            i.stock = i.stock + v.new_stock
        FROM items i
        INNER JOIN (
            VALUES
                ${values.join(",\n")}
        ) AS v(id, new_stock)
            ON v.id = i.id
    `);
}






async function prepareStockBatches(items) {
    const updateStockBatchs = [];
    const addNewStockBatchs = [];
    const updateItemsStock = [];
    for (const item of items) {

        const itemId = item.id;
        const unitId = item.unit_id;

        const [unitResult, batchesResult] = await Promise.all([
            pool
                .request()
                .input("unitId", sql.Int, unitId)
                .query(`
                    SELECT conversion_factor
                    FROM items_units
                    WHERE id = @unitId
                `),

            pool
                .request()
                .input("itemId", sql.Int, itemId)
                .query(`
                    SELECT 
                        id,
                        cost_price
                    FROM stock_batches
                    WHERE item_id = @itemId
                    ORDER BY id ASC
                `)
        ]);

        

        const conversionFactor = Number(unitResult.recordset[0].conversion_factor);
        // سعر التكلفة للقطعة
        const costPricePerPiece = Number(item.cost_price / conversionFactor).toFixed(3);
        // الكمية بالقطع
        const quantityInPieces = item.qty * conversionFactor;


        const batches = batchesResult.recordset;
        
        // آخر batch
        const lastBatch = batches[batches.length - 1];

        
        // نفس سعر التكلفة -> تعديل آخر batch
        if (Number(lastBatch.cost_price).toFixed(3) === costPricePerPiece) {
            updateStockBatchs.push({
                id: lastBatch.id,
                quantity: quantityInPieces,
                remaining_qty: quantityInPieces
            });
        } else {
            addNewStockBatchs.push({
                item_id: itemId,
                quantity: quantityInPieces,
                remaining_qty: quantityInPieces,
                cost_price: costPricePerPiece
            });
        }

        updateItemsStock.push({
            item_id : itemId,
            new_stock : quantityInPieces
        });
    }

    return {
        updateStockBatchs,
        addNewStockBatchs,
        updateItemsStock
    };
};








const invoiceSchema = z.object({

    supplier_id: z.preprocess(
        val => Number(val),
        z.number().int("يجب إختيار المورد")
    ),

    total_price: z.preprocess(
        val => Number(val),  // يحول أي شيء إلى Number
        z.number().positive("القيمة يجب أن تكون رقمًا موجبًا")
    ),

    discount: z.preprocess(
        val => Number(val),
        z.number().nonnegative("القيمة الخصم يجب أن تكون صفر أو رقمًا موجبًا")
    ),

    items: z.array(
        z.object({
            id: z.preprocess(
                val => Number(val),
                z.number().int("معرف المنتج يجب أن يكون رقمًا صحيحًا")
            ),
            
            unit_id: z.preprocess(
                val => Number(val),
                z.number().int("يجب إختيار الوِحدة الشرائية لجميع الأصناف")
            ),

            name: z.string()
                .trim()
                .min(1, "اسم الصنف يجب أن يحتوي على حرف على الأقل"),

            unit_name: z.string()
                .trim()
                .min(1, "اسم وِحدة الشراء يجب أن يحتوي على حرف على الأقل"),

            cost_price: z.preprocess(
                val => Number(val),
                z.number().positive("سعر التكلفة يجب أن يكون رقمًا موجبًا")
            ),

            qty: z.preprocess(
                val => Number(val),
                z.number().positive("الكمية يجب أن تكون رقمًا أكبر من صفر")
            ),
        })
    )
});
