import  express  from "express";

import { loginAdmin,  loginAsCashier} from "../controllers/AdminController.js";
export const AdminRoute = express.Router();

AdminRoute.post('/login',async(req , res)=>{
        loginAsCashier(req,res);
    }
);

AdminRoute.post('/login-as-admin',async(req , res)=>{
        loginAdmin(req , res);
    }
);