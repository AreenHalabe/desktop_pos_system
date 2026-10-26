import { pool, sql } from "../DataBaseConnections/dbconnection.js";
import { checkToken, SystemError, buildTreeOfOrders } from "../shared/functionality.js";
import { getOrderAndItemsBySession } from "../shared/api.js";
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

        if (orderData.discount_amount > orderData.total_price) {
            throw new SystemError("قيمه الخصم اكبر من السعر الأساسي", 400);
        }


        const parsedData = invoiceSchema.parse(orderData);


        await transaction.begin();
        transactionStarted = true;

        const invoiceNum = await generateInvoiceInfo(sessionId, transaction);
        const orderId = await insertOrder(adminId, sessionId, invoiceNum, parsedData.total_price, orderData.discount_amount, parsedData.total_discount_percentage, parsedData.payment_method, 'مكتمل', transaction);

        const { items, updateStockBatches, deleteStockBatches } = await handleCostPriceForEachStock(parsedData.items);


        await runUpdateStockBatches(updateStockBatches, transaction);
        await runDeleteStockBatches(deleteStockBatches, transaction);
        await insertItems(orderId, items, transaction);

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


        const {
            orderItems,
            stockBatches,
            unitConversionFactors
        } = await getOrderDataForStockRestore(orderId);


        const updateStockBatchesData = prepareStockBatchesRestore(
            orderItems,
            stockBatches,
            unitConversionFactors
        );

        await transaction.begin();
        transactionStarted = true;


        await updateStockBatchesQuery(updateStockBatchesData, transaction);





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



