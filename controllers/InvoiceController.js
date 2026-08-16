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

        if (invData.discount > invData.total_price) {
            throw new SystemError("قيمه الخصم اكبر من السعر الأساسي", 400);
        }

        await transaction.begin();
        transactionStarted = true;
        const totalPrice = parsedData.total_price - parsedData.discount;

        const invoiceId = await createPayInvoice(supplierId, parsedData, totalPrice, transaction);

        await addInvoiceItems(invoiceId, parsedData.items, transaction);
        await updateBalanceForSupplier(supplierId, totalPrice, true, transaction);
        await insertItemsForSupplier(supplierId, parsedData.items, transaction);


        await transaction.commit();

        return res.status(200).json({
            success: true,
            invoice_number: invoiceId,
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

export const payIncoice = async (req, res) => {
    const supplierId = Number(req.query.supplier_id);
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;
    try {

        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        await checkToken(token);

        const paymentData = req.body;
        const parsedData = paymentSchema.parse(paymentData);
        const supplier = await getSupplier(supplierId);

        if (parsedData.amount > supplier.balance) {
            throw new SystemError("خطأ : قيمة الدُفعة أكبر من مستحقات المُورد", 400);
        }


        await transaction.begin();
        transactionStarted = true;

        await payment(supplierId, parsedData.amount, transaction);
        await updateBalanceForSupplier(supplierId, parsedData.amount, false, transaction);
        await savePaymentData(supplierId, paymentData, transaction);
        await transaction.commit();

        return res.status(200).json({
            success: true,
            message: "تم تسديد الدُفعة",
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


export const deleteInvoice = async (req , res)=>{
    const invoiceId = Number(req.query.invoice_id);
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        await checkToken(token);

        const invoice = await getInvoices(invoiceId);

        if(invoice.total_price == invoice.remaining){
            await transaction.begin();
            transactionStarted = true;

            await transaction.request()
                .input('id', sql.Int, invoiceId)
                .query(`
                    DELETE FROM supplier_invoices WHERE id = @id
                `)
            ;

            await updateBalanceForSupplier(invoice.supplier_id, invoice.total_price, false, transaction);

            await transaction.commit();
        }
        else{
            throw new SystemError("لا يمكن حذف هذه الفاتورة, بسبب وجود دفعات مسجلة عليها", 400);
        }

        return res.status(200).json({
            success: true,
            message: "تم حذف الفاتورة",
        });
    
    } catch (e) {
        if (transactionStarted) {
            try {
                await transaction.rollback();
            } catch (err) {
                console.error(err);
            }
        }

        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}

async function createPayInvoice(supplierId, parsedData, totalPrice, transaction) {
    const currentTimeStamp = new Date();
    const result = await transaction.request()
        .input("supplier_id", sql.Int, supplierId)
        .input("total_price", sql.Decimal(18, 2), totalPrice)
        .input("remaining", sql.Decimal(18, 2), totalPrice)
        .input("created_at", sql.DateTime, currentTimeStamp)
        .input("discount", sql.Decimal(9, 2), parsedData.discount)
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
        request.input(`name${index}`, sql.NVarChar, item.name);
        request.input(`quantity${index}`, sql.Int, item.qty);
        request.input(`costPrice${index}`, sql.Decimal(9, 2), item.cost_price);

        return `(
            @invoiceId,
            @name${index},
            @quantity${index},
            @costPrice${index}
        )`;
    });


    await request.query(`
        INSERT INTO invoice_items
            (invoice_id, name, quantity, cost_price)
        VALUES
            ${values.join(",\n")}
    `);

}

async function updateBalanceForSupplier(supplierId, totalPrice, isAdd, transaction) {
    await transaction.request()
        .input("supplier_id", sql.Int, supplierId)
        .input("total_price", sql.Decimal(18, 2), totalPrice)
        .input("is_add", sql.Bit, isAdd)
        .query(`
            UPDATE suppliers
            SET balance =
                CASE
                    WHEN @is_add = 1
                        THEN balance + @total_price
                    ELSE
                        balance - @total_price
                END
            WHERE id = @supplier_id
        `)
    ;
}

async function insertItemsForSupplier(supplierId, items, transaction) {

    if (!items?.length) return;

    const request = transaction.request();

    request.input("supplierId", sql.Int, supplierId);

    const params = items.map((item, index) => {
        request.input(
            `name${index}`,
            sql.NVarChar(100),
            item.name
        );

        return `(@supplierId, @name${index})`;
    });

    const query = `
        INSERT INTO supplier_items (supplier_id, name)
        VALUES ${params.join(", ")}
    `;

    await request.query(query);
}

async function getSupplier(supplierId) {
    const result = await pool.request()
        .input('supplier_id', sql.Int, supplierId)
        .query(`
            SELECT * 
            FROM suppliers
            WHERE id = @supplier_id
        `)
        ;

    return result.recordset[0];
}

async function payment(supplierId, amount, transaction) {

    const request = transaction.request();

    request.input("supplierId", sql.Int, supplierId);
    request.input("amount", sql.Decimal(18, 2), amount);

    await request.query(`
        WITH InvoiceData AS
        (
            SELECT
                id,
                remaining,

                SUM(remaining) OVER (
                    ORDER BY id ASC
                    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                ) AS cumulative_remaining

            FROM supplier_invoices WITH (UPDLOCK, HOLDLOCK)

            WHERE supplier_id = @supplierId
              AND remaining > 0
        ),

        PaymentData AS
        (
            SELECT
                id,

                CASE
                    WHEN cumulative_remaining <= @amount
                        THEN remaining

                    WHEN cumulative_remaining - remaining < @amount
                        THEN @amount - (cumulative_remaining - remaining)

                    ELSE 0
                END AS payment

            FROM InvoiceData
        )

        UPDATE si
        SET si.remaining = si.remaining - p.payment

        FROM supplier_invoices si

        INNER JOIN PaymentData p
            ON p.id = si.id

        WHERE p.payment > 0;
    `);
}

async function savePaymentData(supplierId , paymentData, transaction) {
    const currentTimeStamp = new Date();
    await transaction.request()
        .input('supplier_id', sql.Int, supplierId)
        .input('amount', sql.Decimal(18,2), paymentData.amount)
        .input('payment_methode', sql.NVarChar, paymentData.payment_methode)
        .input("created_at", sql.DateTime, currentTimeStamp)
        .query(`
            INSERT INTO supplier_payments (supplier_id, amount, payment_methode, created_at)
            VALUES (@supplier_id, @amount, @payment_methode, @created_at)
        `)
    ;
}

async function getInvoices(invoiceId) {
    const result = await pool.request()
        .input('id', sql.Int, invoiceId)
        .query(`
            SELECT *
            FROM supplier_invoices
            WHERE id = @id       
        `
    );

    return result.recordset[0];
}


const invoiceSchema = z.object({
    total_price: z.preprocess(
        val => Number(val),  // يحول أي شيء إلى Number
        z.number().positive("السعر الإجمالي يجب أن يكون رقمًا موجبًا")
    ),

    discount: z.preprocess(
        val => Number(val),
        z.number().nonnegative("قيمة الخصم يجب أن تكون صفر أو رقمًا موجبًا")
    ),

    items: z.array(
        z.object({
            name: z.string()
                .trim()
                .min(2, "الاسم يجب أن يحتوي على حرفين على الأقل")
                .regex(
                    /^[\u0600-\u06FFa-zA-Z0-9\s]+$/,
                    "الاسم يجب أن يحتوي على حروف وأرقام فقط"
                ),
            cost_price: z.preprocess(
                val => Number(val),
                z.number().positive("سعر التكلفة يجب أن يكون رقمًا موجبًا")
            ),

            qty: z.preprocess(
                val => Number(val),
                z.number().int().positive("الكمية يجب أن تكون رقمًا صحيحًا أكبر من صفر")
            ),
        })
    )
});



const paymentSchema = z.object({
    amount: z.preprocess(
        val => Number(val),  // يحول أي شيء إلى Number
        z.number().positive("قيمة الدفع يجب أن تكون رقمًا موجبًا")
    ),

    payment_methode: z.enum(["نقدا", "حوالة بنكية", "شيك"], {
        errorMap: () => ({ message: "يجب اختيار طريقة الدفع" })
    }),

});
