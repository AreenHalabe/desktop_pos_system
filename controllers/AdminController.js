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









async function generateNewToken(adminId) {
    // const secretKey = process.env.SECRET_KEY;
    const secretKey = 'eb86b*b$81d2ef0%2767f*b3c37975111710omwqwe4q2^';


    const token = await new SignJWT({ adminId })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("15h")
        .sign(new TextEncoder().encode(secretKey));
    return token;
}