import { StatusCode } from "../HTTPSStatusCode/StatusCode.js";
import { pool, sql } from "../DataBaseConnections/dbconnection.js";
import { checkToken, SystemError, buildTreeOfOrders } from "../shared/functionality.js";
import { getOrderAndItemsBySession, checkSession } from "../shared/api.js";
import { z } from "zod";


export const createOrder = async (req, res) => {
    // const sessionId = Number(req.query.session_id);
    // const transaction = new sql.Transaction(pool);
    // let transactionStarted = false;
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        const adminId = await checkToken(token);

        const orderData = req.body;

        if (orderData.discount_amount > orderData.total_price) {
            throw new SystemError("قيمه الخصم اكبر من السعر الأساسي", 400);
        }


        const parsedData = invoiceSchema.parse(orderData);


        // await transaction.begin();
        // transactionStarted = true;

        // const invoiceNum = await generateInvoiceInfo(sessionId, transaction);
        // const orderId    = await insertOrder(adminId, sessionId, invoiceNum, parsedData.totalPrice, orderData.discount, parsedData.paymentMethod, parsedData.orderType, 'مكتمل', transaction);
        // await insertItems(orderId, orderData.items, transaction);



        // await transaction.commit();

        return res.status(200).json({
            success: true,
            invoiceNum: 5,
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

async function insertOrder(adminId, sessionId, invoiceNum, mainPrice, discount, paymentMethod, orderType, status, transaction) {

    const totalPrice = mainPrice - discount;

    const currentTimeStamp = new Date();
    const result = await transaction
        .request()
        .input('admin_id', sql.Int, adminId)
        .input('session_id', sql.Int, sessionId)
        .input('invoice_num', sql.NVarChar, invoiceNum)
        .input('total_price', sql.Decimal(10, 2), totalPrice)
        .input('discount', sql.Decimal(10, 2), discount)
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
        request.input(`price${index}`, sql.Decimal(10, 2), item.price);
        request.input(`size_name${index}`, sql.NVarChar, item.sizeName || 'NaN');
    });

    const query = `
        INSERT INTO order_items 
        (order_id, item_id, quantity, price, size_name)
        VALUES ${values.join(", ")}
    `;

    await request.query(query);
}



async function getAllBatchesForItem(itemId) {
    const batchesResult = await pool.request()
        .input("itemId", sql.Int, itemId)
        .query(`
            SELECT id, item_id, quantity, remaining_qty, cost_price
            FROM stock_batches
            WHERE item_id = @itemId
            ORDER BY id ASC
        `);

    return batchesResult.recordset;
}

async function getAllBatchesForItems(items) {
    const itemIds = [
        ...new Set(items.map(item => Number(item.item_id)))
    ];

    if (itemIds.length === 0) {
        return new Map();
    }

    const request = pool.request();

    const parameters = itemIds.map((id, index) => {
        request.input(`itemId${index}`, sql.Int, id);
        return `@itemId${index}`;
    });

    const result = await request.query(`
        SELECT
            id,
            item_id,
            quantity,
            remaining_qty,
            cost_price
        FROM stock_batches
        WHERE item_id IN (${parameters.join(", ")})
        ORDER BY id ASC
    `);

    const batchesByItemId = new Map();

    for (const batch of result.recordset) {
        if (!batchesByItemId.has(batch.item_id)) {
            batchesByItemId.set(batch.item_id, []);
        }

        batchesByItemId.get(batch.item_id).push(batch);
    }

    return batchesByItemId;
}



// async function handleCostPriceForEachStock(items) {
//     const updateStockBatches = [];
//     const deleteStockBatches = [];

//     for (const item of items) {
//         const stockBatches = await getAllBatchesForItem(item.item_id);

//         if (stockBatches.length === 1) {
//             const batch = stockBatches[0];
//             item.cost_price = batch.cost_price;
//             if (Number(batch.remaining_qty) != 0) {
//                 const newRemainingQty = Math.max(0, batch.remaining_qty - item.quantity);
//                 updateStockBatches.push({
//                     id: batch.id,
//                     remaining_qty: newRemainingQty
//                 });
//             }

//             continue;
//         }

//         let remainingQuantity = Number(item.quantity);
//         let totalConsumedQuantity = 0;
//         let totalConsumedCost = 0;
//         let lastBatchCostPrice = null;

//         for (let i = 0; i < stockBatches.length; i++) {

//             if (remainingQuantity <= 0) {
//                 break;
//             }

//             const batch = stockBatches[i];
//             const batchRemainingQty = Number(batch.remaining_qty);

//             if (batchRemainingQty <= 0) {
//                 continue;
//             }

//             const consumedQuantity = Math.min(batchRemainingQty, remainingQuantity);

//             lastBatchCostPrice = Number(batch.cost_price);

//             totalConsumedQuantity += consumedQuantity;
//             totalConsumedCost += consumedQuantity * Number(batch.cost_price);

//             const newRemainingQty = batchRemainingQty - consumedQuantity;

//             if (newRemainingQty === 0 && i !== 0) {

//                 deleteStockBatches.push({
//                     id: batch.id
//                 });

//             } else {

//                 updateStockBatches.push({
//                     id: batch.id,
//                     remaining_qty: newRemainingQty
//                 });

//             }

//             remainingQuantity -= consumedQuantity;
//         }

        
//         if (remainingQuantity > 0 && lastBatchCostPrice !== null) {
//             totalConsumedCost += remainingQuantity * lastBatchCostPrice;
//             totalConsumedQuantity += remainingQuantity;
//         }

//         if (totalConsumedQuantity > 0) {
//             item.cost_price = totalConsumedCost / totalConsumedQuantity;
//         }

//     }
// }

async function handleCostPriceForEachStock(items) {
    const updateStockBatches = new Map();
    const deleteStockBatches = new Map();
    const remainingQtyByBatch = new Map();

    const batchesByItemId = await getAllBatchesForItems(items);

    for (const item of items) {
        const stockBatches =
            batchesByItemId.get(Number(item.item_id)) ?? [];

        const quantityInPieces =
            Number(item.quantity) * Number(item.conversion_factor);

        if (quantityInPieces <= 0) {
            continue;
        }

        // تهيئة الكمية الحالية للدفعات عند أول استخدام
        for (const batch of stockBatches) {
            if (!remainingQtyByBatch.has(batch.id)) {
                remainingQtyByBatch.set(
                    batch.id,
                    Number(batch.remaining_qty)
                );
            }
        }

        // وجود باتش واحد فقط
        if (stockBatches.length === 1) {
            const batch = stockBatches[0];

            item.cost_price = Number(batch.cost_price);

            const currentRemainingQty =
                remainingQtyByBatch.get(batch.id);

            if (currentRemainingQty > 0) {
                const newRemainingQty = Math.max(
                    0,
                    currentRemainingQty - quantityInPieces
                );

                remainingQtyByBatch.set(batch.id, newRemainingQty);

                // الباتش الوحيد لا نحذفه
                setBatchUpdate(
                    updateStockBatches,
                    deleteStockBatches,
                    batch.id,
                    newRemainingQty
                );
            }

            continue;
        }

        // وجود أكثر من باتش
        let remainingQuantity = quantityInPieces;
        let totalConsumedQuantity = 0;
        let totalConsumedCost = 0;
        let lastBatchCostPrice = null;

        for (let i = 0; i < stockBatches.length; i++) {
            if (remainingQuantity <= 0) {
                break;
            }

            const batch = stockBatches[i];

            const currentRemainingQty =
                remainingQtyByBatch.get(batch.id);

            // تجاوز الباتش الفارغ
            if (currentRemainingQty <= 0) {
                continue;
            }

            const consumedQuantity = Math.min(
                currentRemainingQty,
                remainingQuantity
            );

            const batchCostPrice = Number(batch.cost_price);

            lastBatchCostPrice = batchCostPrice;

            totalConsumedQuantity += consumedQuantity;
            totalConsumedCost += consumedQuantity * batchCostPrice;

            const newRemainingQty =
                currentRemainingQty - consumedQuantity;

            remainingQtyByBatch.set(batch.id, newRemainingQty);

            // عدم حذف أول باتش حسب ترتيب id ASC
            if (newRemainingQty === 0 && i !== 0) {
                setBatchDelete(
                    updateStockBatches,
                    deleteStockBatches,
                    batch.id
                );
            } else {
                setBatchUpdate(
                    updateStockBatches,
                    deleteStockBatches,
                    batch.id,
                    newRemainingQty
                );
            }

            remainingQuantity -= consumedQuantity;
        }

        // حساب تكلفة النقص بسعر آخر باتش تم الاستهلاك منه
        if (remainingQuantity > 0 && lastBatchCostPrice !== null) {
            totalConsumedCost +=
                remainingQuantity * lastBatchCostPrice;

            totalConsumedQuantity += remainingQuantity;
        }

        if (totalConsumedQuantity > 0) {
            item.cost_price =
                totalConsumedCost / totalConsumedQuantity;
        }
    }

    return {
        items,
        updateStockBatches: [...updateStockBatches.values()],
        deleteStockBatches: [...deleteStockBatches.values()]
    };
}

function setBatchUpdate(
    updateMap,
    deleteMap,
    batchId,
    remainingQty
) {
    // الحالة النهائية لهذه الدفعة هي التحديث
    deleteMap.delete(batchId);

    updateMap.set(batchId, {
        id: batchId,
        remaining_qty: remainingQty
    });
}

function setBatchDelete(updateMap, deleteMap, batchId) {
    // الحالة النهائية لهذه الدفعة هي الحذف
    updateMap.delete(batchId);

    deleteMap.set(batchId, {
        id: batchId
    });
}

const cancelResonSchema = z.object({
    cancel_reason: z
        .string()
        .min(1, "يجب إدخال سبب إلغاء الطلب")
        .regex(/^[\p{L}\s]+$/u, "يسمح بالحروف فقط"),
});




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
