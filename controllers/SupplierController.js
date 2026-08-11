import { pool, sql } from "../DataBaseConnections/dbconnection.js";
import { checkToken, SystemError } from "../shared/functionality.js";
import { z } from "zod";


export const getSuppliers = async (req, res) => {
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        const adminId = await checkToken(token);

        const result = await pool.request()
            .query(`
                SELECT *
                FROM suppliers
                WHERE admin_id = ${adminId}
                order by name ASC
            `)
            ;
        const suppliers = result.recordset;


        return res.status(200).json({
            success: true,
            suppliers: suppliers,
        });

    } catch (e) {
        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}


export const addSupplier = async (req, res) => {
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        const adminId = await checkToken(token);

        const supplierData = req.body;

        const parsedData = supplierSchema.parse(supplierData);

        const result = await pool.request()
            .input('name', sql.NVarChar, parsedData.name)
            .input('phone', sql.NVarChar, parsedData.phone)
            .input('admin_id', sql.Int, adminId)
            .query(`
                INSERT INTO suppliers (name, phone, admin_id)
                VALUES (@name, @phone, @admin_id);
            `)
            ;

        return res.status(200).json({
            success: true,
            message: "تم إضافة المورد بنجاح",
        });
    } catch (e) {
        const validationErrors = e?.errors || e?.issues;

        if (Array.isArray(validationErrors) && validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: validationErrors[0].message
            });
        }

        if (e?.originalError?.info?.message?.includes("Violation of UNIQUE KEY constraint")) {
            return res.status(409).json({
                message: "إسم المورد موجود مسبقأ الرجاء إدخال إسم آخر"
            });
        }

        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}


export const updateSupplier = async (req, res) => {
    const supplierId = Number(req.query.supplier_id);
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }

        await checkToken(token);

        const supplierData = req.body;
        const parsedData = supplierSchema.parse(supplierData);

        const result = await pool.request()
            .input('id', sql.Int, supplierId)
            .input('name', sql.NVarChar, parsedData.name)
            .input('phone', sql.NVarChar, parsedData.phone)
            .query(`
                UPDATE suppliers
                SET name = @name, phone = @phone
                WHERE id = @id
            `)
            ;

        return res.status(200).json({
            success: true,
            message: "تم تحديث بيانات المورد بنجاح",
        });

    } catch (e) {
        const validationErrors = e?.errors || e?.issues;

        if (Array.isArray(validationErrors) && validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: validationErrors[0].message
            });
        }

        if (e?.originalError?.info?.message?.includes("Violation of UNIQUE KEY constraint")) {
            return res.status(409).json({
                message: "إسم المورد موجود مسبقأ الرجاء إدخال إسم آخر"
            });
        }

        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}


export const deleteSupplier = async (req, res) => {
    const supplierId = Number(req.query.supplier_id);
    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        await checkToken(token);

        const result = await pool.request()
            .input('id', sql.Int, supplierId)
            .query(`
                DELETE FROM suppliers
                WHERE id = @id
            `)
            ;

        return res.status(200).json({
            success: true,
            message: "تم حذف المورد بنجاح",
        });

    } catch (e) {
        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}

const supplierSchema = z.object({
    name: z.string()
        .trim()
        .min(2, "الاسم يجب أن يحتوي على حرفين على الأقل")
        .regex(
            /^[\u0600-\u06FFa-zA-Z\s]+$/,
            "الاسم يجب أن يحتوي على حروف فقط"
        ),

    phone: z.string()
        .trim()
        .regex(
            /^05\d{8}$/,
            "رقم الجوال يجب أن يكون 10 أرقام ويبدأ بـ 05"
        )
        .nullable()
});