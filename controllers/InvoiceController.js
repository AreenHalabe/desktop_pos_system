import { pool, sql } from "../DataBaseConnections/dbconnection.js";
import { checkToken, SystemError } from "../shared/functionality.js";
import { z } from "zod";


export const getInvoice = async (req, res) => {
    const invoiceId = Number(req.query.invoice_id);

    try {
        const token = req.headers.authorization;

        if (!token) {
            throw new SystemError(
                "إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى",
                401
            );
        }

        await checkToken(token);

        const result = await pool
            .request()
            .input('invoice_id', sql.Int, invoiceId)
            .query(`
                SELECT 
                    si.*,
                    it.name,
                    it.unit,
                    it.quantity,
                    it.cost_price
                FROM supplier_invoices si
                INNER JOIN invoice_items it
                    ON it.invoice_id = si.id
                WHERE si.id = @invoice_id
            `);

        const rows = result.recordset;

        const invoice = mapInvoiceDate(rows);

        return res.status(200).json({
            success: true,
            invoice
        });

    } catch (e) {

        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}

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

        let date ;
        
        if (invData.use_current_date_time) {
            date = new Date();
            
        } else {
            date = invData.invoice_date_time
            ? invData.invoice_date_time.replace('T', ' ') + ':00'
            : null;
        }


        await transaction.begin();
        transactionStarted = true;
        const totalPrice = parsedData.total_price - parsedData.discount;

        const invoiceId = await createPayInvoice(supplierId, parsedData, totalPrice, date, transaction);

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
        let checkId = null;

        if (parsedData.amount > supplier.balance) {
            throw new SystemError("خطأ : قيمة الدُفعة أكبر من مستحقات المُورد", 400);
        }


        await transaction.begin();
        transactionStarted = true;

        await payment(supplierId, parsedData.amount, transaction);
        await updateBalanceForSupplier(supplierId, parsedData.amount, false, transaction);

        if(paymentData.paymentMethode === 'شيك'){
            const data = checkSchema.parse(paymentData);
            
            const amount =  Number(paymentData.checkAmount) === 0 ?  Number(paymentData.amount) : Number(paymentData.checkAmount);
            
            checkId =  await addNewCheck(data.checkAccountName, data.checkNumber, data.bankName, supplier.name, amount, data.currency, data.dueDate, 'outgoing', 'pending', data.notes, transaction);
        }


        await savePaymentData(supplierId, paymentData, checkId, transaction);
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

export const deletePayment = async (req, res) => { 
    const pay_id = Number(req.query.pay_id); 
    const supplierId = Number(req.query.supplier_id); 
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;
    try { 
        const token = req.headers.authorization;
        if (!token) { 
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        } 
        await checkToken(token);
        
        const payment = await getPayment(pay_id);
        
        await transaction.begin();
        transactionStarted = true;
         
        await restorePayment(supplierId, payment.amount, transaction);
        
        await updateBalanceForSupplier(supplierId, payment.amount, true, transaction);

        
        if (payment.payment_methode === 'شيك') {
            await deleteCheck(payment.check_id, transaction) 
        } 
        
        else{
            await deletePaymentRecord(pay_id, transaction);
        }
        
        await transaction.commit();
        
        
        return res.status(200).json({ success: true, message: "تم حذف الدقعة", });
    
    } catch (e) {
        if(transactionStarted) {
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


export const editInvoice = async(req , res) =>{
    const supplierId = Number(req.query.supplier_id);
    const currentInvoiceId  = Number(req.query.invoice_id);

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
        
        let date = invData.invoice_date_time;
        
        const currentInvoice = await getInvoices(currentInvoiceId);
        
       
        
        if(currentInvoice.total_price !== currentInvoice.remaining){
            throw new SystemError("حطأ: لا يمكن تعديل فاتورة تم تسديد دفعات عليها", 400);
        }
        
        
        await transaction.begin();
        transactionStarted = true;
        
        await updateBalanceForSupplier(supplierId, currentInvoice.total_price, false, transaction);
        await deleteCurrentInvoice(currentInvoiceId, transaction);
        
        
        
        
        const totalPrice = parsedData.total_price - parsedData.discount;
        const invoiceId = await createPayInvoice(supplierId, parsedData, totalPrice, date, transaction);
        await addInvoiceItems(invoiceId, parsedData.items, transaction);
        await updateBalanceForSupplier(supplierId, totalPrice, true, transaction);
        await insertItemsForSupplier(supplierId, parsedData.items, transaction);


        await transaction.commit();

        return res.status(200).json({
            success: true,
            invoice_number: invoiceId,
            message: "تم تعديل الفاتورة",
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




async function createPayInvoice(supplierId, parsedData, totalPrice, date, transaction) {

    const result = await transaction
        .request()
        .input('supplier_id', sql.Int, supplierId)
        .input('total_price', sql.Decimal(18, 2), totalPrice)
        .input('remaining', sql.Decimal(18, 2), totalPrice)
        .input('created_at', sql.DateTime, date)
        .input('discount', sql.Decimal(15, 2), parsedData.discount)
        .query(`
            INSERT INTO supplier_invoices
            (
                supplier_id,
                total_price,
                remaining,
                created_at,
                discount
            )
            OUTPUT INSERTED.id
            VALUES
            (
                @supplier_id,
                @total_price,
                @remaining,
                @created_at,
                @discount
            )
        `);

    const invoiceId = result.recordset[0].id;

    return invoiceId;
}



async function addInvoiceItems(invoiceId, items, transaction) {
    const request = transaction.request();

    const values = [];

    items.forEach((item, index) => {
        values.push(
            `(@invoice_id_${index}, @name_${index}, @unit_${index}, @quantity_${index}, @cost_price_${index})`
        );

        request.input(`invoice_id_${index}`, sql.Int, invoiceId);
        request.input(`name_${index}`, sql.NVarChar(255), item.name);
        request.input(`unit_${index}`, sql.NVarChar(50), item.unit);
        request.input(`quantity_${index}`, sql.Decimal(15, 2), item.qty);
        request.input(`cost_price_${index}`, sql.Decimal(15, 2), item.cost_price);
    });

    await request.query(`
        INSERT INTO invoice_items
            (invoice_id, name, unit, quantity, cost_price)
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

async function savePaymentData(supplierId , paymentData, checkId, transaction) {
    const currentTimeStamp = new Date();
    await transaction.request()
        .input('supplier_id', sql.Int, supplierId)
        .input('check_id', sql.Int, checkId)
        .input('amount', sql.Decimal(18,2), paymentData.amount)
        .input('payment_methode', sql.NVarChar, paymentData.paymentMethode)
        .input("created_at", sql.DateTime, currentTimeStamp)
        .query(`
            INSERT INTO supplier_payments (supplier_id, amount, payment_methode, check_id, created_at)
            VALUES (@supplier_id, @amount, @payment_methode, @check_id, @created_at)
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

async function getPayment(paymentId) {
    const result = await pool.request()
        .input('id', sql.Int, paymentId)
        .query(`
            SELECT *
            FROM supplier_payments
            WHERE id = @id       
        `
    );

    return result.recordset[0];
}

async function addNewCheck(accountName, checkNumber, bankName, payeeName, amount, currency, dueDate, type, status, notes, transaction) {

    const result = await transaction
        .request()
        .input('account_name', sql.NVarChar(100), accountName)
        .input('check_number', sql.NVarChar(50), checkNumber)
        .input('bank_name', sql.NVarChar(100), bankName)
        .input('payee_name', sql.NVarChar(150), payeeName)
        .input('amount', sql.Decimal(18, 2), amount)
        .input('currency', sql.NVarChar(3), currency)
        .input('due_date', sql.Date, dueDate)
        .input('type', sql.NVarChar(10), type)
        .input('status', sql.NVarChar(10), status)
        .input('notes', sql.NVarChar(sql.MAX), notes || null)
        .query(`
            INSERT INTO checks (
                account_name,
                check_number,
                bank_name,
                payee_name,
                amount,
                currency,
                due_date,
                type,
                status,
                notes
            )
            OUTPUT INSERTED.id
            VALUES (
                @account_name,
                @check_number,
                @bank_name,
                @payee_name,
                @amount,
                @currency,
                @due_date,
                @type,
                @status,
                @notes
            )
        `);

    return result.recordset[0].id;
}


async function restorePayment(supplierId, amount, transaction) {
    await transaction
        .request()
        .input('amount', sql.Decimal(18, 2), amount)
        .input('supplier_id', sql.Int, supplierId)
        .query(`
            UPDATE si
            SET si.remaining = si.remaining + RestoreData.restore_amount
            FROM supplier_invoices AS si

            INNER JOIN (
                SELECT
                    id,

                    CASE
                        WHEN cumulative_paid <= @amount THEN paid_amount

                        WHEN cumulative_paid - paid_amount < @amount THEN
                            @amount - (cumulative_paid - paid_amount)

                        ELSE 0
                    END AS restore_amount

                FROM (
                    SELECT
                        id,
                        total_price,
                        remaining,

                        (total_price - remaining) AS paid_amount,

                        SUM(total_price - remaining) OVER (
                            ORDER BY
                                CASE
                                    WHEN remaining > 0
                                        THEN 0
                                    ELSE 1
                                END ASC,

                                CASE
                                    WHEN remaining > 0
                                        THEN id
                                    ELSE -id
                                END ASC

                            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                        ) AS cumulative_paid

                    FROM supplier_invoices

                    WHERE supplier_id = @supplier_id
                      AND total_price > 0
                      AND remaining < total_price

                ) AS InvoiceData

            ) AS RestoreData

                ON RestoreData.id = si.id

            WHERE RestoreData.restore_amount > 0
        `);
}

async function deleteCheck(checkId, transaction) {
    await transaction
        .request()
        .input('checkId', sql.Int, checkId)
        .query(`
            DELETE FROM checks
            WHERE id = @checkId
        `);
}

async function deletePaymentRecord(paymentId, transaction) {
    await transaction
        .request()
        .input('paymentId', sql.Int, paymentId)
        .query(`
            DELETE FROM supplier_payments
            WHERE id = @paymentId
        `);
}

async function deleteCurrentInvoice(invoiceId, transaction) {
    await transaction
        .request()
        .input('invoiceId', sql.Int, invoiceId)
        .query(`
            DELETE
            FROM supplier_invoices
            WHERE id = @invoiceId
        `);
}

function mapInvoiceDate(rows) {
    if (rows.length === 0) return null;

    const invoice = {
        id: rows[0].id,
        total_price: rows[0].total_price,
        paied: rows[0].paied,
        remaining: rows[0].remaining,
        created_at: rows[0].created_at,
        discount: rows[0].discount,
        supplier_id : rows[0].supplier_id,
        items: []
    };

    for (const row of rows) {
        invoice.items.push({
            name: row.name,
            unit: row.unit,
            quantity: row.quantity,
            cost_price: row.cost_price
        });
    }

    return invoice;
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
            unit: z.string()
                .trim()
                .min(2, "الوحدة يجب أن تحتوي على حرفين على الأقل")
                .regex(
                    /^[\u0600-\u06FFa-zA-Z\s]+$/,
                    "الوحدة يجب أن تحتوي على حروف فقط"
            ),
            cost_price: z.preprocess(
                val => Number(val),
                z.number().positive("سعر التكلفة يجب أن يكون رقمًا موجبًا")
            ),

            qty: z.preprocess(
                val => Number(val),
                z.number().positive("الكمية يجب أن تكون رقمًا صحيحًا أكبر من صفر")
            ),
        })
    )
});



const paymentSchema = z.object({
    amount: z.preprocess(
        val => Number(val),  // يحول أي شيء إلى Number
        z.number().positive("قيمة الدفع يجب أن تكون رقمًا موجبًا")
    ),

    paymentMethode: z.enum(["نقدا", "حوالة بنكية", "شيك"], {
        errorMap: () => ({ message: "يجب اختيار طريقة الدفع" })
    }),

});


const checkSchema = z.object({

    checkNumber: z.string()
        .trim()
        .regex(/^\d+$/, "رقم الشيك يجب أن يحتوي على أرقام فقط")
        .min(1, "رقم الشيك مطلوب"),

    checkAccountName: z.string()
        .trim()
        .min(2, "اسم الحساب مطلوب")
        .regex(/^[\u0600-\u06FF\s]+$/, "اسم الحساب يجب أن يحتوي على أحرف عربية فقط"),
    
    currency: z.enum(["ILS", "USD", "JOD", "EUR"], {
        errorMap: () => ({ message: "يجب اختيار عملة الشيك" })
    }),
    
    bankName: z.string()
        .trim()
        .min(2, "اسم البنك مطلوب")
        .regex(/^[\u0600-\u06FF\s]+$/, "اسم البنك يجب أن يحتوي على أحرف عربية فقط"),


    dueDate: z.string()
        .regex(
            /^\d{4}-\d{2}-\d{2}$/,
            "تاريخ استحقاق الشيك غير صحيح"
        ),

    notes: z.string()
        .trim()
        .optional()

});