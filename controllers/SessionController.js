import { body, query } from "express-validator";
import { StatusCode } from "../HTTPSStatusCode/StatusCode.js";
import { pool, sql } from "../DataBaseConnections/dbconnection.js";
import { checkToken, SystemError, buildTreeOfOrders } from "../shared/functionality.js";
import { getTransactionsBySession, getOrderAndItemsBySession, checkSession, getCashSummery } from "../shared/api.js";
import { z } from "zod";


export const checkCashSession = async (req , res) => {
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }

        const adminId = await checkToken(token);

        const session = await checkSession(adminId, pool, sql);
        const hasOpeningSession = !!session;
        let cashSummery;

        if (hasOpeningSession) {
            cashSummery = await getCashSummery(session.id, pool, sql);

            cashSummery.expected_cash =
                session.opening_cash + cashSummery.cash_sales + cashSummery.cash_in - cashSummery.cash_out;

            cashSummery.opening_cash = session.opening_cash;
        }

        return res.status(200).json(
            {
                hasOpeningSession,
                session_id: session?.id || null,
                cash_summery: cashSummery || null
            }
        );

    } catch (e) {
        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}

export const openNewSession = async (req , res) =>{
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }

        const adminId = await checkToken(token);

        const session = await checkSession(adminId, pool, sql);
        const hasOpeningSession = !!session;

        if(hasOpeningSession){
          throw new SystemError('يوجد صندوق مفتوح, يجب إغلاقه لفتح صندوق جديد',409);
        }


        const { opening_cash } = req.body;

        const openingCash  = RealNumberSchema.parse({ value:opening_cash }).value;

        const currentTimeStamp = new Date();
        const result = await pool
            .request()
            .input("open_at", sql.DateTime2, currentTimeStamp)
            .input("opening_cash", sql.Decimal(10, 2), openingCash)
            .input("admin_id", sql.Int, adminId)
            .query(`
                INSERT INTO cash_sessions (admin_id, open_at, opening_cash)
                OUTPUT INSERTED.id
                VALUES (@admin_id, @open_at, @opening_cash)
            `)
        ;
        
        const sessionId = result.recordset[0].id;

        return res.status(200).json(
            {
                session_id : sessionId
            }
        );

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

export const closeSession = async (req , res) =>{
    const sessionId = Number(req.query.session_id);
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }

        await checkToken(token);


        const { actual_cash } = req.body;

        const actualCash  = RealNumberSchema.parse({ value:actual_cash }).value;

        const currentSession = await getSession(sessionId);

        const cashSummery = await getCashSummery(sessionId, pool, sql);

        const expectedCash =
            currentSession.opening_cash + cashSummery.cash_sales + cashSummery.cash_in - cashSummery.cash_out;

        const difference = actualCash - expectedCash;


        const currentTimeStamp = new Date();

        await pool.request()
            .input("expected_cash", sql.Decimal(10, 2), expectedCash)
            .input("actual_cash", sql.Decimal(10, 2), actualCash)
            .input("difference", sql.Int, difference)
            .input("closed_at", sql.DateTime2, currentTimeStamp)
            .input("id", sql.Int, sessionId)
            .query(`
                UPDATE cash_sessions
                SET expected_cash = @expected_cash, actual_cash = @actual_cash, difference = @difference, closed_at = @closed_at
                WHERE id = @id
            `)
        ;


        return res.status(StatusCode.Ok).json({
            message: "تم إغلاق الصندوق بنجاح"
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

export const getSessionAnalytics = async (req , res) => {
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        const adminId = await checkToken(token);

        let orders = [] ;
        let transactions = [];
        let cashSummery;

        const session = await checkSession(adminId, pool, sql);

        const hasOpeningSession = !!session;

        if(hasOpeningSession){
            [
                cashSummery,
                transactions,
                orders
            ] = await Promise.all([
                getCashSummery(session.id, pool, sql),
                getTransactionsBySession(session.id, pool, sql),
                getOrderAndItemsBySession(session.id, pool, sql)
            ]);

            orders = buildTreeOfOrders(orders);

            cashSummery.expected_cash =
                session.opening_cash + cashSummery.cash_sales + cashSummery.cash_in - cashSummery.cash_out
            ;
            
            cashSummery.opening_cash = session.opening_cash;
        }


        return res.status(200).json(
            {
                has_open_session : hasOpeningSession,
                session          : session || null,
                cash_summery     : cashSummery || null,
                transactions     : transactions,
                orders           : orders,
            }
        );
    }catch (e) {
        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}   



async function getSession(sessionId) {
    const session = await pool
        .request()
        .input("id", sql.Int, sessionId)
        .query(`
            SELECT * FROM cash_sessions
            WHERE id = @id
        `)
        ;
    return session.recordset[0] || null;
}







const RealNumberSchema = z.object({
  value : z.coerce.number()
  .positive("السعر يجب أن يكون رقمًا موجبًا")
});
