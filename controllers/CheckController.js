import { pool, sql } from "../DataBaseConnections/dbconnection.js";
import { checkToken, SystemError } from "../shared/functionality.js";
import { z } from "zod";


export const createOrder = async (req, res) => {

    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }

        await checkToken(token);

        const body = req.body;


        const parsedData = checkSchema.parse(body);


        const {
            checkNumber,
            bankName,
            payeeName,
            amount,
            currency,
            issueDate,
            dueDate,
            type,
            status,
            notes,
            accountName
        } = parsedData;

        await pool
            .request()
            .input('check_number', sql.NVarChar(50), checkNumber)
            .input('bank_name', sql.NVarChar(100), bankName)
            .input('payee_name', sql.NVarChar(150), payeeName)
            .input('amount', sql.Decimal(18, 2), amount)
            .input('currency', sql.NVarChar(3), currency)
            .input('issue_date', sql.Date, issueDate)
            .input('due_date', sql.Date, dueDate)
            .input('type', sql.NVarChar(10), type)
            .input('status', sql.NVarChar(10), status)
            .input('notes', sql.NVarChar(sql.MAX), notes || null)
            .input('account_name', sql.NVarChar(100), accountName)
            .query(`
                INSERT INTO checks (
                    check_number,
                    bank_name,
                    payee_name,
                    amount,
                    currency,
                    issue_date,
                    due_date,
                    type,
                    status,
                    notes,
                    account_name
                )
                VALUES (
                    @check_number,
                    @bank_name,
                    @payee_name,
                    @amount,
                    @currency,
                    @issue_date,
                    @due_date,
                    @type,
                    @status,
                    @notes,
                    @account_name
                )
            `);





        return res.status(200).json({
            success: true,
            message: "تم إضافة الشيك",
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

export const getChecksHandler = async (req, res) => {
    try {

        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }

        await checkToken(token);

        const {
            from,
            to,
            supplier,
            status,
            type,
            account,
            checkNumber,
            page = 1,
            limit = 50
        } = req.query;

        const result = await getChecks({
            from,
            to,
            supplier,
            status,
            type,
            account,
            checkNumber,
            page: Number(page),
            limit: Number(limit)
        }, pool);

        return res.status(200).json({
            success: true,
            ...result
        });

    } catch (e) {

        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });

    } 
}



export const updateCheckStatus = async (req, res) => {
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }

        await checkToken(token);

        const checkId = Number(req.query.id);
        
        const { status } = req.body;
        
        if (!checkId) {
            throw new SystemError(
                "رقم الشيك مطلوب",
                400
            );
        }
        
        if (!status) {
            throw new SystemError(
                "حالة الشيك مطلوبة",
                400
            );
        }
        
        if (!["pending", "paid", "cancelled"].includes(status)) {
            throw new SystemError(
                "حالة الشيك غير صحيحة",
                400
            );
        }
        
        await pool
            .request()
            .input('status', sql.NVarChar(10), status)
            .input('check_id', sql.Int, checkId)
            .query(`
                UPDATE checks
                SET status = @status
                WHERE id = @check_id
            `)
        ;
        
        return res.status(200).json({
            success: true,
            message: "تم تعديل حالة الشيك بنجاح"
        });

    } catch (e) {

        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });

    } 
}


