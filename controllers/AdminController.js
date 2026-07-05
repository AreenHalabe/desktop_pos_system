import { body, query } from "express-validator";
import { StatusCode } from "../HTTPSStatusCode/StatusCode.js";
import { pool , sql } from "../DataBaseConnections/dbconnection.js";
import { SystemError } from "../shared/functionality.js";
import { z } from "zod";
import { SignJWT } from "jose";

export const loginAsCashier = async (req, res) => {
    try {
        const { name, password } = req.body;

        const result = await pool.request()
            .input("name", sql.NVarChar, name)
            .query("SELECT * FROM admin WHERE name = @name");

        

        const admin = result.recordset[0];

        if (!admin || admin.password !== password) {
            throw new SystemError("اسم المستخدم أو كلمة المرور غير صحيحة", 401);
        }

        const token = await generateNewToken(admin.id);

        return res.status(200).json({
            success: true,
            id: admin.id,
            token: token
        });

    } catch (e) {
        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف"
        });
    }

}

export const loginAsAdmin = async (req, res) => {
    const adminId = Number(req.query.admin_id);

    try {
        const {admin_password} = req.body;

        // const passwordHash = await hashPassword(admin_password.trim());

        const adminResult = await pool.request().query(
            `SELECT * FROM admin WHERE id = ${adminId}`
        );

        const admin = adminResult.recordset[0];

        if (!admin || admin.admin_password !== admin_password) {
            throw new SystemError("اسم المستخدم أو كلمة المرور غير صحيحة", 401);
        }

        if (admin.status === 0) {
            throw new SystemError(
                "انتهت صلاحية اشتراكك حالياً. تواصل معنا لتجديده والاستمرار في استخدام الخدمة.",
                403
            );
        }

        const token = await generateNewToken(admin.id);

        return res.status(200).json({
            success: true,
            id: admin.id,
            token: token,
        });

    } catch (e) {
        const status = e.status || 500;
        const message = e.message || "حدث خطأ غير معروف";

        return res.status(status).json({
            success: false,
            message,
        });
    }
}







async function generateNewToken(adminId) {
    // const secretKey = process.env.SECRET_KEY;
    const secretKey = 'eb86b*b$81d2ef0%2767f*b3c37975111710omwqwe4q2^';


    const token = await new SignJWT({ adminId })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("15h")
        .sign(new TextEncoder().encode(secretKey));
    return token;
}