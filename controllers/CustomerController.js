import { pool, sql } from "../DataBaseConnections/dbconnection.js";
import { checkToken, SystemError } from "../shared/functionality.js";
import { z } from "zod";


export const getInvoicesCustomerDetails = async (req, res) => {

    const customerId = Number(req.query.customer_id);
    const page = Math.max(1, Number.parseInt(req.query.page) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;

    try {

        const token = req.headers.authorization;

        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }

        const adminId = await checkToken(token);

        if (!customerId || !Number.isInteger(customerId)) {
            throw new SystemError("رقم الزبون غير صحيح", 400);
        }

        const [
            customerResult,
            ordersResult,
            countResult
        ] = await Promise.all([

            // بيانات الزبون
            pool.request()
                .input("customerId", sql.Int, customerId)
                .input("adminId", sql.Int, adminId)
                .query(`
                    SELECT
                        name,
                        balance,
                        phone
                    FROM customers
                    WHERE id = @customerId
                    AND admin_id = @adminId
                `),

            // الطلبات والأصناف
            pool.request()
                .input("customerId", sql.Int, customerId)
                .input("limit", sql.Int, limit)
                .input("offset", sql.Int, offset)
                .query(`
                    SELECT
                        o.*,
                        COALESCE(co.remaining, 0) AS remaining,

                        oi.id AS order_item_id,
                        oi.item_id,
                        oi.quantity,
                        oi.price,
                        oi.unit,
                        oi.discount_item,

                        i.name AS item_name

                    FROM (
                        SELECT *
                        FROM orders
                        WHERE
                            customer_id = @customerId
                            AND status = N'مكتمل'
                        ORDER BY id DESC
                        OFFSET @offset ROWS
                        FETCH NEXT @limit ROWS ONLY
                    ) o

                    LEFT JOIN customers_orders co
                        ON co.order_id = o.id
                        AND co.customer_id = o.customer_id

                    LEFT JOIN order_items oi
                        ON o.id = oi.order_id

                    LEFT JOIN items i
                        ON oi.item_id = i.id

                    ORDER BY o.id DESC, oi.id ASC
                `),

            // العدد الإجمالي للطلبات
            pool.request()
                .input("customerId", sql.Int, customerId)
                .query(`
                    SELECT COUNT(*) AS total
                    FROM orders
                    WHERE customer_id = @customerId
                `)

        ]);

        const customer = customerResult.recordset[0];

        if (!customer) {
            throw new SystemError("الزبون غير موجود", 404);
        }

        const rows = ordersResult.recordset;

        // تجميع الأصناف داخل كل طلب
        const ordersMap = new Map();

        for (const row of rows) {

            if (!ordersMap.has(row.id)) {

                const {
                    order_item_id,
                    item_id,
                    quantity,
                    price,
                    unit,
                    discount_item,
                    item_name,
                    remaining,
                    ...orderData
                } = row;

                ordersMap.set(row.id, {
                    ...orderData,
                    remaining,
                    items: []
                });

            }

            if (row.order_item_id !== null) {

                ordersMap.get(row.id).items.push({
                    id: row.order_item_id,
                    item_id: row.item_id,
                    item_name: row.item_name,
                    quantity: row.quantity,
                    price: row.price,
                    unit: row.unit,
                    discount_item: row.discount_item
                });

            }

        }

        const orders = Array.from(ordersMap.values());

        const totalOrders = Number(countResult.recordset[0].total);
        const totalPages = Math.ceil(totalOrders / limit);

        return res.status(200).json({

            success: true,

            data: {
                customer,
                orders
            },

            pagination: {
                page,
                limit,
                totalOrders,
                totalPages,
                hasPreviousPage: page > 1,
                hasNextPage: page < totalPages
            }

        });

    } catch (e) {

        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });

    }

};

export const getPaymentsCustomerDetails = async (req, res) => {

    const customerId = Number(req.query.customer_id);
    const page = Math.max(1, Number.parseInt(req.query.page) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;

    try {

        const token = req.headers.authorization;

        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }

        const adminId = await checkToken(token);

        if (!customerId || !Number.isInteger(customerId)) {
            throw new SystemError("رقم الزبون غير صحيح", 400);
        }

        const [
            customerResult,
            paymentsResult,
            countResult
        ] = await Promise.all([

            pool.request()
                .input("customerId", sql.Int, customerId)
                .input("adminId", sql.Int, adminId)
                .query(`
                    SELECT
                        name,
                        balance,
                        phone
                    FROM customers
                    WHERE id = @customerId
                    AND admin_id = @adminId
                `),

            // دفعات الزبون
            pool.request()
                .input("customerId", sql.Int, customerId)
                .input("limit", sql.Int, limit)
                .input("offset", sql.Int, offset)
                .query(`
                    SELECT
                        id,
                        amount,
                        note,
                        created_at
                    FROM transactions
                    WHERE customer_id = @customerId
                    ORDER BY id DESC
                    OFFSET @offset ROWS
                    FETCH NEXT @limit ROWS ONLY
                `),

            // العدد الإجمالي للدفعات
            pool.request()
                .input("customerId", sql.Int, customerId)
                .query(`
                    SELECT COUNT(*) AS total
                    FROM transactions
                    WHERE customer_id = @customerId
                `)

        ]);

        const payments = paymentsResult.recordset;

        const customer = customerResult.recordset[0];

        const totalPayments = Number(countResult.recordset[0].total);
        const totalPages = Math.ceil(totalPayments / limit);

        return res.status(200).json({

            success: true,

            customer,
            payments,

            pagination: {
                page,
                limit,
                totalPayments,
                totalPages,
                hasPreviousPage: page > 1,
                hasNextPage: page < totalPages
            }

        });

    } catch (e) {

        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });

    }

};

