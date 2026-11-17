import { StatusCode } from "../HTTPSStatusCode/StatusCode.js";
import { pool, sql } from "../DataBaseConnections/dbconnection.js";
import { checkToken, SystemError} from "../shared/functionality.js";
import { getTransactionsBySession, checkSession, getCashSummery } from "../shared/api.js";

import { z } from "zod";



export const loadTransactions = async(req , res) => {
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        const adminId = await checkToken(token);

        const session = await checkSession(adminId, pool, sql);

        let cashSummery ;
        let transactions;
        const hasOpeningSession = !!session;

        if(hasOpeningSession){
            [
                cashSummery,
                transactions,
            ] = await Promise.all([
                getCashSummery(session.id, pool, sql),
                getTransactionsBySession(session.id, pool, sql),
            ]);
            cashSummery.expected_cash =
                session.opening_cash + cashSummery.cash_sales + cashSummery.cash_in - cashSummery.cash_out;

            cashSummery.opening_cash = session.opening_cash;
        }

        return res.status(200).json(
            {
               has_open_session : hasOpeningSession,
                session_id : session?.id || null,
                cash_summery : cashSummery || null,
                transactions : transactions || null,
            }
        );
    } catch (e) {
        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}


export const createTransaction = async(req , res) => {
    const sessionId = Number(req.query.session_id);

    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;

    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        const adminId = await checkToken(token);


        const transactionData = req.body;

        const parsedData       = transactionSchema.parse(transactionData);
        const currentTimeStamp = new Date();
        const session = await checkSession(adminId, pool);
        const hasOpeningSession = !!session;

        if(!hasOpeningSession){
            throw new SystemError("لا يوجد صندوق مفتوح", 400);
        }



        await transaction.begin();
        transactionStarted = true;

        const customerId = Number(transactionData.customer_id);

        if(customerId !== 0){
            const {balance} = await getCustomerBalance(customerId);
            if(Number(balance) < parsedData.amount){
                throw new SystemError("المبلغ المطلوب دفعه أكبر من رصيد العميل المتاح", 400);
            }
            await paymentInvoicesForCustomer(customerId, parsedData.amount, transaction);
            await updateCustomerBalance(customerId, parsedData.amount, false, transaction);
        }
        else{
            customerId = null;
        }

        await transaction
            .request()
            .input("session_id", sql.Int, sessionId)
            .input("admin_id", sql.Int, adminId)
            .input("amount", sql.Decimal(10, 2), parsedData.amount)
            .input("type", sql.NVarChar, parsedData.type)
            .input("note", sql.NVarChar, parsedData.note)
            .input("created_at", sql.DateTime2, currentTimeStamp)
            .input("customer_id", sql.Int, customerId)
            .query(`
                INSERT INTO transactions (session_id, admin_id, amount, type, note, created_at, customer_id)
                VALUES (@session_id, @admin_id, @amount, @type, @note, @created_at, @customer_id)
            `)
        ;



        await transaction.commit();

        return res.status(StatusCode.Ok).json({
            message: 'تم إنشاء المعاملة بنجاح'
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

export const deleteTransaction = async(req , res) => {
    const transactionId = Number(req.query.transaction_id);
    try {
        const token = req.headers.authorization;
        if (!token){
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        await checkToken(token);

        await pool
            .request()
            .input('id', sql.Int, transactionId)
            .query(`
                DELETE from transactions WHERE id = @id
            `)
        ;

        return res.status(StatusCode.Ok).json({
            message: 'تم حذف المعاملة بنجاح'
        });
        
    } catch (e) {
        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}




async function getCustomerBalance(customerId) {

    const result = await pool.request()
        .input("customerId", sql.Int, customerId)
        .query(`
            SELECT balance
            FROM customers
            WHERE id = @customerId
        `);

    return result.recordset[0]
        ? {
            balance: Number(result.recordset[0].balance)
        }
        : null;
}


async function updateCustomerBalance(customerId, amount, isAdd, transaction) {
    if (!customerId) return;

    await transaction.request()
        .input("amount", sql.Decimal(18, 2), amount)
        .input("customerId", sql.Int, customerId)
        .query(`
            UPDATE customers
            SET balance = balance ${isAdd ? '+' : '-'} @amount
            WHERE id = @customerId
        `);
}


async function paymentInvoicesForCustomer(customerId, paymentAmount, transaction) {

    const invoicesResult = await transaction.request()
        .input("customerId", sql.Int, customerId)
        .query(`
            SELECT order_id, remaining
            FROM customers_order WITH (UPDLOCK, ROWLOCK)
            WHERE customer_id = @customerId
            ORDER BY id ASC
        `);

    const invoices = invoicesResult.recordset;

    let remainingPayment = Number(paymentAmount);

    const deleteInvoices = [];
    const updateInvoices = [];

    for (const invoice of invoices) {

        if (remainingPayment <= 0) break;

        const invoiceRemaining = Number(invoice.remaining);

        if (remainingPayment >= invoiceRemaining) {

            remainingPayment -= invoiceRemaining;

            deleteInvoices.push(invoice.order_id);

        } else {

            updateInvoices.push({
                order_id: invoice.order_id,
                remaining: invoiceRemaining - remainingPayment
            });

            remainingPayment = 0;
        }
    }

    // Delete invoices
    if (deleteInvoices.length > 0) {

        const request = transaction.request()
            .input("customerId", sql.Int, customerId);

        const placeholders = deleteInvoices.map((orderId, index) => {
            request.input(`orderId${index}`, sql.Int, orderId);
            return `@orderId${index}`;
        }).join(',');

        await request.query(`
            DELETE FROM customers_order
            WHERE customer_id = @customerId
            AND order_id IN (${placeholders})
        `);

    }

    // Update invoices
    if (updateInvoices.length > 0) {

        const request = transaction.request()
            .input("customerId", sql.Int, customerId);

        const cases = updateInvoices
            .map((invoice, index) => {
                request.input(`orderId${index}`, sql.Int, invoice.order_id);
                request.input(`remaining${index}`, sql.Decimal(18, 2), invoice.remaining);

                return `WHEN @orderId${index} THEN @remaining${index}`;
            })
            .join(' ');

        const orderIds = updateInvoices.map((invoice, index) => `@orderId${index}`);

        await request.query(`
            UPDATE customers_order
            SET remaining = CASE order_id
                ${cases}
            END
            WHERE customer_id = @customerId
            AND order_id IN (${orderIds.join(',')})
        `);

    }

    await updateInvoicesPaymentMethod(deleteInvoices, transaction);

    return {
        remainingPayment
    };
}


async function updateInvoicesPaymentMethod(orderIds, transaction) {

    if (!orderIds || orderIds.length === 0) return;

    const request = transaction.request()
        .input("paymentMethod", sql.NVarChar(50), 'كاش');

    const placeholders = orderIds.map((orderId, index) => {
        request.input(`orderId${index}`, sql.Int, orderId);
        return `@orderId${index}`;
    }).join(',');

    await request.query(`
        UPDATE orders
        SET payment_method = @paymentMethod
        WHERE id IN (${placeholders})
    `);

}



const transactionSchema = z.object({
  amount: z.preprocess(
    val => Number(val), 
    z.number().positive("القيمة يجب أن تكون رقمًا موجبًا")
  ),

  type: z.enum(["سحب", "إضافة"], {
    errorMap: () => ({ message: "يجب اختيار نوع المعاملة" })
  }),

  note: z
    .string()
    .min(1, "يجب إدخال سبب المعاملة")
    .regex(/^[\p{L}\p{N}\s]+$/u, "يسمح بالحروف والأرقام فقط"),
});