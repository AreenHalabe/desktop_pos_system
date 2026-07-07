import { pool, sql } from "../DataBaseConnections/dbconnection.js";
import { checkToken, SystemError } from "../shared/functionality.js";
import { z } from "zod";


export const getAllTable = async (req, res) => {
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        await checkToken(token);

        const result = await pool.request()
            .query(`
                SELECT *
                FROM tables
            `)
            ;

        const tables = result.recordset;

        return res.status(200).json({
            tables
        });
    } catch (e) {
        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}


export const addNewTable = async (req, res) => {
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;
    let isOneTable;
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        await checkToken(token);

        const body = req.body;


        const schema = buildTableSchema(body.isMoreThanOneTable);
        const data = schema.parse(body);


        isOneTable = !body.isMoreThanOneTable;

        if (data.count > 50) {
            throw new SystemError("لا يمكن إضافة اكثر من 50 طاولة في كل عملية", 400);
        }


        await transaction.begin();
        transactionStarted = true;





        // إضافة طاولة واحدة
        if (body.isMoreThanOneTable) {
            const tables = [];

            for (let i = 0; i < data.count; i++) {
                tables.push(
                    data.startTable + (i * data.step)
                );
            }

            const values = tables
                .map(num => `(${num})`)
                .join(',');

            await transaction.request()
                .query(`
                    INSERT INTO tables (table_number)
                    VALUES ${values}
                `)
                ;
        } else {
            await transaction.request()
                .input('table_number', sql.Int, data.tableNumber)
                .query(`
                    INSERT INTO tables (table_number)
                    VALUES (@table_number)
                `)
                ;
        }

        await transaction.commit();




        return res.status(200).json({
            message: 'تم الإضافة بنجاح'
        });



    } catch (e) {
        if (transactionStarted) {
            try {
                await transaction.rollback();
            } catch (e) {
                console.log(e.message);
            }
        }

        const validationErrors = e?.errors || e?.issues;

        if (Array.isArray(validationErrors) && validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: validationErrors[0].message
            });
        }

        if (e?.originalError?.info?.message?.includes("Violation of PRIMARY KEY constraint")) {
            let message;
            if (isOneTable) {
                message = "رقم الطاولة موجود مسبقاً, الرجاء إدخال رقم آخر"
            } else {
                message = "تعذر إضافة الطاولات، يوجد رقم طاولة واحد أو أكثر ضمن التسلسل المدخل موجود مسبقاً،."

            }
            return res.status(409).json({
                message: message
            });
        }

        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}

export const deleteTable = async (req, res) => {
    const tableId = Number(req.query.table_id);
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        await checkToken(token);

        await pool.request()
            .input('table_num', sql.Int, tableId)
            .query(`
                DELETE FROM tables WHERE table_number = @table_num
            `)
            ;

        return res.status(200).json({
            message: 'تم حذف الطاولة بنجاح'
        });

    } catch (e) {
        const validationErrors = e?.errors || e?.issues;


        if (e?.originalError?.info?.message?.includes("The DELETE statement conflicted with the REFERENCE constraint")) {
            return res.status(409).json({
                message: 'لا يمكن حذف الطاولة لأنها مرتبطة بطلب يرجى إغلاق أو حذف الطلب أولاً.'
            });
        }
        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}

export const destroyTables = async (req, res) => {
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        await checkToken(token);

        await transaction.begin();
        transactionStarted = true;

        await transaction.request()
            .query(`
                DELETE FROM tables;
            `)
            ;

        await transaction.commit();

        return res.status(200).json({
            message: 'تم الحذف بنجاح'
        });


    } catch (e) {
        if (transactionStarted) {
            try {
                await transaction.rollback();
            } catch (e) {
                console.log(e.message);
            }
        }


        const validationErrors = e?.errors || e?.issues;

        if (e?.originalError?.info?.message?.includes("The DELETE statement conflicted with the REFERENCE constraint")) {
            return res.status(409).json({
                message: 'لا يمكن الحذف , يوجد طاولة من الطاولات عليها طلب لم يغلق بعد , يرجى حذف الطلب أو إغلاقه'
            });
        }

        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });

    }
}
export const moveOrder = async (req , res) =>{
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        await checkToken(token);

        const body = req.body;

        const from = body.from;
        const to   = body.to;

        await pool
            .request()
            .input('from_table', sql.Int, from)
            .input('to_table', sql.Int, to)
            .query(`
                UPDATE table_order
                SET table_id = @to_table 
                WHERE table_id = @from_table;
            `)
        ;
        
        return res.status(200).json({
            message : 'تم تغيير الطاولة'
        });
        

    }catch (e) {
        const validationErrors = e?.errors || e?.issues;

        if (e?.originalError?.info?.message?.includes("The UPDATE statement conflicted with the FOREIGN KEY constraint")) {
            return res.status(409).json({
               message: 'تعذر تنفيذ العملية: رقم الطاولة المدخل غير موجود في النظام'
            });
        }
        if (e?.originalError?.info?.message?.includes("Violation of UNIQUE KEY constraint")) {
            return res.status(409).json({
               message: 'تعذر نقل الطلب. الطاولة المحددة مشغولة وتحتوي على طلب نشط.'
            });
        }
        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });

    }
}


