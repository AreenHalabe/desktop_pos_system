import { pool, sql } from "../DataBaseConnections/dbconnection.js";
import { checkToken, SystemError, buildTreeOfOrders } from "../shared/functionality.js";
import { getOrderAndItemsBySession, checkSession } from "../shared/api.js";
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


        if (orderData.discount === 0) {

            let totalItemsDiscount = 0;

            orderData.items.forEach(item => {
                item.discount_item = roundDiscount(Number(item.discount_item));
                totalItemsDiscount += item.discount_item;
            })

            orderData.discount = totalItemsDiscount;
        }

        if (orderData.discount > orderData.totalPrice) {
            throw new SystemError("قيمه الخصم اكبر من السعر الأساسي", 400);
        }

        const intDiscount = roundDiscount(orderData.discount);


        const parsedData = orderSchema.parse(orderData);

        const tableNum = Number(parsedData.tableNum) === 0 ? null : Number(parsedData.tableNum);

        let { status, paymentMethod } = checkStatus(parsedData.orderType, parsedData.paymentStatus, parsedData.paymentMethod);


        await transaction.begin();
        transactionStarted = true;
        let orderId;
        let invoiceNum;

        if (parsedData.orderType === 'طاولة') {
            orderId = await insertOrder(adminId, null, null, parsedData.totalPrice, intDiscount, paymentMethod, parsedData.orderType, status, tableNum, transaction);
            await addOrderToTable(orderId, parsedData.tableNum, transaction);
        }
        else {
            invoiceNum = await generateInvoiceInfo(sessionId, transaction);
            orderId = await insertOrder(adminId, sessionId, invoiceNum, parsedData.totalPrice, intDiscount, paymentMethod, parsedData.orderType, status, tableNum, transaction);

            const totalPaid = Number(parsedData.totalPrice) - Number(intDiscount);
            await addOrderPayment(orderId, sessionId, totalPaid, paymentMethod, transaction);
        }

        await insertItems(orderId, orderData.items, transaction);




        await transaction.commit();

        return res.status(200).json({
            success: true,
            invoiceNum,
            message: "تم إنشاء الطلب",
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


export const deleteOrder = async (req, res) => {
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
        const parsedData = cancelResonSchema.parse({ cancel_reason });


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

        await deleteOrderPayment(orderId, transaction);
        
        if (order.type === 'طاولة') {
            await closeTable(orderId, transaction);
        }


        await transaction.commit();


        return res.status(200).json({
            success: true,
            message: "تم حذف الطلب",
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


export const getDaliyOrders = async (req, res) => {
    const sessionId = Number(req.query.session_id);
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        await checkToken(token);

        let orders = await getOrderAndItemsBySession(sessionId, pool, sql);

        if (orders.length > 0) {
            orders = buildTreeOfOrders(orders);
        }

        return res.status(200).json({
            orders: orders
        });


    } catch (e) {
        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}


export const addNewItems = async (req, res) => {
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        await checkToken(token);

        const data = req.body;

        const orderId = Number(data.order_id);
        const totalPriceForNewItems = Number(data.total_price);
        const newItems = data.new_items;

        const currentItems = await getOrderItems(orderId);

        await transaction.begin();
        transactionStarted = true;


        await checkItems(currentItems, newItems, orderId, transaction);

        await updateTotalPrice(orderId, totalPriceForNewItems, transaction);

        await transaction.commit();

        return res.status(200).json({
            message: 'تم إضافة الأصناف'
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

export const editItemsOrder = async (req, res) => {
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }

        await checkToken(token);

        const items = req.body;

        if (items.length === 0) {
            throw new SystemError(
                "لا يمكن حذف جميع الأصناف من تعديل الطلب. لحذف الطلب بالكامل، استخدم زر حذف الطلب.",
                400
            );
        }

        const orderId = Number(items[0].order_id);
        const oldItems = await getOrderItems(orderId);


        await transaction.begin();
        transactionStarted = true;


        validatePaidQuantities(oldItems, items);

        const totalPrice = await updateOrderItemsQuantities(orderId, oldItems, items, transaction);


        await transaction
            .request()
            .input('total_price', sql.Decimal(9, 2), totalPrice)
            .input('id', sql.Int, orderId)
            .query(`
                UPDATE orders
                SET total_price = @total_price - discount
                WHERE id = @id
            `)
            ;



        await transaction.commit();

        return res.status(200).json({
            message: 'تم تعديل الطلب'
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


export const payOrder = async (req, res) => {
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        const adminId = await checkToken(token);

        const body = req.body;
        const orderId = Number(body.order_id);
        let discount = Number(body.new_discount);
        const paymentMethod = body.payment_method;

        const session = await checkSession(adminId, pool, sql);
        const hasOpeningSession = !!session;

        if (hasOpeningSession) {

            const order = await getOrderById(orderId);

            if (order.total_price < discount) {
                throw new SystemError("خطأ : قيمة الخصم أكبر من السعر الإجمالي", 400);
            }

            await transaction.begin();
            transactionStarted = true;

            const invoiceNum = await generateInvoiceInfo(session.id, transaction);

            const remaining = getRemainingAmount(order);

            if (remaining < discount) {
                throw new SystemError("خطأ : قيمة الخصم أكبر من السعر المتبقي", 400);
            }
            discount = roundDiscount(discount);

            const paymentAmount = remaining - discount;

            if (paymentMethod === 'كاش') {
                const request = transaction.request();

                request
                    .input('session_id', sql.Int, session.id)
                    .input('invoice_num', sql.NVarChar, invoiceNum)
                    .input('discount', sql.Decimal(15, 2), discount)
                    .input('payment_method', sql.NVarChar, paymentMethod)
                    .input('status', sql.NVarChar, 'مكتمل')
                    .input('payment_amount', sql.Decimal(18, 2), paymentAmount)
                    .input('order_id', sql.Int, orderId);

                await request.query(`
                    UPDATE orders
                    SET 
                        session_id = @session_id,
                        invoice_num = @invoice_num,
                        total_price = total_price - @discount,
                        payment_method = @payment_method,
                        discount = discount + @discount,
                        status = @status,
                        cash_paid = cash_paid + @payment_amount
                     WHERE id = @order_id
                `);


                await addOrderPayment(orderId, session.id, paymentAmount, paymentMethod, transaction);
            }

            else if (paymentMethod === 'بطاقة') {
                const request = transaction.request();

                request
                    .input('session_id', sql.Int, session.id)
                    .input('invoice_num', sql.NVarChar, invoiceNum)
                    .input('discount', sql.Decimal(15, 2), discount)
                    .input('payment_method', sql.NVarChar, paymentMethod)
                    .input('status', sql.NVarChar, 'مكتمل')
                    .input('payment_amount', sql.Decimal(18, 2), paymentAmount)
                    .input('order_id', sql.Int, orderId);

                await request.query(`
                    UPDATE orders
                    SET 
                        session_id = @session_id,
                        invoice_num = @invoice_num,
                        total_price = total_price - @discount,
                        payment_method = @payment_method,
                        discount = discount + @discount,
                        status = @status,
                        card_paid = card_paid + @payment_amount
                    WHERE id = @order_id
                `);

                await addOrderPayment(orderId, session.id, paymentAmount, paymentMethod, transaction);
            }

            else {
                throw new SystemError("طريقة الدفع غير صحيحة", 400);
            }




            await closeTable(orderId, transaction);



            await transaction.commit();

            return res.status(200).json({
                message: 'تم تسديد الطلب وإغلاق الطاولة بنجاح.'
            });


        }
        else {
            return res.status(400).json({
                message: 'خطأ : لا يوجد صندوق مفتوح , الرجاء فتح صندوق جديد قبل تسديد الطاولة.'
            });
        }

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

export const partialPayOrder = async (req, res) => {
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        const adminId = await checkToken(token);
        const body = req.body;

        const orderId = Number(body.order_id);
        const paymentMethod = body.payment_method;
        const selectedItems = body.items;

        const session = await checkSession(adminId, pool, sql);
        const hasOpeningSession = !!session;

        if (hasOpeningSession) {
            const oldItems = await getOrderItems(orderId);


            const { allRemainingItemsSelected, paidTotal, discountTotal } = checkPartialPayment(oldItems, selectedItems);

            if (allRemainingItemsSelected) {
                throw new SystemError(

                    "لا يمكن تسديد كامل الطلب باستخدام التسديد الجزئي , الرجاء إستخدام زر إغلاق الطاولة للتسديد الكامل",

                    400

                );
            }

            if (discountTotal > paidTotal) {
                throw new SystemError("خطأ : قيمة الخصم أكبر من السعر المتبقي", 400);
            }



            await transaction.begin();
            transactionStarted = true;

            await updatePaidQuantity(orderId, selectedItems, transaction);


            const partialPrice = paidTotal - discountTotal;


            if (paymentMethod === 'كاش') {

                const request = transaction.request();

                request.input('discountTotal', sql.Decimal(15, 2), discountTotal);
                request.input('partialPrice', sql.Decimal(18, 2), partialPrice);
                request.input('status', sql.NVarChar, 'مدفوع جزئي');
                request.input('orderId', sql.Int, orderId);

                await request.query(`
                    UPDATE orders
                    SET 
                        total_price = total_price - @discountTotal,
                        discount = discount + @discountTotal,
                        cash_paid = cash_paid + @partialPrice,
                        status = @status
                    WHERE id = @orderId
                `);

                await addOrderPayment(
                    orderId,
                    session.id,
                    partialPrice,
                    paymentMethod,
                    transaction
                );
            }

            else if (paymentMethod === 'بطاقة') {

                const request = transaction.request();

                request.input('discountTotal', sql.Decimal(15, 2), discountTotal);
                request.input('partialPrice', sql.Decimal(18, 2), partialPrice);
                request.input('status', sql.NVarChar, 'مدفوع جزئي');
                request.input('orderId', sql.Int, orderId);

                await request.query(`
                    UPDATE orders
                    SET 
                        total_price = total_price - @discountTotal,
                        discount = discount + @discountTotal,
                        card_paid = card_paid + @partialPrice,
                        status = @status
                    WHERE id = @orderId
                `);

                await addOrderPayment(
                    orderId,
                    session.id,
                    partialPrice,
                    paymentMethod,
                    transaction
                );
            }
            else {
                throw new SystemError("طريقة الدفع غير صحيحة", 400);
            }


            await transaction.commit();


            return res.status(200).json({
                message: 'تم تسديد جزئي من أصناف الطلب.',
            });


        }
        else {
            return res.status(400).json({
                message: 'خطأ : لا يوجد صندوق مفتوح , الرجاء فتح صندوق جديد قبل تسديد الطاولة.'
            });
        }



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


export const destroyOrderTable = async (req, res) => {
    const orderId = Number(req.query.order_id);
    try {
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
            message: 'تم حذف الطلب , و إغلاق الطاولة'
        })
    } catch (e) {
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
async function closeTable(orderId, transaction) {
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


async function getOrderItems(orderId) {
    const result = await pool
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

async function checkItems(currentItems, newItems, orderId, transaction) {
    let insertBatch = [];
    let updateBatch = [];


    newItems.forEach(item => {
        item.name = getSize(item.name);

        const existItem = currentItems.find(i => i.item_id === item.id && i.size_name === item.name);

        if (existItem) {
            updateBatch.push({
                id: existItem.id,
                quantity: existItem.quantity + item.qty
            });
        }
        else {
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
        request.input(`price${index}`, sql.Decimal(18, 2), item.price);
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

async function insertOrder(adminId, sessionId, invoiceNum, mainPrice, discount, paymentMethod, orderType, status, tableNum, transaction) {

    const totalPrice = mainPrice - discount;

    let cashPaid = 0;
    let cardPaid = 0;

    if (status === 'مكتمل') {
        if (paymentMethod === 'كاش') {
            cashPaid = totalPrice;
        }
        else {
            cardPaid = totalPrice;
        }
    }

    const currentTimeStamp = new Date();
    const result = await transaction
        .request()
        .input('admin_id', sql.Int, adminId)
        .input('session_id', sql.Int, sessionId)
        .input('invoice_num', sql.NVarChar, invoiceNum)
        .input('total_price', sql.Decimal(18, 2), totalPrice)
        .input('discount', sql.Decimal(15, 2), discount)
        .input('payment_method', sql.NVarChar, paymentMethod)
        .input('status', sql.NVarChar, status)
        .input('type', sql.NVarChar, orderType)
        .input("created_at", sql.DateTime2, currentTimeStamp)
        .input('table_num', tableNum)
        .input('cash_paid', sql.Decimal(18, 2), cashPaid)
        .input('card_paid', sql.Decimal(18, 2), cardPaid)
        .query(`
            INSERT INTO orders (admin_id, session_id, invoice_num, total_price, discount, payment_method, status, type, created_at, table_num, cash_paid, card_paid)
            OUTPUT INSERTED.id
            VALUES (@admin_id, @session_id, @invoice_num, @total_price, @discount, @payment_method, @status, @type, @created_at, @table_num, @cash_paid, @card_paid)
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
            (@order_id${index}, @item_id${index}, @quantity${index}, @price${index}, @size_name${index}, @discount_item${index})
        `);
        request.input(`order_id${index}`, sql.Int, orderId);
        request.input(`item_id${index}`, sql.Int, item.id);
        request.input(`quantity${index}`, sql.Int, item.qty);
        request.input(`price${index}`, sql.Decimal(15, 2), item.price);
        request.input(`size_name${index}`, sql.NVarChar, item.sizeName || 'NaN');
        request.input(`discount_item${index}`, sql.Decimal(15, 2), item.discount_item || 0);
    });

    const query = `
        INSERT INTO order_items 
        (order_id, item_id, quantity, price, size_name, discount_item)
        VALUES ${values.join(", ")}
    `;

    await request.query(query);
}



function checkStatus(orderType, paymentStatus, paymentMethod) {
    if (orderType === 'طاولة' && paymentStatus === 'unpaid') {
        return {
            status: 'غير مدفوع',
            paymentMethod: 'غير محدد'
        };
    }
    else {
        return {
            status: 'مكتمل',
            paymentMethod: paymentMethod
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


async function addOrderPayment(orderId, sessionId, amount, paymentMethod, transaction) {

    await transaction.request()
        .input('order_id', sql.Int, orderId)
        .input('session_id', sql.Int, sessionId)
        .input('amount', sql.Decimal(18, 2), amount)
        .input(`pay_method`, sql.NVarChar, paymentMethod)

        .query(`
            INSERT INTO order_payments (order_id, session_id, amount, payment_method)
            VALUES (@order_id, @session_id, @amount, @pay_method)
        `)
        ;
}



async function updateOrderItemsQuantities(orderId, oldItems, newItems, transaction) {

    const updates = [];
    const deleteIds = [];

    let totalPrice = 0;

    for (const oldItem of oldItems) {

        const newItem = newItems.find(
            item => Number(item.order_item_id) === Number(oldItem.id)
        );

        if (newItem) {

            if (newItem.quantity != oldItem.quantity) {
                updates.push({
                    id: oldItem.id,
                    quantity: newItem.quantity
                });
            }

            totalPrice += Number(newItem.price) * Number(newItem.quantity);

        } else {
            deleteIds.push(oldItem.id);
        }
    }


    // UPDATE دفعة واحدة
    if (updates.length > 0) {

        const cases = updates
            .map((_, index) => `WHEN id = @id${index} THEN @quantity${index}`)
            .join(" ");

        const request = transaction.request();

        updates.forEach((item, index) => {
            request.input(`id${index}`, sql.Int, item.id);
            request.input(`quantity${index}`, sql.Int, item.quantity);
        });

        request.input("order_id", sql.Int, orderId);

        await request.query(`
            UPDATE order_items
            SET quantity = CASE
                ${cases}
                ELSE quantity
            END
            WHERE order_id = @order_id
        `);
    }


    // DELETE دفعة واحدة
    if (deleteIds.length > 0) {

        const placeholders = deleteIds
            .map((_, index) => `@deleteId${index}`)
            .join(", ");

        const request = transaction.request();

        request.input("order_id", sql.Int, orderId);

        deleteIds.forEach((id, index) => {
            request.input(`deleteId${index}`, sql.Int, id);
        });

        await request.query(`
            DELETE FROM order_items
            WHERE order_id = @order_id
            AND id IN (${placeholders})
        `);
    }

    return totalPrice;
}

async function deleteOrderPayment(orderId, transaction) {

    await transaction.request()
        .input('order_id', sql.Int, orderId)
        .query(`
            DELETE FROM order_payments
            WHERE order_id = @order_id
        `);
}

function validatePaidQuantities(oldItems, newItems) {
    for (const oldItem of oldItems) {

        const newItem = newItems.find(
            item => Number(item.order_item_id) === Number(oldItem.id)
        );

        const paidQuantity = Number(oldItem.paid_quantity || 0);
        const newQuantity = newItem
            ? Number(newItem.quantity || 0)
            : 0;

        if (newQuantity < paidQuantity) {
            throw new SystemError(
                "لا يمكن تعديل أو حذف صنف تم تسديد جزء منه مسبقًا.",
                400
            );
        }
    }
}


function roundDiscount(discount) {
    if (discount === 0) return 0;

    const firstDecimal = Math.floor(discount * 10) % 10;

    return Math.floor(discount) + (firstDecimal >= 4 ? 1 : 0);
}

function getRemainingAmount(order) {
    const total = Number(order.total_price || 0);
    const cashPaid = Number(order.cash_paid || 0);
    const cardPaid = Number(order.card_paid || 0);

    const paid = cashPaid + cardPaid;

    return total - paid;
}


function checkPartialPayment(oldItems, selectedItems) {
    let paidTotal = 0;
    let discountTotal = 0;
    let allRemainingItemsSelected = true;

    oldItems
        .filter(item => Number(item.paid_quantity) < Number(item.quantity))
        .forEach(item => {

            const selected = selectedItems.find(
                x => Number(x.order_item_id) === Number(item.id)
            );

            // الصنف المتبقي ولم يتم اختياره
            if (!selected) {
                allRemainingItemsSelected = false;
                return;
            }

            const remaining =
                Number(item.quantity) - Number(item.paid_quantity);

            const paidQuantity =
                Number(selected.paid_quantity);

            const discountPercentage =
                Number(selected.discount_percentage || 0);

            const itemTotal =
                paidQuantity * Number(item.price);

            // إجمالي المبلغ قبل الخصم
            paidTotal += itemTotal;

            // قيمة الخصم لهذه الدفعة
            let discountValue =
                itemTotal * (discountPercentage / 100);

            discountValue = roundDiscount(discountValue);

            // الخصم التراكمي للصنف
            selected.discount_item =
                Number(item.discount_item || 0) + discountValue;

            // مجموع الخصم لهذه الدفعة
            discountTotal += discountValue;

            // إذا لم يتم دفع كل الكمية المتبقية
            if (paidQuantity !== remaining) {
                allRemainingItemsSelected = false;
            }
        });

    return {
        allRemainingItemsSelected,
        paidTotal,
        discountTotal
    };
}

async function updatePaidQuantity(orderId, selectedItems, transaction) {

    const ids = selectedItems.map(item =>
        Number(item.order_item_id)
    );

    const casePaidQuantity = selectedItems
        .map((_, index) => `WHEN id = @paidId${index} THEN paid_quantity + @paidQuantity${index}`)
        .join(' ');

    const caseDiscount = selectedItems
        .map((_, index) => `WHEN id = @discountId${index} THEN @discount${index}`)
        .join(' ');

    const request = transaction.request();

    // paid_quantity
    selectedItems.forEach((item, index) => {
        request.input(
            `paidId${index}`,
            sql.Int,
            Number(item.order_item_id)
        );

        request.input(
            `paidQuantity${index}`,
            sql.Int,
            Number(item.paid_quantity)
        );
    });

    // discount_item
    selectedItems.forEach((item, index) => {
        request.input(
            `discountId${index}`,
            sql.Int,
            Number(item.order_item_id)
        );

        request.input(
            `discount${index}`,
            sql.Int,
            Number(item.discount_item)
        );
    });

    request.input("order_id", sql.Int, orderId);

    const idPlaceholders = ids
        .map((_, index) => `@itemId${index}`)
        .join(', ');

    ids.forEach((id, index) => {
        request.input(`itemId${index}`, sql.Int, id);
    });

    await request.query(`
        UPDATE order_items
        SET
            paid_quantity = CASE
                ${casePaidQuantity}
                ELSE paid_quantity
            END,

            discount_item = CASE
                ${caseDiscount}
                ELSE discount_item
            END

        WHERE order_id = @order_id
        AND id IN (${idPlaceholders})
    `);
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