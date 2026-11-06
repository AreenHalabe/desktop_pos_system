import { pool, sql } from "../DataBaseConnections/dbconnection.js";
import { SystemError } from "../shared/functionality.js";
import { z } from "zod";


export const createOrder = async (req, res) => {
    const sessionId = Number(req.query.session_id);
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;
    try {
        const orderData = req.body;

        if (orderData.discount_amount > orderData.total_price) {
            throw new SystemError("قيمه الخصم اكبر من السعر الأساسي", 400);
        }

        const parsedData = invoiceSchema.parse(orderData);


        await transaction.begin();
        transactionStarted = true;

        const orderId = await insertOrder(sessionId, parsedData.total_price, orderData.discount_amount, parsedData.total_discount_percentage, parsedData.payment_method, 'مكتمل', transaction);
        await insertItems(orderId, parsedData.items, transaction);

        await transaction.commit();

        return res.status(200).json({
            success: true,
            message: "تم حفظ الطلب على الجهاز , بسبب إنقطاع الإنترنت",
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





export const getAllOrders = async (req, res) => {
    try {
        let orders = await getAllOrderAndItems();
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


export const deleteSyncedOrder = async (req, res) => {
    let transaction;

    try {

        const { orderIds } = req.body;

        if (!Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "يجب إرسال أرقام الطلبات المراد حذفها",
            });
        }

        const ids = [...new Set(orderIds.map(Number))];

        if (ids.some(id => !Number.isSafeInteger(id) || id <= 0)) {
            return res.status(400).json({
                success: false,
                message: "أرقام الطلبات غير صحيحة",
            });
        }

        transaction = new sql.Transaction(pool);

        await transaction.begin();

        const request = new sql.Request(transaction);

        const parameters = ids.map((id, index) => {
            const paramName = `id${index}`;
            request.input(paramName, sql.Int, id);
            return `@${paramName}`;
        });

        const result = await request.query(`
            DELETE FROM orders
            WHERE id IN (${parameters.join(', ')});
        `);

        await transaction.commit();

        return res.status(200).json({
            success: true,
            message: "تم حذف الطلبات بنجاح",
            deletedCount: result.rowsAffected[0],
        });

    } catch (e) {

        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error("Rollback Error:", rollbackError);
            }
        }

        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
};






async function insertOrder(sessionId, mainPrice, discount, totalDiscountPercentage, paymentMethod, status, transaction) {

    const totalPrice = mainPrice - discount;

    const currentTimeStamp = new Date();
    const result = await transaction
        .request()
        .input('session_id', sql.Int, sessionId)
        .input('total_price', sql.Decimal(15, 2), totalPrice)
        .input('discount', sql.Decimal(15, 2), discount)
        .input('total_discount_percentage', sql.Decimal(5, 2), totalDiscountPercentage)
        .input('payment_method', sql.NVarChar, paymentMethod)
        .input('status', sql.NVarChar, status)
        .input("created_at", sql.DateTime2, currentTimeStamp)
        .query(`
            INSERT INTO orders (session_id, total_price, discount, total_discount_percentage, payment_method, status, created_at)
            OUTPUT INSERTED.id
            VALUES (@session_id, @total_price, @discount, @total_discount_percentage, @payment_method, @status, @created_at)
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
            (@order_id${index}, @item_id${index}, @quantity${index}, @price${index}, @unit${index}, @discount_item${index}, @conversion_factor${index}, @item_name${index})
        `);
        request.input(`order_id${index}`, sql.Int, orderId);
        request.input(`item_id${index}`, sql.Int, item.item_id);
        request.input(`quantity${index}`, sql.Int, item.quantity);
        request.input(`price${index}`, sql.Decimal(15, 2), item.unit_price);
        request.input(`unit${index}`, sql.NVarChar, item.unit_name);
        request.input(`discount_item${index}`, sql.Decimal(7, 2), item.discount_item);
        request.input(`conversion_factor${index}`, sql.Decimal(15, 2), item.conversion_factor);
        request.input(`item_name${index}`, sql.NVarChar, item.item_name);
    });

    const query = `
        INSERT INTO order_items 
        (order_id, item_id, quantity, price, unit, discount_item, conversion_factor, item_name)
        VALUES ${values.join(", ")}
    `;

    await request.query(query);
}



async function getAllOrderAndItems() {
    const result = await pool
        .request()
        .query(`
            SELECT
                o.*,
                io.id AS order_item_id,
                io.order_id,
                io.item_id,
                io.quantity,
                io.price,
                io.unit,
                io.discount_item,
                io.conversion_factor,
                io.item_name
            FROM (
                SELECT TOP (20) *
                FROM orders
                ORDER BY id ASC
            ) o
            LEFT JOIN order_items io
                ON o.id = io.order_id
            ORDER BY o.id ASC;
        `);

    return result.recordset;
}




function buildTreeOfOrders(rows) {
    if (!rows || rows.length === 0) {
        return {
            complete_orders: [],
        };
    }

    const ordersMap = new Map();
    const completeOrders = [];

    for (const row of rows) {
        let order = ordersMap.get(row.id);

        if (!order) {
            order = {
                id: row.id,
                session_id: row.session_id,
                total_price: row.total_price,
                discount: row.discount,
                payment_method: row.payment_method,
                status: row.status,
                created_at: row.created_at,
                total_discount_p: row.total_discount_percentage,
                items: []
            };

            ordersMap.set(row.id, order);
            completeOrders.push(order);
        }

        if (row.order_id) {
            order.items.push({
                order_item_id: row.order_item_id,
                order_id: row.order_id,
                item_id: row.item_id,
                quantity: row.quantity,
                unit_price: row.price,
                unit_name: row.unit,
                discount_item: row.discount_item,
                conversion_factor: row.conversion_factor,
                item_name: row.item_name
            });
        }
    }

    return {
        complete_orders: completeOrders
    };
}









const invoiceItemSchema = z.object({
    item_id: z.preprocess(
        val => Number(val),
        z.number()
            .int("معرّف الصنف يجب أن يكون عددًا صحيحًا")
            .positive("معرّف الصنف غير صالح")
    ),

    item_name: z.string()
        .trim()
        .min(1, "اسم الصنف مطلوب"),

    unit_id: z.preprocess(
        val => Number(val),
        z.number()
            .int("معرّف الوحدة يجب أن يكون عددًا صحيحًا")
            .positive("الوحدة غير صالحة")
    ),

    unit_name: z.string()
        .trim()
        .min(1, "اسم الوحدة مطلوب"),

    unit_price: z.preprocess(
        val => Number(val),
        z.number()
            .nonnegative("سعر الوحدة لا يمكن أن يكون سالبًا")
    ),

    conversion_factor: z.preprocess(
        val => Number(val),
        z.number()
            .positive("معامل التحويل يجب أن يكون أكبر من صفر")
    ),

    quantity: z.preprocess(
        val => Number(val),
        z.number()
            .int("الكمية يجب أن تكون عددًا صحيحًا")
            .positive("الكمية يجب أن تكون أكبر من صفر")
    ),

    discount_item: z.preprocess(
        val => Number(val),
        z.number()
            .min(0, "الخصم لا يمكن أن يكون سالبًا")
            .max(100, "نسبة الخصم لا يمكن أن تتجاوز 100%")
    )
});

const invoiceSchema = z.object({
    items: z.array(invoiceItemSchema)
        .min(1, "يجب إضافة صنف واحد على الأقل للفاتورة"),

    total_discount_percentage: z.preprocess(
        val => Number(val),
        z.number()
            .min(0, "الخصم لا يمكن أن يكون سالبًا")
            .max(100, "نسبة الخصم لا يمكن أن تتجاوز 100%")
    ),

    total_price: z.preprocess(
        val => Number(val),
        z.number()
            .nonnegative("إجمالي الفاتورة لا يمكن أن يكون سالبًا")
    ),

    discount_amount: z.preprocess(
        val => Number(val),
        z.number()
            .nonnegative("قيمة الخصم لا يمكن أن تكون سالبة")
    ),
    payment_method: z.enum(["كاش", "بطاقة"], {
        errorMap: () => ({ message: "يجب اختيار طريقة الدفع" })
    }),
});
