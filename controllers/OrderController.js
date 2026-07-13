import { StatusCode } from "../HTTPSStatusCode/StatusCode.js";
import { pool, sql } from "../DataBaseConnections/dbconnection.js";
import { checkToken, SystemError, buildTreeOfOrders } from "../shared/functionality.js";
import { getOrderAndItemsBySession} from "../shared/api.js";




export const getDaliyOrders = async (req , res) => {
    const sessionId = Number(req.query.session_id);
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        await checkToken(token);

        let orders = await getOrderAndItemsBySession(sessionId, pool, sql);

        if(orders.length > 0){
            orders = buildTreeOfOrders(orders);
        }

        return res.status(200).json({
            orders: orders
        });


    }catch (e) {
        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}


