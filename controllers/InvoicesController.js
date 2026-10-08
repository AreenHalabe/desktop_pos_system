import { pool, sql } from "../DataBaseConnections/dbconnection.js";
import { checkToken, SystemError } from "../shared/functionality.js";
import { z } from "zod";


export const getInvoice = async (req, res) => {
    const invoiceId = Number(req.query.invoice_id);

    try {
        const token = req.headers.authorization;

        if (!token) {
            throw new SystemError(
                "إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى",
                401
            );
        }

        await checkToken(token);

        const result = await pool
            .request()
            .input('invoice_id', sql.Int, invoiceId)
            .query(`
                SELECT 
                    si.*,
                    it.name,
                    it.unit,
                    it.quantity,
                    it.cost_price
                FROM supplier_invoices si
                INNER JOIN invoice_items it
                    ON it.invoice_id = si.id
                WHERE si.id = @invoice_id
            `);

        const rows = result.recordset;

        const invoice = mapInvoiceDate(rows);

        return res.status(200).json({
            success: true,
            invoice
        });

    } catch (e) {

        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}


export const createInvoiceFromSupplier = async (req, res) => {
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;
    try {

        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        await checkToken(token);

        const invData = req.body;
        const parsedData = invoiceSchema.parse(invData);

        if (parsedData.discount > parsedData.total_price) {
            throw new SystemError("قيمه الخصم اكبر من السعر الأساسي", 400);
        }

        await transaction.begin();
        transactionStarted = true;
        const currentTimeStamp = new Date();

        const invoiceId = await createPayInvoice(parsedData, currentTimeStamp, transaction);

        await addInvoiceItems(invoiceId, parsedData.items, transaction);


        const {
            addNewStockBatchs,
            updateItemsStock,
        } = await prepareStockBatches(parsedData.items, invoiceId);

        // await updateStockBatches(updateStockBatchs, currentTimeStamp, transaction);
        
        await addNewStockBatches(addNewStockBatchs, currentTimeStamp, transaction);
        await updateStockItems(updateItemsStock, true, transaction);

        const totalPrice = parsedData.total_price - parsedData.discount;

        await updateBalanceForSupplier(parsedData.supplier_id, totalPrice, true, transaction);

        await transaction.commit();

        return res.status(200).json({
            success: true,
            message: "تم إنشاء الفاتورة",
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


export const payIncoice = async (req, res) => {
    const supplierId = Number(req.query.supplier_id);
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;
    try {

        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        await checkToken(token);

        const paymentData = req.body;
        const parsedData = paymentSchema.parse(paymentData);
        const supplier = await getSupplier(supplierId);
        let checkId = null;

        if (parsedData.amount > supplier.balance) {
            throw new SystemError("خطأ : قيمة الدُفعة أكبر من مستحقات المُورد", 400);
        }


        await transaction.begin();
        transactionStarted = true;

        await payment(supplierId, parsedData.amount, transaction);
        await updateBalanceForSupplier(supplierId, parsedData.amount, false, transaction);

        if (paymentData.paymentMethode === 'شيك') {
            const data = checkSchema.parse(paymentData);

            const amount = Number(paymentData.checkAmount) === 0 ? Number(paymentData.amount) : Number(paymentData.checkAmount);

            checkId = await addNewCheck(data.checkAccountName, data.checkNumber, data.bankName, supplier.name, amount, data.currency, data.dueDate, 'outgoing', 'pending', data.notes, transaction);
        }


        await savePaymentData(supplierId, paymentData, checkId, transaction);
        await transaction.commit();

        return res.status(200).json({
            success: true,
            message: "تم تسديد الدُفعة",
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
export const deleteInvoice = async (req, res) => {
    const invoiceId = Number(req.query.invoice_id);
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        await checkToken(token);

        
        const [invoice, invoiceItems] = await Promise.all([
            getInvoices(invoiceId),
            getIncoiceItems(invoiceId)
        ]);

        


        if (invoice.total_price == invoice.remaining) {
            await transaction.begin();
            transactionStarted = true;

            await removeQuantityOfInvoiceItemsFormStockBatches(invoiceItems, transaction);

            await transaction.request()
                .input('id', sql.Int, invoiceId)
                .query(`
                    DELETE FROM supplier_invoices WHERE id = @id
                `)
                ;

            await updateBalanceForSupplier(invoice.supplier_id, invoice.total_price, false, transaction);
            
            

            await transaction.commit();
        }
        else {
            throw new SystemError("لا يمكن حذف هذه الفاتورة, بسبب وجود دفعات مسجلة عليها", 400);
        }

        return res.status(200).json({
            success: true,
            message: "تم حذف الفاتورة",
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
export const deletePayment = async (req, res) => {
    const pay_id = Number(req.query.pay_id);
    const supplierId = Number(req.query.supplier_id);
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        await checkToken(token);

        const payment = await getPayment(pay_id);

        await transaction.begin();
        transactionStarted = true;

        await restorePayment(supplierId, payment.amount, transaction);

        await updateBalanceForSupplier(supplierId, payment.amount, true, transaction);


        if (payment.payment_methode === 'شيك') {
            await deleteCheck(payment.check_id, transaction)
        }

        else {
            await deletePaymentRecord(pay_id, transaction);
        }

        await transaction.commit();


        return res.status(200).json({ success: true, message: "تم حذف الدقعة", });

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

export const editInvoice = async(req , res) =>{
    const supplierId = Number(req.query.supplier_id);
    const currentInvoiceId  = Number(req.query.invoice_id);

    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;
    try {

        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        await checkToken(token);

        const invData = req.body;
        const parsedData = invoiceSchema.parse(invData);

        if (invData.discount > invData.total_price) {
            throw new SystemError("قيمه الخصم اكبر من السعر الأساسي", 400);
        }

        let date = invData.invoice_date_time;

        const currentInvoice = await getInvoices(currentInvoiceId);



        if(currentInvoice.total_price !== currentInvoice.remaining){
            throw new SystemError("حطأ: لا يمكن تعديل فاتورة تم تسديد دفعات عليها", 400);
        }


        await transaction.begin();
        transactionStarted = true;

        await updateBalanceForSupplier(supplierId, currentInvoice.total_price, false, transaction);
        await deleteCurrentInvoice(currentInvoiceId, transaction);




        const totalPrice = parsedData.total_price - parsedData.discount;
        const invoiceId = await createPayInvoice(supplierId, parsedData, totalPrice, date, transaction);
        await addInvoiceItems(invoiceId, parsedData.items, transaction);
        await updateBalanceForSupplier(supplierId, totalPrice, true, transaction);
        await insertItemsForSupplier(supplierId, parsedData.items, transaction);


        await transaction.commit();

        return res.status(200).json({
            success: true,
            invoice_number: invoiceId,
            message: "تم تعديل الفاتورة",
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




async function createPayInvoice(parsedData, currentTimeStamp, transaction) {
    const totalPrice = parsedData.total_price - parsedData.discount;

    const result = await transaction.request()
        .input("supplier_id", sql.Int, parsedData.supplier_id)
        .input("total_price", sql.Decimal(18, 2), totalPrice)
        .input("remaining", sql.Decimal(18, 2), totalPrice)
        .input("created_at", sql.DateTime, currentTimeStamp)
        .input("discount", sql.Decimal(15, 2), parsedData.discount)
        .query(`
            INSERT INTO supplier_invoices (supplier_id, total_price, remaining, created_at, discount)
            OUTPUT INSERTED.id
            VALUES (@supplier_id, @total_price, @remaining, @created_at, @discount);
        `);
    const invoiceId = result.recordset[0].id;

    return invoiceId;
}
async function addInvoiceItems(invoiceId, items, transaction) {
    const request = transaction.request();

    request.input("invoiceId", sql.Int, invoiceId);

    const values = items.map((item, index) => {
        request.input(`itemId${index}`, sql.Int, item.id);
        request.input(`name${index}`, sql.NVarChar, item.name);
        request.input(`quantity${index}`, sql.Decimal(12, 2), item.qty);
        request.input(`costPrice${index}`, sql.Decimal(12, 2), item.cost_price);
        request.input(`unit${index}`, sql.NVarChar, item.unit_name);

        return `(
            @invoiceId,
            @itemId${index},
            @name${index},
            @quantity${index},
            @costPrice${index},
            @unit${index}
        )`;
    });


    await request.query(`
        INSERT INTO invoice_items
            (invoice_id, item_id, name, quantity, cost_price, unit)
        VALUES
            ${values.join(",\n")}
    `);

}



async function updateStockBatches(updateStockBatchs, currentTimeStamp, transaction) {

    if (updateStockBatchs.length === 0) {
        return;
    }

    const request = transaction.request();

    const values = updateStockBatchs.map((batch, index) => {

        request.input(`batchId${index}`, sql.Int, batch.id);

        request.input(
            `quantity${index}`,
            sql.Decimal(18, 2),
            batch.quantity
        );

        request.input(
            `remainingQty${index}`,
            sql.Decimal(18, 2),
            batch.remaining_qty
        );

        request.input(
            `createdAt${index}`,
            sql.DateTime,
            currentTimeStamp
        );

        return `(
            @batchId${index},
            @quantity${index},
            @remainingQty${index},
            @createdAt${index}
        )`;
    });

    await request.query(`
        UPDATE sb
        SET
            sb.quantity = sb.quantity + v.quantity,
            sb.remaining_qty = sb.remaining_qty + v.remaining_qty,
            sb.created_at = v.created_at
        FROM stock_batches sb
        INNER JOIN (
            VALUES
                ${values.join(",\n")}
        ) AS v(id, quantity, remaining_qty, created_at)
            ON v.id = sb.id
    `);
}
async function addNewStockBatches(addNewStockBatchs, currentTimeStamp, transaction) {

    if (addNewStockBatchs.length === 0) {
        return;
    }

    const request = transaction.request();

    const values = addNewStockBatchs.map((batch, index) => {

        request.input(`itemId${index}`, sql.Int, batch.item_id);
        request.input(
            `quantity${index}`,
            sql.Decimal(18, 2),
            batch.quantity
        );
        request.input(
            `remainingQty${index}`,
            sql.Decimal(18, 2),
            batch.remaining_qty
        );
        request.input(
            `costPrice${index}`,
            sql.Decimal(18, 3),
            batch.cost_price
        );

        request.input(
            `createdAt${index}`,
            sql.DateTime,
            currentTimeStamp
        );

        request.input(`invoiceId${index}`, sql.Int, batch.invoice_id);

        return `(
            @itemId${index},
            @quantity${index},
            @remainingQty${index},
            @costPrice${index},
            @createdAt${index},
            @invoiceId${index}
        )`;

        
    });

    await request.query(`
        INSERT INTO stock_batches
        (
            item_id,
            quantity,
            remaining_qty,
            cost_price,
            created_at,
            invoice_id
        )
        VALUES
            ${values.join(",\n")}
    `);
}
async function updateStockItems(updateItemsStock, isAddInvoice, transaction) {

    if (updateItemsStock.length === 0) {
        return;
    }

    const request = transaction.request();

    const values = updateItemsStock.map((item, index) => {
        request.input(
            `item_id${index}`,
            sql.Int,
            item.item_id
        );

        request.input(
            `quantity${index}`,
            sql.Decimal(18, 2),
            item.invoice_item_qty
        );

        return `(
            @item_id${index},
            @quantity${index}
        )`;
    });

    await request.query(`
        UPDATE i
        SET
            i.stock = i.stock ${isAddInvoice ? '+' : '-'} v.invoice_item_qty
        FROM items i
        INNER JOIN (
            VALUES
                ${values.join(",\n")}
        ) AS v(id, invoice_item_qty)
            ON v.id = i.id
    `);
}

async function getUnitAndBatchesById(unitId, itemId) {
    // const [unitResult, batchesResult] = await Promise.all([
    //     pool
    //         .request()
    //         .input("unitId", sql.Int, unitId)
    //         .query(`
    //             SELECT conversion_factor
    //             FROM items_units
    //             WHERE id = @unitId
    //         `),

    //     pool
    //         .request()
    //         .input("itemId", sql.Int, itemId)
    //         .query(`
    //             SELECT *
    //             FROM stock_batches
    //             WHERE item_id = @itemId
    //             ORDER BY id ASC
    //         `)
    // ]);

    // return {
    //     unitResult,
    //     batchesResult
    // };

    const unitResult = await pool
            .request()
            .input("unitId", sql.Int, unitId)
            .query(`
                SELECT conversion_factor
                FROM items_units
                WHERE id = @unitId
            `);

    return unitResult;

}
// async function getUnitAndBatchesByNameUnit(unitName, itemId) {
//     const [unitResult, batchesResult] = await Promise.all([
//         pool
//             .request()
//             .input("unit_name", sql.NVarChar, unitName)
//             .input("item_id", sql.Int, itemId)
//             .query(`
//                 SELECT conversion_factor
//                 FROM items_units
//                 WHERE unit_name = @unit_name AND item_id = @item_id
//             `),

//         pool
//             .request()
//             .input("itemId", sql.Int, itemId)
//             .query(`
//                 SELECT *
//                 FROM stock_batches
//                 WHERE item_id = @itemId
//                 ORDER BY id ASC
//             `)
//     ]);

//     return {
//         unitResult,
//         batchesResult
//     };
// }

async function getUnitAndBatchesByNameUnit(unitName, itemId) {
    const unitResult = await pool
        .request()
        .input("unit_name", sql.NVarChar, unitName)
        .input("item_id", sql.Int, itemId)
        .query(`
            SELECT conversion_factor
            FROM items_units
            WHERE unit_name = @unit_name AND item_id = @item_id
        `)
    ;

    
    return unitResult;
       
    
}
async function prepareStockBatches(items, invoiceId) {

    const addNewStockBatchs = [];
    const updateItemsStock = [];

    for (const item of items) {
        const itemId = item.id;
        const unitId = item.unit_id;

        //const { unitResult, batchesResult } = await getUnitAndBatchesById(unitId, itemId);

        const unitResult = await getUnitAndBatchesById(unitId, itemId);

        const conversionFactor = Number(unitResult.recordset[0].conversion_factor);
        // سعر التكلفة للقطعة
        const costPricePerPiece = Number(item.cost_price / conversionFactor).toFixed(3);
        // الكمية بالقطع
        const quantityInPieces = item.qty * conversionFactor;


        // const batches = batchesResult.recordset;

        // const lastBatch = batches[batches.length - 1];

        addNewStockBatchs.push({
            item_id: itemId,
            quantity: quantityInPieces,
            remaining_qty: quantityInPieces,
            cost_price: costPricePerPiece,
            invoice_id : invoiceId
        });
        
        // نفس سعر التكلفة -> تعديل آخر batch
        // if (Number(lastBatch.cost_price).toFixed(3) === costPricePerPiece) {
        //     updateStockBatchs.push({
        //         id: lastBatch.id,
        //         quantity: quantityInPieces,
        //         remaining_qty: quantityInPieces
        //     });
        // } else {
        //     addNewStockBatchs.push({
        //         item_id: itemId,
        //         quantity: quantityInPieces,
        //         remaining_qty: quantityInPieces,
        //         cost_price: costPricePerPiece
        //     });
        // }

        updateItemsStock.push({
            item_id: itemId,
            invoice_item_qty: quantityInPieces
        });
    }

    return {
        addNewStockBatchs,
        updateItemsStock,
    };
};






async function updateBalanceForSupplier(supplierId, totalPrice, isAdd, transaction) {
    await transaction.request()
        .input("supplier_id", sql.Int, supplierId)
        .input("total_price", sql.Decimal(18, 2), totalPrice)
        .input("is_add", sql.Bit, isAdd)
        .query(`
            UPDATE suppliers
            SET balance =
                CASE
                    WHEN @is_add = 1
                        THEN balance + @total_price
                    ELSE
                        balance - @total_price
                END
            WHERE id = @supplier_id
        `)
        ;
}


async function getSupplier(supplierId) {
    const result = await pool.request()
        .input('supplier_id', sql.Int, supplierId)
        .query(`
            SELECT * 
            FROM suppliers
            WHERE id = @supplier_id
        `)
        ;

    return result.recordset[0];
}

async function payment(supplierId, amount, transaction) {

    const request = transaction.request();

    request.input("supplierId", sql.Int, supplierId);
    request.input("amount", sql.Decimal(18, 2), amount);

    await request.query(`
        WITH InvoiceData AS
        (
            SELECT
                id,
                remaining,

                SUM(remaining) OVER (
                    ORDER BY id ASC
                    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                ) AS cumulative_remaining

            FROM supplier_invoices WITH (UPDLOCK, HOLDLOCK)

            WHERE supplier_id = @supplierId
              AND remaining > 0
        ),

        PaymentData AS
        (
            SELECT
                id,

                CASE
                    WHEN cumulative_remaining <= @amount
                        THEN remaining

                    WHEN cumulative_remaining - remaining < @amount
                        THEN @amount - (cumulative_remaining - remaining)

                    ELSE 0
                END AS payment

            FROM InvoiceData
        )

        UPDATE si
        SET si.remaining = si.remaining - p.payment

        FROM supplier_invoices si

        INNER JOIN PaymentData p
            ON p.id = si.id

        WHERE p.payment > 0;
    `);
}

async function savePaymentData(supplierId, paymentData, checkId, transaction) {
    const currentTimeStamp = new Date();
    await transaction.request()
        .input('supplier_id', sql.Int, supplierId)
        .input('check_id', sql.Int, checkId)
        .input('amount', sql.Decimal(18, 2), paymentData.amount)
        .input('payment_methode', sql.NVarChar, paymentData.paymentMethode)
        .input("created_at", sql.DateTime, currentTimeStamp)
        .query(`
            INSERT INTO supplier_payments (supplier_id, amount, payment_methode, check_id, created_at)
            VALUES (@supplier_id, @amount, @payment_methode, @check_id, @created_at)
        `)
        ;
}

async function getInvoices(invoiceId) {
    const result = await pool.request()
        .input('id', sql.Int, invoiceId)
        .query(`
            SELECT *
            FROM supplier_invoices
            WHERE id = @id       
        `
        );

    return result.recordset[0];
}

async function getIncoiceItems(invoiceId) {
    const result = await pool.request()
        .input('invoice_id', sql.Int, invoiceId)
        .query(`
            SELECT *
            FROM invoice_items
            WHERE invoice_id = @invoice_id       
        `
        );

    return result.recordset;
}



// async function removeQuantityOfInvoiceItemsFormStockBatches(invoiceItems, invoiceDate, transaction) {
//     const updateStockBatchs = [];
//     const deleteStockBatchs = [];
//     const updateItemsStock = [];

//     for (const item of invoiceItems) {
//         const itemId = item.item_id;
//         const unitName = item.unit;

//         const { unitResult, batchesResult } = await getUnitAndBatchesByNameUnit(unitName, itemId);

//         if (!unitResult.recordset || unitResult.recordset.length === 0) {
//             continue;
//         }

//         const conversionFactor = Number(unitResult.recordset[0].conversion_factor);



//         const quantityInPieces = conversionFactor * item.quantity;

//         // سعر التكلفة للقطعة
//         const itemInvoiceCostPricePerPiece = Number(item.cost_price / conversionFactor).toFixed(3);

//         const batches = batchesResult.recordset;

//         for (const batch of batches) {

//             const batchCostPrice = Number(batch.cost_price).toFixed(3);
            
//             if(batchCostPrice === itemInvoiceCostPricePerPiece && batch.created_at.getTime() === invoiceDate.getTime()) {

//                 const newRemainingQty = Math.max(0, Number(batch.remaining_qty) - quantityInPieces);

//                 if (newRemainingQty === 0) {

//                     if (batches.length > 1) {
//                         deleteStockBatchs.push({
//                             id: batch.id
//                         });

//                     } else {

//                         updateStockBatchs.push({
//                             id: batch.id,
//                             remaining_qty: 0,
//                             inv_qty : quantityInPieces
//                         });

//                     }
//                 } else {
//                     updateStockBatchs.push({
//                         id: batch.id,
//                         remaining_qty: newRemainingQty,
//                         inv_qty : quantityInPieces
//                     });
//                 }

//                 break;
//             }
//         }
//         updateItemsStock.push({
//             item_id: itemId,
//             invoice_item_qty: quantityInPieces
//         });
//     }

//     await updateQuantityInStockBatches(updateStockBatchs, transaction);
//     await deleteStockBatches(deleteStockBatchs, transaction);
//     await updateStockItems(updateItemsStock, false, transaction);
// }

async function removeQuantityOfInvoiceItemsFormStockBatches(invoiceItems, transaction) {
    const updateItemsStock = [];

    for (const item of invoiceItems) {
        const itemId = item.item_id;
        const unitName = item.unit;

        const unitResult = await getUnitAndBatchesByNameUnit(unitName, itemId);

        if (!unitResult.recordset || unitResult.recordset.length === 0) {
            continue;
        }

        const conversionFactor = Number(unitResult.recordset[0].conversion_factor);
        const quantityInPieces = conversionFactor * item.quantity;

        updateItemsStock.push({
            item_id: itemId,
            invoice_item_qty: quantityInPieces
        });
    }

    
    await updateStockItems(updateItemsStock, false, transaction);
}
async function updateQuantityInStockBatches(updateStockBatchs, transaction) {

    if (updateStockBatchs.length === 0) {
        return;
    }
    const request = transaction.request();
    const values = updateStockBatchs.map((batch, index) => {

        request.input(
            `id${index}`,
            sql.Int,
            batch.id
        );

        request.input(
            `remainingQty${index}`,
            sql.Decimal(18, 2),
            batch.remaining_qty
        );

        request.input(
            `invQty${index}`,
            sql.Decimal(18, 2),
            batch.inv_qty
        );

        return `(
            @id${index},
            @remainingQty${index},
            @invQty${index}
        )`;
    });

    await request.query(`
        UPDATE sb
        SET
            sb.remaining_qty = b.remaining_qty,
            sb.quantity = sb.quantity - b.inv_qty
        FROM stock_batches sb
        INNER JOIN (
            VALUES
                ${values.join(",\n")}
        ) AS b(id, remaining_qty, inv_qty)
            ON sb.id = b.id
    `);
}
async function deleteStockBatches(deleteStockBatchs, transaction) {

    if (deleteStockBatchs.length === 0) {
        return;
    }

    const request = transaction.request();

    const ids = deleteStockBatchs.map((batch, index) => {

        request.input(
            `id${index}`,
            sql.Int,
            batch.id
        );

        return `@id${index}`;
    });

    await request.query(`
        DELETE FROM stock_batches
        WHERE id IN (${ids.join(", ")})
    `);
}




async function getPayment(paymentId) {
    const result = await pool.request()
        .input('id', sql.Int, paymentId)
        .query(`
            SELECT *
            FROM supplier_payments
            WHERE id = @id       
        `
        );

    return result.recordset[0];
}
async function addNewCheck(accountName, checkNumber, bankName, payeeName, amount, currency, dueDate, type, status, notes, transaction) {

    const result = await transaction
        .request()
        .input('account_name', sql.NVarChar(100), accountName)
        .input('check_number', sql.NVarChar(50), checkNumber)
        .input('bank_name', sql.NVarChar(100), bankName)
        .input('payee_name', sql.NVarChar(150), payeeName)
        .input('amount', sql.Decimal(18, 2), amount)
        .input('currency', sql.NVarChar(3), currency)
        .input('due_date', sql.Date, dueDate)
        .input('type', sql.NVarChar(10), type)
        .input('status', sql.NVarChar(10), status)
        .input('notes', sql.NVarChar(sql.MAX), notes || null)
        .query(`
            INSERT INTO checks (
                account_name,
                check_number,
                bank_name,
                payee_name,
                amount,
                currency,
                due_date,
                type,
                status,
                notes
            )
            OUTPUT INSERTED.id
            VALUES (
                @account_name,
                @check_number,
                @bank_name,
                @payee_name,
                @amount,
                @currency,
                @due_date,
                @type,
                @status,
                @notes
            )
        `);

    return result.recordset[0].id;
}
async function restorePayment(supplierId, amount, transaction) {
    await transaction
        .request()
        .input('amount', sql.Decimal(18, 2), amount)
        .input('supplier_id', sql.Int, supplierId)
        .query(`
            UPDATE si
            SET si.remaining = si.remaining + RestoreData.restore_amount
            FROM supplier_invoices AS si

            INNER JOIN (
                SELECT
                    id,

                    CASE
                        WHEN cumulative_paid <= @amount THEN paid_amount

                        WHEN cumulative_paid - paid_amount < @amount THEN
                            @amount - (cumulative_paid - paid_amount)

                        ELSE 0
                    END AS restore_amount

                FROM (
                    SELECT
                        id,
                        total_price,
                        remaining,

                        (total_price - remaining) AS paid_amount,

                        SUM(total_price - remaining) OVER (
                            ORDER BY
                                CASE
                                    WHEN remaining > 0
                                        THEN 0
                                    ELSE 1
                                END ASC,

                                CASE
                                    WHEN remaining > 0
                                        THEN id
                                    ELSE -id
                                END ASC

                            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                        ) AS cumulative_paid

                    FROM supplier_invoices

                    WHERE supplier_id = @supplier_id
                      AND total_price > 0
                      AND remaining < total_price

                ) AS InvoiceData

            ) AS RestoreData

                ON RestoreData.id = si.id

            WHERE RestoreData.restore_amount > 0
        `);
}
async function deleteCheck(checkId, transaction) {
    await transaction
        .request()
        .input('checkId', sql.Int, checkId)
        .query(`
            DELETE FROM checks
            WHERE id = @checkId
        `);
}
async function deletePaymentRecord(paymentId, transaction) {
    await transaction
        .request()
        .input('paymentId', sql.Int, paymentId)
        .query(`
            DELETE FROM supplier_payments
            WHERE id = @paymentId
        `);
}
async function deleteCurrentInvoice(invoiceId, transaction) {
    await transaction
        .request()
        .input('invoiceId', sql.Int, invoiceId)
        .query(`
            DELETE
            FROM supplier_invoices
            WHERE id = @invoiceId
        `);
}

function mapInvoiceDate(rows) {
    if (rows.length === 0) return null;

    const invoice = {
        id: rows[0].id,
        total_price: rows[0].total_price,
        paied: rows[0].paied,
        remaining: rows[0].remaining,
        created_at: rows[0].created_at,
        discount: rows[0].discount,
        supplier_id: rows[0].supplier_id,
        items: []
    };

    for (const row of rows) {
        invoice.items.push({
            name: row.name,
            unit: row.unit,
            quantity: row.quantity,
            cost_price: row.cost_price
        });
    }

    return invoice;
}






const invoiceSchema = z.object({

    supplier_id: z.preprocess(
        val => Number(val),
        z.number().int("يجب إختيار المورد")
    ),

    total_price: z.preprocess(
        val => Number(val),  // يحول أي شيء إلى Number
        z.number().positive("القيمة يجب أن تكون رقمًا موجبًا")
    ),

    discount: z.preprocess(
        val => Number(val),
        z.number().nonnegative("القيمة الخصم يجب أن تكون صفر أو رقمًا موجبًا")
    ),

    items: z.array(
        z.object({
            id: z.preprocess(
                val => Number(val),
                z.number().int("معرف المنتج يجب أن يكون رقمًا صحيحًا")
            ),

            unit_id: z.preprocess(
                val => Number(val),
                z.number().int("يجب إختيار الوِحدة الشرائية لجميع الأصناف")
            ),

            name: z.string()
                .trim()
                .min(1, "اسم الصنف يجب أن يحتوي على حرف على الأقل"),

            unit_name: z.string()
                .trim()
                .min(1, "اسم وِحدة الشراء يجب أن يحتوي على حرف على الأقل"),

            cost_price: z.preprocess(
                val => Number(val),
                z.number().positive("سعر التكلفة يجب أن يكون رقمًا موجبًا")
            ),

            qty: z.preprocess(
                val => Number(val),
                z.number().positive("الكمية يجب أن تكون رقمًا أكبر من صفر")
            ),
        })
    )
});
