import  express  from "express";
import { body,query} from "express-validator";

import { loginAsCashier , loginAsAdmin } from "../controllers/AdminController.js";
export const AdminRoute = express.Router();

AdminRoute.post('/login',async(req , res)=>{
        loginAsCashier(req,res);
    }
);

AdminRoute.post('/login-as-admin',async(req , res)=>{
        loginAsAdmin(req,res);
    }
);