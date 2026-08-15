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
       
        const invoiceId = await createPayInvoice(supplierId, parsedData, transaction);
        
        await addInvoiceItems(invoiceId, parsedData.items, transaction);
        await updateBalanceForSupplier(supplierId, parsedData.total_price, parsedData.discount, transaction);
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

export const payIncoice = async (req , res) =>{
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

        


        if (invData.discount > invData.total_price) {
            throw new SystemError("قيمه الخصم اكبر من السعر الأساسي", 400);
        }

        await transaction.begin();
        transactionStarted = true;
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

async function createPayInvoice(supplierId, parsedData, transaction) {
    const totalPrice = parsedData.total_price - parsedData.discount;
    const currentTimeStamp = new Date();
    const result = await transaction.request()
        .input("supplier_id", sql.Int, supplierId)
        .input("total_price", sql.Decimal(18, 2), totalPrice)
        .input("paied", sql.Decimal(18, 2), 0)
        .input("remaining", sql.Decimal(18, 2), totalPrice)
        .input("created_at", sql.DateTime, currentTimeStamp)
        .input("discount", sql.Decimal(9, 2), parsedData.discount)
        .query(`
            INSERT INTO supplier_invoices (supplier_id, total_price, paied, remaining, created_at, discount)
            OUTPUT INSERTED.id
            VALUES (@supplier_id, @total_price, @paied, @remaining, @created_at, @discount);
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

async function updateBalanceForSupplier(supplierId, price, discount, transaction) {
    const totalPrice = price - discount ;
    await transaction.request()
        .input("supplier_id", sql.Int, supplierId)
        .input("total_price", sql.Decimal(18, 2), totalPrice)
        .query(`
            UPDATE suppliers
            SET balance = balance + @total_price
            WHERE id = @supplier_id     
        `);
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
