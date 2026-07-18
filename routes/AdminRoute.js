import  express  from "express";

import { loginAsAdmin } from "../controllers/AdminController.js";
export const AdminRoute = express.Router();


AdminRoute.post('/login-as-admin',async(req , res)=>{
        loginAsAdmin(req,res);
    }
);