export const deleteCheck = async (req, res) => {
    const checkId = Number(req.query.check_id);

    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;
    
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        await checkToken(token);
        
        const payment = await getPayment(checkId);
        
        await transaction.begin();
        transactionStarted = true;
        
        
        if(payment){
            await restorePayment(payment.supplier_id, payment.amount, transaction);
            await updateBalanceForSupplier(payment.supplier_id, payment.amount, true, transaction);
        }
        
        await transaction
            .request()
            .input('checkId', sql.Int, checkId)
            .query(`
                DELETE FROM checks
                WHERE id = @checkId
            `)
        ;
        
        await transaction.commit();

        
        
        
        return res.status(200).json({
            success: true,
            message: "تم تعديل حالة الشيك بنجاح"
        });

    } catch (e) {
        if(transactionStarted) {
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


async function getChecks({
    from,
    to,
    supplier,
    status,
    type,
    account,
    checkNumber,
    page = 1,
    limit = 50
}, pool, sql) {

    const conditions = [];

    // Pagination
    page = Number(page) || 1;
    limit = Number(limit) || 50;

    const offset = (page - 1) * limit;

    // بناء شروط البحث
    if (from) {
        conditions.push("due_date >= @from");
    }

    if (to) {
        conditions.push("due_date <= @to");
    }

    if (supplier) {
        conditions.push("payee_name = @supplier");
    }

    if (status) {
        conditions.push("status = @status");
    }

    if (type) {
        conditions.push("type = @type");
    }

    if (account) {
        conditions.push("account_name = @account");
    }

    if (checkNumber) {
        conditions.push("check_number LIKE @checkNumber");
    }

    const whereClause = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    // إنشاء Request منفصل لكل Query
    const dataRequest = pool.request();
    const summaryRequest = pool.request();

    // إضافة الـ parameters للـ requestين
    if (from) {
        dataRequest.input("from", sql.Date, from);
        summaryRequest.input("from", sql.Date, from);
    }

    if (to) {
        dataRequest.input("to", sql.Date, to);
        summaryRequest.input("to", sql.Date, to);
    }

    if (supplier) {
        dataRequest.input("supplier", sql.NVarChar(150), supplier);
        summaryRequest.input("supplier", sql.NVarChar(150), supplier);
    }

    if (status) {
        dataRequest.input("status", sql.NVarChar(10), status);
        summaryRequest.input("status", sql.NVarChar(10), status);
    }

    if (type) {
        dataRequest.input("type", sql.NVarChar(10), type);
        summaryRequest.input("type", sql.NVarChar(10), type);
    }

    if (account) {
        dataRequest.input("account", sql.NVarChar(100), account);
        summaryRequest.input("account", sql.NVarChar(100), account);
    }

    if (checkNumber) {
        dataRequest.input(
            "checkNumber",
            sql.NVarChar(50),
            `%${checkNumber}%`
        );

        summaryRequest.input(
            "checkNumber",
            sql.NVarChar(50),
            `%${checkNumber}%`
        );
    }

    // Pagination parameters
    dataRequest.input("offset", sql.Int, offset);
    dataRequest.input("limit", sql.Int, limit);

    const [
        dataResult,
        summaryResult
    ] = await Promise.all([

        // جلب الشيكات
        dataRequest.query(`
            SELECT
                id,
                check_number,
                bank_name,
                payee_name,
                amount,
                currency,

                CONVERT(VARCHAR(10), issue_date, 23) AS issue_date,
                CONVERT(VARCHAR(10), due_date, 23) AS due_date,

                type,
                status,
                account_name,
                notes

            FROM checks

            ${whereClause}

            ORDER BY due_date ASC

            OFFSET @offset ROWS
            FETCH NEXT @limit ROWS ONLY
        `),

        // Summary
        summaryRequest.query(`
            SELECT
                COUNT(*) AS totalChecks,

                COALESCE(
                    SUM(
                        CASE
                            WHEN currency = 'USD'
                            AND status = 'pending'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS totalUSD,

                COALESCE(
                    SUM(
                        CASE
                            WHEN currency = 'JOD'
                            AND status = 'pending'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS totalJOD,

                COALESCE(
                    SUM(
                        CASE
                            WHEN currency = 'ILS'
                            AND status = 'pending'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS totalILS,

                COALESCE(
                    SUM(
                        CASE
                            WHEN currency = 'EUR'
                            AND status = 'pending'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS totalEUR,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'pending'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS pendingChecks,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'paid'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS paidChecks

            FROM checks

            ${whereClause}
        `)
    ]);

    const rows = dataResult.recordset;

    const summary = summaryResult.recordset[0];

    const total = Number(summary.totalChecks);

    return {
        data: rows,

        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        },

        summary: {
            totalChecks: total,
            totalUSD: Number(summary.totalUSD),
            totalJOD: Number(summary.totalJOD),
            totalILS: Number(summary.totalILS),
            totalEUR: Number(summary.totalEUR),
            pendingChecks: Number(summary.pendingChecks),
            paidChecks: Number(summary.paidChecks)
        }
    };
}


async function getPayment(checkId) {
    const result = await pool
        .request()
        .input('check_id', sql.Int, checkId)
        .query(`
            SELECT *
            FROM supplier_payments
            WHERE check_id = @check_id
        `);

    return result.recordset[0];
}

async function restorePayment(supplierId, amount, transaction) {

    await transaction
        .request()
        .input('amount', sql.Decimal(18, 2), amount)
        .input('supplier_id', sql.Int, supplierId)
        .query(`
            ;WITH InvoiceData AS (
                SELECT
                    id,
                    total_price,
                    remaining,
                    (total_price - remaining) AS paid_amount,

                    SUM(total_price - remaining) OVER (
                        ORDER BY
                            CASE
                                WHEN remaining > 0 THEN 0
                                ELSE 1
                            END ASC,

                            CASE
                                WHEN remaining > 0 THEN id
                                ELSE -id
                            END ASC

                        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                    ) AS cumulative_paid

                FROM supplier_invoices

                WHERE supplier_id = @supplier_id
                  AND total_price > 0
                  AND remaining < total_price
            ),

            RestoreData AS (
                SELECT
                    id,

                    CASE
                        WHEN cumulative_paid <= @amount
                            THEN paid_amount

                        WHEN cumulative_paid - paid_amount < @amount
                            THEN @amount - (cumulative_paid - paid_amount)

                        ELSE 0
                    END AS restore_amount

                FROM InvoiceData
            )

            UPDATE si
            SET si.remaining = si.remaining + rd.restore_amount

            FROM supplier_invoices AS si

            INNER JOIN RestoreData AS rd
                ON rd.id = si.id

            WHERE rd.restore_amount > 0;
        `);
}

async function updateBalanceForSupplier(supplierId, totalPrice, isAdd, transaction) {
    await transaction
        .request()
        .input('isAdd', sql.Int, isAdd ? 1 : 0)
        .input('totalPrice', sql.Decimal(18, 2), totalPrice)
        .input('supplierId', sql.Int, supplierId)
        .query(`
            UPDATE suppliers
            SET balance =
                CASE
                    WHEN @isAdd = 1
                        THEN balance + @totalPrice
                    ELSE
                        balance - @totalPrice
                END
            WHERE id = @supplierId
        `);
}

const checkSchema = z.object({
    checkNumber: z.string()
        .trim()
        .regex(/^\d+$/, "رقم الشيك يجب أن يحتوي على أرقام فقط")
        .min(1, "رقم الشيك مطلوب"),


    bankName: z.string()
        .trim()
        .regex(/^[\u0600-\u06FFa-zA-Z\s]+$/, "اسم البنك يجب أن يحتوي على أحرف فقط")
        .min(2, "اسم البنك مطلوب"),

    payeeName: z.string()
        .trim()
        .regex(/^[\u0600-\u06FFa-zA-Z\s]+$/, "اسم المستفيد يجب أن يحتوي على أحرف فقط")
        .min(2, "اسم المستفيد مطلوب"),


    amount: z.preprocess(
        val => {
            if (typeof val === "string") {
                val = val.trim();
            }

            return val === "" ? NaN : Number(val);
        },
        z.number({
            invalid_type_error: "قيمة الشيك يجب أن تكون رقمًا"
        }).positive("قيمة الشيك يجب أن تكون أكبر من صفر")
    ),

    currency: z.enum(["ILS", "USD", "JOD", "EUR"], {
        errorMap: () => ({ message: "يجب اختيار عملة الشيك" })
    }),


    issueDate: z.string()
        .trim()
        .min(1, "تاريخ إصدار الشيك مطلوب")
        .regex(
            /^\d{4}-\d{2}-\d{2}$/,
            "تاريخ إصدار الشيك غير صحيح"
        ),

    dueDate: z.string()
        .trim()
        .min(1, "تاريخ استحقاق الشيك مطلوب")
        .regex(
            /^\d{4}-\d{2}-\d{2}$/,
            "تاريخ استحقاق الشيك غير صحيح"
        ),

    type: z.enum(["incoming", "outgoing"], {
        errorMap: () => ({ message: "يجب اختيار نوع الشيك" })
    }),

    status: z.enum(["pending", "paid", "cancelled"], {
        errorMap: () => ({ message: "يجب اختيار حالة الشيك" })
    }),

    notes: z.string()
        .trim()
        .optional(),

    accountName: z.string()
        .trim()
        .regex(/^[\u0600-\u06FFa-zA-Z\s]+$/, "اسم الحساب يجب أن يحتوي على أحرف فقط")
        .min(2, "اسم الحساب مطلوب")

}).refine(
    data => data.dueDate >= data.issueDate,
    {
        message: "تاريخ الاستحقاق يجب أن يكون بعد أو يساوي تاريخ الإصدار",
        path: ["dueDate"]
    }
);