export const getAllCustomers = async (req, res) => {
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        const adminId = await checkToken(token);

        const result = await pool.request()
            .input("adminId", sql.Int, adminId)
            .query(`
                SELECT *
                FROM customers
                WHERE admin_id = @adminId
                ORDER BY name ASC
            `);

        const rows = result.recordset;

        return res.status(200).json({
            success: true,
            suppliers: rows,
        });

    } catch (e) {
        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}

export const getAllCustomersDebts = async (req, res) => {
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        const adminId = await checkToken(token);

        const result = await pool.request()
            .input("adminId", sql.Int, adminId)
            .query(`
                SELECT
                    id,
                    name,
                    balance AS total_debt
                FROM customers
                WHERE admin_id = @adminId
                ORDER BY name ASC
            `);

        const rows = result.recordset;

        return res.status(200).json({
            success: true,
            customers: rows,
        });

    } catch (e) {
        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}

export const getAllCustomersInfo = async (req, res) => {
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        const adminId = await checkToken(token);

        const result = await pool.request()
            .input("adminId", sql.Int, adminId)
            .query(`
                SELECT
                    id,
                    name
                FROM customers
                WHERE admin_id = @adminId
                ORDER BY name ASC
            `);

        const rows = result.recordset;

        return res.status(200).json({
            success: true,
            customers: rows,
        });

    } catch (e) {
        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}

export const addCustomer = async (req, res) => {
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        const adminId = await checkToken(token);

        const customerData = req.body;

        const parsedData = customerSchema.parse(customerData);

        await pool.request()
            .input("name", sql.NVarChar, parsedData.name)
            .input("phone", sql.NVarChar, parsedData.phone)
            .input("balance", 0)
            .input("adminId", sql.Int, adminId)
            .query(`
                INSERT INTO customers (name, phone, balance, admin_id)
                VALUES (@name, @phone, @balance, @adminId)
            `);

        return res.status(200).json({
            success: true,
            message: "تم إنشاء الحساب بنجاح",
        });
    } catch (e) {
        const validationErrors = e?.errors || e?.issues;

        if (Array.isArray(validationErrors) && validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: validationErrors[0].message
            });
        }

        if (e?.number === 2627 || e?.number === 2601) {
            return res.status(409).json({
                message: "إسم العميل موجود مسبقأ الرجاء إدخال إسم آخر"
            });
        }

        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}

export const updateCustomer = async (req, res) => {
    const customerId = Number(req.query.customer_id);
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        await checkToken(token);
        const customerData = req.body;
        const parsedData = customerSchema.parse(customerData);

        await pool.request()
            .input("name", sql.NVarChar, parsedData.name)
            .input("phone", sql.NVarChar, parsedData.phone)
            .input("customerId", sql.Int, customerId)
            .query(`
                UPDATE customers
                SET name = @name, phone = @phone
                WHERE id = @customerId
            `);

        return res.status(200).json({
            success: true,
            message: "تم تحديث بيانات العميل بنجاح",
        });

    } catch (e) {
        const validationErrors = e?.errors || e?.issues;

        if (Array.isArray(validationErrors) && validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: validationErrors[0].message
            });
        }

        if (e?.number === 2627 || e?.number === 2601) {
            return res.status(409).json({
                message: "إسم العميل موجود مسبقأ الرجاء إدخال إسم آخر"
            });
        }

        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}

export const deleteCustomer = async (req, res) => {
    const customerId = Number(req.query.customer_id);
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        await checkToken(token);

        const hasInvoices = await checkIfTheCustomerHasInvoices(customerId);
        if (hasInvoices) {
            throw new SystemError("لا يمكن حذف هذا العميل بسبب وجود فواتير مسجلة بحسابه", 400);
        }

        await pool.request()
            .input("customerId", sql.Int, customerId)
            .query(`
                DELETE FROM customers
                WHERE id = @customerId
            `);

        return res.status(200).json({
            success: true,
            message: "تم حذف العميل بنجاح",
        });

    } catch (e) {
        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}



async function checkIfTheCustomerHasInvoices(customerId) {
    const result = await pool.request()
        .input("customerId", sql.Int, customerId)
        .query(`
            SELECT TOP 1 id
            FROM customers_orders
            WHERE customer_id = @customerId
        `);

    return result.recordset[0]?.id;
}




const customerSchema = z.object({
    name: z.string()
        .trim()
        .min(2, "الاسم يجب أن يحتوي على حرفين على الأقل")
        .regex(
            /^[\u0600-\u06FFa-zA-Z0-9\s]+$/,
            "الاسم يجب أن يحتوي على حروف وأرقام فقط"
        ),

    phone: z.string()
        .trim()
        .regex(
            /^05\d{8}$/,
            "رقم الجوال يجب أن يكون 10 أرقام ويبدأ بـ 05"
        )
        .nullable()
});
