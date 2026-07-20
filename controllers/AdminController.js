import { StatusCode } from "../HTTPSStatusCode/StatusCode.js";
import { pool , sql } from "../DataBaseConnections/dbconnection.js";
import { SystemError } from "../shared/functionality.js";
import { z } from "zod";
import { SignJWT } from "jose";
import bcrypt from "bcrypt";



export const loginAsAdmin = async (req, res) => {

    try {
        const {name, password} = req.body;

        const adminResult = await pool
            .request()
            .input("user_name", sql.NVarChar, name)
            .query("SELECT * FROM admin WHERE name = @user_name");


        const admin = adminResult.recordset[0];



         if (!admin){
            throw new SystemError("اسم المستخدم أو كلمة المرور غير صحيحة", 401);
        }

        const correctPassword = await checkPassword(password , admin.admin_password);
        if(!correctPassword){
            throw new SystemError("إسم المستخدم أو كلمة المرور غير صحيحة", 401);
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

async function checkPassword(password, hash) {
    const isMatch = await bcrypt.compare(password, hash);

    return isMatch;
}

async function hashPassword(password) {
    const saltRounds = 12;

    const hash = await bcrypt.hash(password, saltRounds);

    return hash;
}