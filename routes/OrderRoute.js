import  express  from "express";
import { addNewItems, createOrder, deleteOrder, destroyOrderTable, getDaliyOrders, payOrder } from "../controllers/OrderController.js";

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

OrderRoute.put('/order/add-items' , (req , res) =>{
        addNewItems(req , res);
    }
);

OrderRoute.put('/order/pay' , (req , res) => {
        payOrder(req , res);
    }
);

OrderRoute.delete('/order/destroy-table' , (req , res) =>{
        destroyOrderTable(req , res);
    }
);