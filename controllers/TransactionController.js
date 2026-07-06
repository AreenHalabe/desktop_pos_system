import { body, query } from "express-validator";
import { StatusCode } from "../HTTPSStatusCode/StatusCode.js";
import { pool, sql } from "../DataBaseConnections/dbconnection.js";
import { checkToken, SystemError} from "../shared/functionality.js";
import { getTransactionsBySession, getOrderAndItemsBySession, checkSession, getCashSummery } from "../shared/api.js";

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
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        const adminId = await checkToken(token);
        const transaction = req.body;
        const parsedData       = transactionSchema.parse(transaction);
        const currentTimeStamp = new Date();

        const[
            session,
            cashSummery
        ] = await Promise.all([
            checkSession(adminId, pool, sql),
            getCashSummery(sessionId, pool, sql)
        ]);

       

        const expected_cash =
                session.opening_cash + cashSummery.cash_sales + cashSummery.cash_in - cashSummery.cash_out;

        if(parsedData.type === "سحب" && parsedData.amount > expected_cash){
            throw new SystemError("لا يمكن سحب مبلغ أكبر من الرصيد الحالي", 400);
        }

        const result = await pool
            .request()
            .input("session_id", sql.Int, sessionId)
            .input("admin_id", sql.Int, adminId)
            .input("amount", sql.Decimal(10, 2), parsedData.amount)
            .input("type", sql.NVarChar, parsedData.type)
            .input("note", sql.NVarChar, parsedData.note)
            .input("created_at", sql.DateTime2, currentTimeStamp)
            .query(`
                INSERT INTO transactions (session_id, admin_id, amount, type, note, created_at)
                VALUES (@session_id, @admin_id, @amount, @type, @note, @created_at)
            `)
        ;


        return res.status(StatusCode.Ok).json({
            message: 'تم إنشاء المعاملة بنجاح'
        });


    } catch (e) {
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