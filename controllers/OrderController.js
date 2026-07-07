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

        const tableNum = Number(parsedData.tableNum) === 0 ? null : Number(parsedData.tableNum);

        let {status , paymentMethod} = checkStatus(parsedData.orderType, parsedData.paymentStatus, parsedData.paymentMethod);


        await transaction.begin();
        transactionStarted = true;

        const invoiceNum = await generateInvoiceInfo(sessionId, transaction);
        const orderId    = await insertOrder(adminId, sessionId, invoiceNum, parsedData.totalPrice, orderData.discount, paymentMethod, parsedData.orderType, status, tableNum, transaction);
        await insertItems(orderId, orderData.items, transaction);

        if(parsedData.orderType === 'طاولة'){
            await addOrderToTable(orderId, parsedData.tableNum, transaction);
        }

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

        if (e?.originalError?.info?.message?.includes("Violation of UNIQUE KEY constraint")) {
            return res.status(409).json({
                message: " لا يمكن إنشاء طلب جديد لهذه الطاولة , لأنها تحتوي على طلب نشط لم يتم إغلاقه بعد."
            });
        }

        if (e?.originalError?.info?.message?.includes("The INSERT statement conflicted with the FOREIGN KEY")) {
            return res.status(409).json({
                message: "لا توجد طاولة بهذا الرقم، يرجى التحقق من رقم الطاولة ."
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

        if(order.type === 'طاولة'){
            await closeTable(orderId, transaction);
        }


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


export const addNewItems = async (req , res) =>{
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;
    try{
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        await checkToken(token);

        const data = req.body;

        const orderId               = Number(data.order_id);
        const totalPriceForNewItems = Number(data.total_price);
        const newItems              = data.new_items;

        await transaction.begin();
        transactionStarted = true;

        const  currentItems = await getOrderItems(orderId , transaction);

        await checkItems(currentItems, newItems, orderId, transaction);

        await updateTotalPrice(orderId, totalPriceForNewItems, transaction);

        await transaction.commit();

        return res.status(200).json({
            message: 'تم إضافة الأصناف'
        });

    }catch(e){
        if(transactionStarted){
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

export const payOrder = async (req , res) =>{
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;
    try{
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        const adminId = await checkToken(token);

        const body = req.body;
        const orderId  = Number(body.order_id);
        const discount = Number(body.new_discount);
        const paymentMethod = body.payment_method;

        const session = await checkSession(adminId, pool, sql);
        const hasOpeningSession = !!session;

        if(hasOpeningSession){

            const order = await getOrderById(orderId);

            if(order.total_price < discount){
                throw new SystemError("خطأ : قيمة الخصم أكبر من السعر الإجمالي", 400);
            }

            await transaction.begin();
            transactionStarted = true;

            await payment(orderId, paymentMethod, discount, transaction);

            await closeTable(orderId, transaction);

            

            await transaction.commit();

            return res.status(200).json({
                message: 'تم تسديد الطلب وإغلاق الطاولة بنجاح.'
            });


        }
        else{
            return res.status(400).json({
                message: 'خطأ : لا يوجد صندوق مفتوح , الرجاء فتح صندوق جديد قبل تسديد الطاولة.'
            });
        }
        
    }catch(e){
        if(transactionStarted){
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

export const destroyOrderTable = async (req , res) =>{
    const orderId = Number(req.query.order_id);
    try{
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        await checkToken(token);

        await pool
            .request()
            .input('id', sql.Int, orderId)
            .query(`
                DELETE
                FROM orders
                WHERE id = @id;
            `)
        ;
        return res.status(200).json({
            message:'تم حذف الطلب , و إغلاق الطاولة'
        })
    }catch(e){
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
async function closeTable(orderId , transaction) {
    await transaction
        .request()
        .input('id', sql.Int, orderId)
        .query(`
            DELETE 
            FROM table_order
            WHERE order_id = @id;
        `)
    ;
}

async function payment(orderId, paymentMethod, discount, transaction) {
    await transaction
        .request()
        .input('pay_methode', sql.NVarChar, paymentMethod)
        .input('status', sql.NVarChar, 'مكتمل')
        .input('new_discount', sql.Int, discount)
        .input('id', sql.Int, orderId)
        .query(`
            UPDATE orders
            SET 
                total_price = total_price - @new_discount,
                payment_method = @pay_methode,
                discount = discount + @new_discount,
                status = @status
            WHERE id = @id
        `)
    ;
}
async function getOrderItems(orderId, transaction) {
    const result = await transaction
        .request()
        .input('id', sql.Int, orderId)
        .query(`
            SELECT *
            FROM order_items
            WHERE order_id = @id    
        `)
    ;
    return result.recordset;
}

async function checkItems(currentItems , newItems, orderId, transaction){
    let insertBatch = [];
    let updateBatch = [];


    newItems.forEach(item => {
        item.name = getSize(item.name);

        const existItem = currentItems.find(i => i.item_id === item.id && i.size_name === item.name);

        if(existItem){
             updateBatch.push({
                id: existItem.id,
                quantity: existItem.quantity + item.qty
            });
        }
        else{
            insertBatch.push({
                order_id: orderId,
                id: item.id,
                quantity: item.qty,
                price: item.price,
                size: item.name
            });
        }
    });


    await saveItems(insertBatch, updateBatch, transaction);
}

async function saveItems(insertBatch, updateBatch, transaction) {
    if (insertBatch.length > 0) {
        await runInsertBatch(insertBatch, transaction);
    }

    if (updateBatch.length > 0) {
        await runUpdateBatch(updateBatch, transaction);
    }

}

async function runInsertBatch(insertBatch, transaction) {

    const request = transaction.request();

    const values = [];

    insertBatch.forEach((item, index) => {
        values.push(`(
            @order_id${index},
            @item_id${index},
            @quantity${index},
            @price${index},
            @size${index}
        )`);

        request.input(`order_id${index}`, sql.Int, item.order_id);
        request.input(`item_id${index}`, sql.Int, item.id);
        request.input(`quantity${index}`, sql.Int, item.quantity);
        request.input(`price${index}`, sql.Decimal(18,2), item.price);
        request.input(`size${index}`, sql.NVarChar(100), item.size);
    });

    const query = `
        INSERT INTO order_items
        (order_id, item_id, quantity, price, size_name)
        VALUES
        ${values.join(",")}
    `;


    await request.query(query);
}

async function runUpdateBatch(updateBatch, transaction) {

    if (!updateBatch.length) return;

    const request = transaction.request();

    const ids = [];

    const cases = updateBatch.map((item, index) => {
        ids.push(item.id);

        request.input(`id${index}`, sql.Int, item.id);
        request.input(`qty${index}`, sql.Int, item.quantity);

        return `WHEN @id${index} THEN @qty${index}`;
    });

    const query = `
        UPDATE order_items
        SET quantity = CASE id
            ${cases.join("\n")}
        END
        WHERE id IN (${ids.map((_, i) => `@id${i}`).join(",")});
    `;


    await request.query(query);
}

async function updateTotalPrice(orderId, totalPriceForNewItems, transaction) {
    await transaction
        .request()
        .input('add_price', sql.Int, totalPriceForNewItems)
        .input('id', sql.Int, orderId)
        .query(`
            UPDATE orders
            SET total_price = total_price + @add_price
            WHERE id = @id
        `)
    ;
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

async function insertOrder( adminId, sessionId, invoiceNum,  mainPrice, discount, paymentMethod, orderType, status, tableNum, transaction){

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
        .input('table_num' , tableNum)
        .query(`
            INSERT INTO orders (admin_id, session_id, invoice_num, total_price, discount, payment_method, status, type, created_at, table_num)
            OUTPUT INSERTED.id
            VALUES (@admin_id, @session_id, @invoice_num, @total_price, @discount, @payment_method, @status, @type, @created_at, @table_num)
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



function checkStatus(orderType, paymentStatus, paymentMethod){
    if(orderType === 'طاولة' && paymentStatus === 'unpaid'){
        return {
            status : 'غير مدفوع',
            paymentMethod : 'غير محدد'
        };
    }
    else{
        return {
            status : 'مكتمل',
            paymentMethod : paymentMethod
        };
    }
}




async function addOrderToTable(orderId, tableNum, transaction) {
    await transaction.request()
        .input('order_id', sql.Int, orderId)
        .input('table_id', sql.Int, tableNum)
        .query(`
            INSERT INTO table_order (table_id , order_id)
            VALUES (@table_id, @order_id)
        `)
    ;
}




const orderSchema = z.object({
    totalPrice: z.preprocess(
        val => Number(val),  // يحول أي شيء إلى Number
        z.number().positive("القيمة يجب أن تكون رقمًا موجبًا")
    ),

    tableNum: z.preprocess(
        val => Number(val),
        z.number().min(0, "رقم الطاولة لا يمكن ان يكون بالسالب")
    ),

    orderType: z.enum(["طاولة", "سفري"], {
        errorMap: () => ({ message: "يجب اختيار نوع الطلب" })
    }),

    paymentMethod: z.enum(["كاش", "بطاقة"], {
        errorMap: () => ({ message: "يجب اختيار طريقة الدفع" })
    }),

    
    paymentStatus: z.enum(["paid", "unpaid"], {
        errorMap: () => ({ message: "يجب اختيار حالة الدفع" })
    }),
});


const cancelResonSchema = z.object({
  cancel_reason: z
    .string()
    .min(1, "يجب إدخال سبب إلغاء الطلب")
    .regex(/^[\p{L}\s]+$/u, "يسمح بالحروف فقط"),
});