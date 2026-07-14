import  express  from "express";
import { createOrder, deleteOrder, getDaliyOrders } from "../controllers/OrderController.js";

export const OrderRoute = express.Router();


OrderRoute.post('/creat/order' , (req , res) => {
        createOrder(req , res);
    }
);

OrderRoute.put('/delete/order' , (req , res) =>{
        deleteOrder(req , res);
    }
);

OrderRoute.get('/daily/completed/deleted/orders' , (req , res) =>{
        getDaliyOrders(req , res);
    }
)



