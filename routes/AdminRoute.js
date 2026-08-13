import  express  from "express";

import { loginAdmin,  loginAsCashier} from "../controllers/AdminController.js";
export const AdminRoute = express.Router();

AdminRoute.post('/login' , loginAsCashier);

AdminRoute.post('/login-as-admin' , loginAdmin);