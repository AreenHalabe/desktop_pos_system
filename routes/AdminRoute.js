import  express  from "express";

import { loginAsCashier } from "../controllers/AdminController.js";
export const AdminRoute = express.Router();

AdminRoute.post('/login',async(req , res)=>{
        loginAsCashier(req,res);
    }
);

