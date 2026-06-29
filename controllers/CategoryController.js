import { body, query } from "express-validator";
import { StatusCode } from "../HTTPSStatusCode/StatusCode.js";
import { pool , sql} from "../DataBaseConnections/dbconnection.js";
import { checkToken , SystemError} from "../shared/functionality.js";
import { z } from "zod";

export const getCategoryList = async (req, res) => {
    const adminId = Number(req.query.admin_id);

    try {
        const result = await pool.request()
            .input("admin_id", sql.Int, adminId)
            .query(`
            SELECT id, name 
            FROM categories 
            WHERE admin_id = @admin_id
        `);

        const categories = result.recordset;

        return res.status(200).json(categories);

    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}



export const addCategory = async (req, res) => {
    try {
        const token = req.headers.authorization;

        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }

        const adminId = await checkToken(token);

        const { name , main_category_id } = req.body;

        const mainCategoryId = Number(main_category_id);


        const parsedData = CategorySchema.parse({ name });

        await pool.request()
            .input("admin_id", sql.Int, adminId)
            .input("name", sql.NVarChar, parsedData.name)
            .input("main_category_id", sql.Int, mainCategoryId)
            .query(`
                INSERT INTO categories (admin_id, name, main_category_id)
                VALUES (@admin_id, @name, @main_category_id)
        `);

        return res.status(200).json({
            message: "تم إنشاء الفئة بنجاح"
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
                message: "إسم الفئة موجود مسبقأ الرجاء إدخال إسم آخر"
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

export const updateCategory = async (req, res) => {
    const categoryId = Number(req.query.category_id);

    try {
        const token = req.headers.authorization;

        if(!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }

        await checkToken(token);

        const { name , main_category_id} = req.body;
        const parsedData = CategorySchema.parse({ name });
        const mainCategoryId = Number(main_category_id);

        await pool.request()
                .input("name", sql.NVarChar, parsedData.name)
                .input("main_category_id", sql.Int, mainCategoryId)
                .input("id", sql.Int, categoryId)
                .query(`
            UPDATE categories
            SET name = @name, main_category_id = @main_category_id
            WHERE id = @id
        `);

        return res.status(StatusCode.Ok).json({
            message: "تم تعديل الفئة بنجاح"
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
                message: "إسم الفئة موجود مسبقأ الرجاء إدخال إسم آخر"
            });
        }

        const status = e.status || StatusCode.ServerError;

        return res.status(status).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف"
        });
    }
}

export const deleteCategory = async (req, res) => {
    const categoryId = Number(req.query.category_id);

    try {
        const token = req.headers.authorization;
        if (!token) {
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }

        await checkToken(token);

        // حذف التصنيف
        const result = await pool.request()
            .input("id", categoryId)
            .query(`
            DELETE FROM categories 
            WHERE id = @id
        `);


        return res.status(200).json({
            message: "تم حذف الفئة بنجاح"
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



const CategorySchema = z.object({
    name: z
        .string()
        .min(1, "الاسم مطلوب")
        .regex(/^[\p{L}\s]+$/u, "يسمح بالحروف فقط"),
});