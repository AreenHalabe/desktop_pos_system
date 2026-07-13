import  express  from "express";
import { getDaliyOrders } from "../controllers/OrderController.js";

export const OrderRoute = express.Router();




OrderRoute.get('/daily/completed/deleted/orders' , (req , res) =>{
        getDaliyOrders(req , res);
    }
)


