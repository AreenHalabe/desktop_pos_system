import { StatusCode } from "../HTTPSStatusCode/StatusCode.js";
import { pool, sql } from "../DataBaseConnections/dbconnection.js";
import { checkToken, SystemError } from "../shared/functionality.js";
import { z } from "zod";

export const getMainCategoryList = async (req, res) => {
    const adminId = Number(req.query.admin_id);

    try {
        const result = await pool.request()
            .input("admin_id", sql.Int, adminId)
            .query(`
            SELECT id, name 
            FROM main_category 
            WHERE admin_id = @admin_id
        `);

        const mainCategories = result.recordset;

        return res.status(200).json(mainCategories);

    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

export const getMainCategoryTree = async (req, res) => {
    try {
        const token = req.headers.authorization;

        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }

        const adminId = await checkToken(token);

        const result = await pool.request().query(`
            SELECT
                mc.id,
                mc.name,
                (
                    SELECT 
                        c.id,
                        c.name,
                        c.main_category_id
                    FROM categories c
                    WHERE c.main_category_id = mc.id
                    FOR JSON PATH
                ) AS categories
            FROM main_category mc
            WHERE mc.admin_id = ${adminId}
        `);

        const data = result.recordset.map(row => ({
            ...row,
            categories: row.categories ? JSON.parse(row.categories) : []
        }));

        return res.status(StatusCode.Ok).json(data);

    } catch (e) {
        const status = e.status || StatusCode.ServerError;
        return res.status(status).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف"
        });
    }
}

export const addMainCategory = async (req, res) => {
    try {
        const token = req.headers.authorization;

        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }

        const adminId = await checkToken(token);

        const { name } = req.body;


        const parsedData = mainCategorySchema.parse({ name });

        await pool.request()
            .input("admin_id", sql.Int, adminId)
            .input("name", sql.NVarChar, parsedData.name)
            .query(`
                INSERT INTO main_category (admin_id, name)
                VALUES (@admin_id, @name)
        `);

        return res.status(200).json({
            message: "تم إنشاء القسم بنجاح"
        });

    } catch (e) {
        const validationErrors = e?.errors || e?.issues;
        if (Array.isArray(validationErrors) && validationErrors.length > 0) {
            return res.status(400).json({
                message: validationErrors[0].message
            });
        }

        if (e?.originalError?.info?.message?.includes("Violation of UNIQUE KEY constraint")) {
            return res.status(409).json({
                message: "إسم القسم موجود مسبقأ الرجاء إدخال إسم آخر"
            });
        }

        const status = e.status || 500;
        const message = e.message || "حدث خطأ غير معروف";

        return res.status(status).json({
            success: false,
            message
        });
    }
}


export const editMainCategor = async (req, res) => {
    const categoryId = Number(req.query.category_id);

    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        await checkToken(token);

        const result = await pool.request().query(`
            SELECT id, name 
            FROM main_category 
            WHERE id = ${categoryId}
        `);

        const category = result.recordset[0] || null;

        return res.status(StatusCode.Ok).json(category);

    } catch (e) {
        const status = e.status || StatusCode.ServerError;

        return res.status(status).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف"
        });
    }
}

export const updateMainCategory = async (req, res) => {
    const categoryId = Number(req.query.category_id);

    try {
        const token = req.headers.authorization;

        if(!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }

        await checkToken(token);

        const { name } = req.body;
        const parsedData = mainCategorySchema.parse({ name });

        await pool.request()
                .input("name", sql.NVarChar, parsedData.name)
                .input("id", sql.Int, categoryId)
                .query(`
            UPDATE main_category
            SET name = @name
            WHERE id = @id
        `);

        return res.status(StatusCode.Ok).json({
            message: "تم تعديل القسم بنجاح"
        });

    } catch (e) {

        const validationErrors = e?.errors || e?.issues;
        if (Array.isArray(validationErrors) && validationErrors.length > 0) {
            return res.status(400).json({
                message: validationErrors[0].message
            });
        }

        if (e.message?.includes("Violation of UNIQUE KEY constraint")) {
            return res.status(409).json({
                message: "إسم القسم موجود مسبقأ الرجاء إدخال إسم آخر"
            });
        }

        const status = e.status || StatusCode.ServerError;

        return res.status(status).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف"
        });
    }
}

export const deleteMainCategory = async (req, res) => {
    const mainCategoryId = Number(req.query.main_category_id);

    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }

        await checkToken(token);

        // حذف التصنيف
        const result = await pool.request()
            .input("id", mainCategoryId)
            .query(`
            DELETE FROM main_category 
            WHERE id = @id
        `);


        return res.status(200).json({
            message: "تم حذف القسم بنجاح"
        });

    } catch (e) {
        const status = e.status || 500;
        const message = e.message || "حدث خطأ غير معروف";
        return res.status(status).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف"
        });
    }
}


const mainCategorySchema = z.object({
    name: z
        .string()
        .min(1, "الاسم مطلوب")
        .regex(/^[\p{L}\s]+$/u, "يسمح بالحروف فقط"),
});