export const restoreOrderItems = async (req, res) => {
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }

        await checkToken(token);

        const body = req.body;

        if(body.items.length === 0){
            throw new SystemError(
                "لا يمكن إرجاع جميع أصناف الطلب بهذه الطريقة. إذا كنت ترغب في حذف الطلب بالكامل، يُرجى استخدام زر الحذف المخصص لذلك.",
                400
            );
        }

        const currentTimestamp = new Date();


        const {
            orderItems,
            stockBatches,
            unitConversionFactors
        } = await getOrderDataForStockRestore(Number(body.id));

        const {
            itemsToUpdate,
            itemsToDelete,
            deletedItems,
            stockReturns
        } = compareOrderItems(orderItems, body.items, unitConversionFactors);

        const updateStockBatches = prepareStockBatchesRestoreItems(stockReturns, stockBatches);

        
        await transaction.begin();
        transactionStarted = true;

        
        await updateStockBatchesQuery(updateStockBatches, transaction);


        await transaction.request()
            .input('id', sql.Int, Number(body.id))
            
            .input('total_price', sql.Decimal(15, 2), (body.total_price))

            .input('discount', sql.Decimal(15, 2), Number(body.discount))
            
            .input('updated_at', sql.DateTime2, currentTimestamp)
            .query(`
                UPDATE orders
                SET total_price = @total_price, discount = @discount, updated_at = @updated_at
                WHERE id=@id
            `);
        ;

        await updateOrderItems(itemsToUpdate, transaction);
        await deleteOrderItems(itemsToDelete, transaction);


        await insertDeletedItems(deletedItems, body.id, currentTimestamp, transaction);


        await transaction.commit();


        return res.status(200).json({
            success: true,
            message: "تم تعديل الطلب بنجاح",
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
async function insertOrder(adminId, sessionId, invoiceNum, mainPrice, discount, totalDiscountPercentage, paymentMethod, status, transaction) {

    const totalPrice = mainPrice - discount;

    const currentTimeStamp = new Date();
    const result = await transaction
        .request()
        .input('admin_id', sql.Int, adminId)
        .input('session_id', sql.Int, sessionId)
        .input('invoice_num', sql.NVarChar, invoiceNum)
        .input('total_price', sql.Decimal(15, 2), totalPrice)
        .input('discount', sql.Decimal(15, 2), discount)
        .input('total_discount_percentage', sql.Decimal(5, 2), totalDiscountPercentage)
        .input('payment_method', sql.NVarChar, paymentMethod)
        .input('status', sql.NVarChar, status)
        .input("created_at", sql.DateTime2, currentTimeStamp)
        .query(`
            INSERT INTO orders (admin_id, session_id, invoice_num, total_price, discount, total_discount_percentage, payment_method, status, created_at)
            OUTPUT INSERTED.id
            VALUES (@admin_id, @session_id, @invoice_num, @total_price, @discount, @total_discount_percentage, @payment_method, @status, @created_at)
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
            (@order_id${index}, @item_id${index}, @quantity${index}, @price${index}, @cost_price${index}, @unit${index}, @discount_item${index}, @conversion_factor${index})
        `);
        request.input(`order_id${index}`, sql.Int, orderId);
        request.input(`item_id${index}`, sql.Int, item.item_id);
        request.input(`quantity${index}`, sql.Int, item.quantity);
        request.input(`price${index}`, sql.Decimal(15, 2), item.unit_price);
        request.input(`cost_price${index}`, sql.Decimal(15, 3), item.cost_price);
        request.input(`unit${index}`, sql.NVarChar, item.unit_name);
        request.input(`discount_item${index}`, sql.Decimal(7, 2), item.discount_item);
        request.input(`conversion_factor${index}`, sql.Decimal(15, 2), item.conversion_factor);
    });

    const query = `
        INSERT INTO order_items 
        (order_id, item_id, quantity, price, cost_price, unit, discount_item, conversion_factor)
        VALUES ${values.join(", ")}
    `;

    await request.query(query);
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
async function handleCostPriceForEachStock(items) {
    const updateStockBatches = new Map();
    const deleteStockBatches = new Map();
    const remainingQtyByBatch = new Map();

    const batchesByItemId = await getAllBatchesForItems(items);

    for (const item of items) {
        const stockBatches = batchesByItemId.get(Number(item.item_id)) ?? [];

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
                const newRemainingQty = Math.max(0, currentRemainingQty - quantityInPieces);

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

async function runUpdateStockBatches(updateStockBatches, transaction) {
    if (updateStockBatches.length === 0) {
        return;
    }

    const request = transaction.request();

    const values = updateStockBatches.map((batch, index) => {
        request.input(`id${index}`, sql.Int, batch.id);
        request.input(
            `remainingQty${index}`,
            sql.Decimal(18, 2),
            batch.remaining_qty
        );

        return `(@id${index}, @remainingQty${index})`;
    });

    await request.query(`
        UPDATE sb
        SET sb.remaining_qty = v.remaining_qty
        FROM stock_batches AS sb
        INNER JOIN (
            VALUES ${values.join(", ")}
        ) AS v(id, remaining_qty)
            ON sb.id = v.id;
    `);
}
async function runDeleteStockBatches(deleteStockBatches, transaction) {
    if (deleteStockBatches.length === 0) {
        return;
    }

    const request = transaction.request();

    const parameters = deleteStockBatches.map((batch, index) => {
        request.input(`id${index}`, sql.Int, batch.id);
        return `@id${index}`;
    });

    await request.query(`
        DELETE FROM stock_batches
        WHERE id IN (${parameters.join(", ")});
    `);
}





async function getOrderItems(orderId) {
    const request = pool.request();

    request.input("orderId", sql.Int, orderId);

    const result = await request.query(`
        SELECT 
            id,
            item_id,
            quantity,
            unit as unit_name
        FROM order_items
        WHERE order_id = @orderId;
    `);

    return result.recordset;
}
async function getStockBatchesByOrderItems(orderItems) {
    const itemIds = [
        ...new Set(
            orderItems.map(item => Number(item.item_id))
        )
    ];

    if (itemIds.length === 0) {
        return [];
    }

    const request = pool.request();

    const parameters = itemIds.map((itemId, index) => {
        request.input(`itemId${index}`, sql.Int, itemId);
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
        ORDER BY item_id ASC, id ASC;
    `);

    return result.recordset;
}
async function getItemsUnitConversionFactors(orderItems) {
    const uniqueUnits = new Map();

    for (const item of orderItems) {
        const key = JSON.stringify([
            Number(item.item_id),
            item.unit_name
        ]);

        if (!uniqueUnits.has(key)) {
            uniqueUnits.set(key, {
                item_id: Number(item.item_id),
                unit_name: item.unit_name
            });
        }
    }

    const units = [...uniqueUnits.values()];

    if (units.length === 0) {
        return [];
    }

    const request = pool.request();

    const values = units.map((unit, index) => {
        request.input(`itemId${index}`, sql.Int, unit.item_id);
        request.input(
            `unitName${index}`,
            sql.NVarChar(100),
            unit.unit_name
        );

        return `(@itemId${index}, @unitName${index})`;
    });

    const result = await request.query(`
        SELECT
            iu.item_id,
            iu.unit_name,
            iu.conversion_factor
        FROM (
            VALUES ${values.join(", ")}
        ) AS requested(item_id, unit_name)
        INNER JOIN items_units AS iu
            ON iu.item_id = requested.item_id
            AND iu.unit_name = requested.unit_name;
    `);

    return result.recordset;
}

async function getOrderDataForStockRestore(orderId) {
    const orderItems = await getOrderItems(orderId);

    if (orderItems.length === 0) {
        return {
            orderItems: [],
            stockBatches: [],
            unitConversionFactors: []
        };
    }

    const [
        stockBatches,
        unitConversionFactors
    ] = await Promise.all([
        getStockBatchesByOrderItems(orderItems),
        getItemsUnitConversionFactors(orderItems)
    ]);

    return {
        orderItems,
        stockBatches,
        unitConversionFactors
    };
}



function prepareStockBatchesRestore(orderItems, stockBatches, unitConversionFactors) {
    const updateStockBatches = new Map();
    const batchesByItemId = new Map();
    const conversionFactorByUnit = new Map();

    // تجميع الدفعات حسب الصنف
    for (const batch of stockBatches) {
        const itemId = Number(batch.item_id);

        if (!batchesByItemId.has(itemId)) {
            batchesByItemId.set(itemId, []);
        }

        batchesByItemId.get(itemId).push({
            ...batch,
            quantity: Number(batch.quantity),
            remaining_qty: Number(batch.remaining_qty)
        });
    }

    // تجهيز معاملات التحويل
    for (const unit of unitConversionFactors) {
        const key = JSON.stringify([
            Number(unit.item_id),
            unit.unit_name
        ]);

        conversionFactorByUnit.set(
            key,
            Number(unit.conversion_factor)
        );
    }

    for (const item of orderItems) {
        const itemId = Number(item.item_id);

        const conversionKey = JSON.stringify([
            itemId,
            item.unit_name
        ]);

        const conversionFactor =
            conversionFactorByUnit.get(conversionKey);


        let qtyToRestore = Number(item.quantity) * conversionFactor;

        const batches = batchesByItemId.get(itemId);

        const firstBatch = batches[0];

        // إذا في دفعة واحدة، نرجّع الكمية كاملة إلها
        if (batches.length === 1) {
            const newRemainingQty =
                firstBatch.remaining_qty + qtyToRestore;

            firstBatch.remaining_qty = newRemainingQty;

            updateStockBatches.set(firstBatch.id, {
                id: firstBatch.id,
                remaining_qty: newRemainingQty
            });

            continue;
        }

        // إذا الدفعة الأولى فيها متبقي، نرجع الكمية كاملة إلها
        if (firstBatch.remaining_qty > 0) {
            const newRemainingQty =
                firstBatch.remaining_qty + qtyToRestore;

            firstBatch.remaining_qty = newRemainingQty;

            updateStockBatches.set(firstBatch.id, {
                id: firstBatch.id,
                remaining_qty: newRemainingQty
            });

            continue;
        }

        for (let i = 1; i < batches.length; i++) {
            if (qtyToRestore <= 0) {
                break;
            }

            const batch = batches[i];

            const availableCapacity = Math.max(
                0,
                batch.quantity - batch.remaining_qty
            );

            const qtyToAdd = Math.min(
                qtyToRestore,
                availableCapacity
            );

            if (qtyToAdd <= 0) {
                continue;
            }

            batch.remaining_qty += qtyToAdd;

            updateStockBatches.set(batch.id, {
                id: batch.id,
                remaining_qty: batch.remaining_qty
            });

            qtyToRestore -= qtyToAdd;
        }

        // إذا بقيت كمية، نرجعها للدفعة الأولى
        if (qtyToRestore > 0) {
            firstBatch.remaining_qty += qtyToRestore;

            updateStockBatches.set(firstBatch.id, {
                id: firstBatch.id,
                remaining_qty: firstBatch.remaining_qty
            });
        }
    }

    return [...updateStockBatches.values()];
}


async function updateStockBatchesQuery(updateStockBatches, transaction) {
    if (updateStockBatches.length === 0) {
        return;
    }

    const request = transaction.request();

    const values = updateStockBatches.map((batch, index) => {
        request.input(`id${index}`, sql.Int, batch.id);

        request.input(
            `remainingQty${index}`,
            sql.Decimal(18, 2),
            batch.remaining_qty
        );

        return `(@id${index}, @remainingQty${index})`;
    });

    await request.query(`
        UPDATE sb
        SET sb.remaining_qty = v.remaining_qty
        FROM stock_batches AS sb
        INNER JOIN (
            VALUES ${values.join(", ")}
        ) AS v(id, remaining_qty)
            ON sb.id = v.id;
    `);
}





function compareOrderItems(oldItems, newItems, unitConversionFactors) {

    const itemsToUpdate = [];
    const itemsToDelete = [];
    const deletedItems = [];
    const stockReturnsMap = new Map();


    const newItemsMap = new Map(
        newItems.map(item => [
            Number(item.order_item_id),
            item
        ])
    );


    const conversionMap = new Map(
        unitConversionFactors.map(unit => [
            JSON.stringify([
                Number(unit.item_id),
                unit.unit_name
            ]),
            Number(unit.conversion_factor)
        ])
    );

    for (const oldItem of oldItems) {
        const newItem = newItemsMap.get(Number(oldItem.id));

        let returnedQty = 0;

        if (!newItem) {
            itemsToDelete.push({
                id: oldItem.id
            });
            returnedQty = Number(oldItem.quantity);
        } else {
            const newQty = Number(newItem.quantity);
            const oldQty = Number(oldItem.quantity);

            if (newQty > oldQty) {
                throw new Error(
                    `لا يمكن زيادة كمية الصنف ذي المعرف ${oldItem.id} في عملية الإرجاع`
                );
            }

            if (newQty < oldQty) {
                itemsToUpdate.push({
                    id: oldItem.id,
                    quantity: newQty
                });

                returnedQty = oldQty - newQty;
            }
        }

        // لا يوجد إرجاع للمخزون إذا لم تتغير الكمية
        if (returnedQty === 0) {
            continue;
        }

        deletedItems.push({
            item_id: Number(oldItem.item_id),
            unit_name: oldItem.unit_name,
            quantity: returnedQty
        });

        const itemId = Number(oldItem.item_id);
        const unitName = oldItem.unit_name;

        const conversionKey = JSON.stringify([
            itemId,
            unitName
        ]);

        const conversionFactor = conversionMap.get(conversionKey);


        // تحويل الكمية الراجعة إلى وحدة المخزون الأساسية
        const stockQty = returnedQty * conversionFactor;


        if (!stockReturnsMap.has(itemId)) {
            stockReturnsMap.set(itemId, {
                item_id: itemId,
                qty: 0
            });
        }

        stockReturnsMap.get(itemId).qty += stockQty;
    }

    return {
        itemsToUpdate,
        itemsToDelete,
        deletedItems,
        stockReturns: [...stockReturnsMap.values()]
    };
}
async function deleteOrderItems(itemsToDelete , transaction) {
    if (itemsToDelete.length === 0) {
        return;
    }

    const request = transaction.request();

    const values = itemsToDelete.map((item, index) => {
        request.input(`id${index}`, sql.Int, item.id);
        return `(@id${index})`;
    });

    await request.query(`
        DELETE FROM order_items
        WHERE id IN (
            SELECT id
            FROM (VALUES ${values.join(", ")}) AS requested(id)
        );
    `);
}
async function updateOrderItems(itemsToUpdate , transaction) {
    if (itemsToUpdate.length === 0) {
        return;
    }

    const request = transaction.request();

    const values = itemsToUpdate.map((item, index) => {
        request.input(`id${index}`, sql.Int, item.id);
        request.input(
            `quantity${index}`,
            sql.Decimal(18, 2),
            item.quantity
        );

        return `(@id${index}, @quantity${index})`;
    });

    await request.query(`
        UPDATE oi
        SET oi.quantity = requested.quantity
        FROM order_items AS oi
        INNER JOIN (
            VALUES ${values.join(", ")}
        ) AS requested(id, quantity)
            ON oi.id = requested.id;
    `);
}


function prepareStockBatchesRestoreItems(stockReturns, stockBatches) {
    const updateStockBatches = new Map();

    // تجميع الدفعات حسب الصنف مع الحفاظ على ترتيبها حسب id
    const batchesByItemId = new Map();

    for (const batch of stockBatches) {
        const itemId = Number(batch.item_id);

        if (!batchesByItemId.has(itemId)) {
            batchesByItemId.set(itemId, []);
        }

        batchesByItemId.get(itemId).push({
            ...batch,
            quantity: Number(batch.quantity),
            remaining_qty: Number(batch.remaining_qty)
        });
    }

    for (const stockReturn of stockReturns) {
        const itemId = Number(stockReturn.item_id);
        let qtyToRestore = Number(stockReturn.qty);

        const batches = batchesByItemId.get(itemId);

        if (!batches || batches.length === 0) {
            throw new Error(
                `لا توجد دفعات مخزون للصنف ${itemId}`
            );
        }

        // إذا في دفعة واحدة، نضيف كامل الكمية إلها
        if (batches.length === 1) {
            const firstBatch = batches[0];

            updateStockBatches.set(firstBatch.id, {
                id: firstBatch.id,
                remaining_qty:
                    firstBatch.remaining_qty + qtyToRestore
            });
            continue;
        }

        const firstBatch = batches[0];

        // إذا المتبقي في الدفعة الأولى أكبر من صفر،
        // نضيف كامل الكمية المرتجعة إلها
        if (firstBatch.remaining_qty > 0) {
            updateStockBatches.set(firstBatch.id, {
                id: firstBatch.id,
                remaining_qty:
                    firstBatch.remaining_qty + qtyToRestore
            });

            continue;
        }

        // إذا الدفعة الأولى فارغة، نبدأ بتعبئة الدفعات التالية
        for (let i = 1; i < batches.length; i++) {
            if (qtyToRestore <= 0) {
                break;
            }

            const batch = batches[i];

            // ما بنزيد الدفعة عن quantity
            const availableCapacity = Math.max(
                0,
                batch.quantity - batch.remaining_qty
            );

            if (availableCapacity === 0) {
                continue;
            }

            const qtyToAdd = Math.min(
                qtyToRestore,
                availableCapacity
            );

            updateStockBatches.set(batch.id, {
                id: batch.id,
                remaining_qty:
                    batch.remaining_qty + qtyToAdd
            });

            qtyToRestore -= qtyToAdd;
        }

        // إذا ضل جزء مرتجع، بنرجعه للدفعة الأولى
        if (qtyToRestore > 0) {
            updateStockBatches.set(firstBatch.id, {
                id: firstBatch.id,
                remaining_qty:
                    firstBatch.remaining_qty + qtyToRestore
            });
        }
    }

    return [...updateStockBatches.values()];
}

async function insertDeletedItems(deletedItems, orderId, deletedAt, transaction) {
    if (deletedItems.length === 0) {
        return;
    }

    const request = transaction.request();

    request.input("orderId", sql.Int, Number(orderId));
    request.input("deletedAt", sql.DateTime2, deletedAt);

    const values = deletedItems.map((item, index) => {
        request.input(
            `itemId${index}`,
            sql.Int,
            item.item_id
        );

        request.input(
            `unitName${index}`,
            sql.NVarChar(100),
            item.unit_name
        );

        request.input(
            `quantity${index}`,
            sql.Decimal(18, 2),
            item.quantity
        );

        return `(
            @itemId${index},
            @unitName${index},
            @quantity${index},
            @orderId,
            @deletedAt
        )`;
    });

    await request.query(`
        INSERT INTO deleted_items (
            item_id,
            unit_name,
            quantity,
            order_id,
            deleted_at
        )
        VALUES ${values.join(", ")};
    `);
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