export const LoadOrdersAccordingTables = async (req, res) => {
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        await checkToken(token);

        const result = await pool.request()
            .query(`
                SELECT 
                    tbo.table_id,

                    o.id,
                    o.invoice_num,
                    o.total_price,
                    o.created_at,
                    o.discount,
                    o.type,

                    io.id AS order_item_id,
                    io.order_id,
                    io.item_id,
                    io.quantity,
                    io.price,
                    io.size_name, 

                    i.name AS item_name
                        
                FROM table_order tbo
                left join orders o on tbo.order_id = o.id

                LEFT JOIN order_items io
                    ON o.id = io.order_id

                LEFT JOIN Items i 
                    ON io.item_id = i.id
                    
                ORDER BY tbo.table_id;
                            
            `)
        ;

        const groupedTables  = buildTreeOfOrdersAccordingTables(result.recordset);

        return res.status(200).json({
            table_orders : groupedTables 
        });

    } catch (e) {
        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });

    }
}







function buildTreeOfOrdersAccordingTables(rows) {
    if (!rows || rows.length === 0) {
        return [];
    }

    const tablesMap = new Map();

    for (const row of rows) {
        let table = tablesMap.get(row.table_id);

        if (!table) {
            table = {
                table_id: row.table_id,
                order: null
            };

            tablesMap.set(row.table_id, table);
        }

        if (!row.id) continue;

        if (!table.order) {
            table.order = {
                id: row.id,
                invoice_num: row.invoice_num,
                total_price: row.total_price,
                discount: row.discount,
                created_at: row.created_at,
                status: row.status,
                items: []
            };
        }

        if (row.order_item_id) {
            table.order.items.push({
                order_item_id: row.order_item_id,
                order_id: row.order_id,
                item_id: row.item_id,
                item_name: row.item_name,
                quantity: row.quantity,
                price: row.price,
                size_name: row.size_name
            });
        }
    }

    return Array.from(tablesMap.values())

}



function buildTableSchema(isMoreThanOneTable) {
    return z.object({

        isMoreThanOneTable: z.literal(isMoreThanOneTable),

        // -------- طاولة واحدة --------
        tableNumber: !isMoreThanOneTable
            ? z.preprocess(
                (v) => {
                    if (v === null || v === undefined || v === "") return null;
                    return Number(v);
                },
                z.number()
                    .int("رقم الطاولة يجب أن يكون رقمًا صحيحًا")
                    .positive("رقم الطاولة يجب أن يكون رقمًا موجبًا")
                    .min(2, "يجب أن يكون رقم الطاولة أكبر من 1")
                    .nullable()
                    .refine(v => v !== null, {
                        message: "يجب إدخال رقم الطاولة"
                    })
            )
            : z.literal(0),

        // -------- أكثر من طاولة --------
        startTable: isMoreThanOneTable
            ? z.preprocess(
                (v) => Number(v),
                z.number()
                    .int("رقم البداية يجب أن يكون رقمًا صحيحًا")
                    .positive("رقم البداية يجب أن يكون رقمًا موجبًا")
                    .min(1, "يجب أن يكون أكبر من 0")
            )
            : z.literal(0),

        step: isMoreThanOneTable
            ? z.preprocess(
                (v) => Number(v),
                z.number()
                    .int("الخطوة يجب أن تكون رقمًا صحيحًا")
                    .positive("الخطوة يجب أن تكون رقمًا موجبًا")
                    .min(1, "يجب أن تكون أكبر من 0")
            )
            : z.literal(0),

        count: isMoreThanOneTable
            ? z.preprocess(
                (v) => Number(v),
                z.number()
                    .int("العدد يجب أن يكون رقمًا صحيحًا")
                    .positive("العدد يجب أن يكون رقمًا موجبًا")
                    .min(1, "يجب أن يكون أكبر من 0")
            )
            : z.literal(0),
    });
}

