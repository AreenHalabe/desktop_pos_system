import { StatusCode } from "../HTTPSStatusCode/StatusCode.js";
import { pool, sql } from "../DataBaseConnections/dbconnection.js";
import { checkToken, SystemError, buildTreeOfOrders } from "../shared/functionality.js";
import { getOrderAndItemsBySession , checkSession} from "../shared/api.js";
import { z } from "zod";


export const createOrder = async (req, res) => {
    const sessionId = Number(req.query.session_id);
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        const adminId = await checkToken(token);
        
        const orderData = req.body;

        if(orderData.discount > orderData.totalPrice){
            throw new SystemError("قيمه الخصم اكبر من السعر الأساسي", 400);
        }


        const parsedData  = orderSchema.parse(orderData);


        await transaction.begin();
        transactionStarted = true;

        const invoiceNum = await generateInvoiceInfo(sessionId, transaction);
        const orderId    = await insertOrder(adminId, sessionId, invoiceNum, parsedData.totalPrice, orderData.discount, parsedData.paymentMethod, parsedData.orderType, 'مكتمل', transaction);
        await insertItems(orderId, orderData.items, transaction);

      

        await transaction.commit();

        return res.status(200).json({
            success: true,
            invoiceNum,
            message: "تم إنشاء الطلب",
        });


    } catch (e) {
        if(transactionStarted){
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


export const deleteOrder = async (req , res) => {
    const orderId = Number(req.query.order_id);
     const transaction = new sql.Transaction(pool);
    let transactionStarted = false;
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        
        await checkToken(token);

        const body = req.body;
        const cancel_reason = body.cancel_reason;
        const parsedData    = cancelResonSchema.parse({ cancel_reason });


        const currentTimestamp = new Date();

        

        const order = await getOrderById(orderId);

        await transaction.begin();
        transactionStarted = true;

        await transaction.request()
            .input('id', sql.Int, orderId)
            .input('cancel_reason', sql.NVarChar, cancel_reason)
            .input('status', sql.NVarChar, 'ملغي')
            .input('updated_at', sql.DateTime2, currentTimestamp)
            .query(`
                UPDATE orders
                SET status = @status, cancel_reason = @cancel_reason, updated_at = @updated_at
                WHERE id=@id
            `);
        ;

       


        await transaction.commit();


        return res.status(200).json({
            success: true,
            message: "تم حذف الطلب",
        });


    } catch (e) {
        if(transactionStarted){
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




async function getOrderById(orderId) {
    const result = await pool
        .request()
        .input('id', sql.Int, orderId)
        .query(`
            SELECT *
            FROM orders
            WHERE id = @id;
        `)
    ;
    return result.recordset[0];
}







function getSize(name) {
    const parts = name.split("-");
    return parts.length > 1 ? parts[1].trim() : 'NaN';
}

async function generateInvoiceInfo(sessionId, transaction) {
    const result = await transaction
        .request()
        .input('id', sql.Int, sessionId)
        .query(`
            UPDATE cash_sessions
            SET last_order = last_order + 1
            OUTPUT INSERTED.last_order
            WHERE id = @id;
        `)
    ;
    const counter = result.recordset[0];
    const invoiceNum = `INV-${counter.last_order.toString().padStart(3, "0")}`;

    return invoiceNum;
}

async function insertOrder( adminId, sessionId, invoiceNum,  mainPrice, discount, paymentMethod, orderType, status, transaction){

    const totalPrice = mainPrice - discount;

    const currentTimeStamp = new Date(); 
    const result = await transaction
        .request()
        .input('admin_id', sql.Int, adminId)
        .input('session_id', sql.Int, sessionId)
        .input('invoice_num', sql.NVarChar, invoiceNum)
        .input('total_price', sql.Decimal(10,2), totalPrice)
        .input('discount', sql.Decimal(10,2), discount)
        .input('payment_method', sql.NVarChar, paymentMethod)
        .input('status', sql.NVarChar, status)
        .input('type', sql.NVarChar, orderType)
        .input("created_at", sql.DateTime2, currentTimeStamp)
        .query(`
            INSERT INTO orders (admin_id, session_id, invoice_num, total_price, discount, payment_method, status, type, created_at)
            OUTPUT INSERTED.id
            VALUES (@admin_id, @session_id, @invoice_num, @total_price, @discount, @payment_method, @status, @type, @created_at)
        `)
    ;

    const orderId = result.recordset[0].id;

    return orderId;
}



async function insertItems(orderId, items, transaction) {
    const request = transaction.request();

    let values = [];
    
    items.forEach((item, index) => {
        values.push(`
            (@order_id${index}, @item_id${index}, @quantity${index}, @price${index}, @size_name${index})
        `);
        request.input(`order_id${index}`, sql.Int, orderId);
        request.input(`item_id${index}`, sql.Int, item.id);
        request.input(`quantity${index}`, sql.Int, item.qty);
        request.input(`price${index}`, sql.Int, item.price);
        request.input(`size_name${index}`, sql.NVarChar, item.sizeName || 'NaN');
    });

    const query = `
        INSERT INTO order_items 
        (order_id, item_id, quantity, price, size_name)
        VALUES ${values.join(", ")}
    `;

    await request.query(query);
}











const orderSchema = z.object({
    totalPrice: z.preprocess(
        val => Number(val),  // يحول أي شيء إلى Number
        z.number().positive("القيمة يجب أن تكون رقمًا موجبًا")
    ),

    orderType: z.enum(["طاولة", "سفري"], {
        errorMap: () => ({ message: "يجب اختيار نوع الطلب" })
    }),

    paymentMethod: z.enum(["كاش", "بطاقة"], {
        errorMap: () => ({ message: "يجب اختيار طريقة الدفع" })
    }),

});


const cancelResonSchema = z.object({
  cancel_reason: z
    .string()
    .min(1, "يجب إدخال سبب إلغاء الطلب")
    .regex(/^[\p{L}\s]+$/u, "يسمح بالحروف فقط"),
});