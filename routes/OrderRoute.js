import  express  from "express";
import { createOrder, deleteOrder, getDaliyOrders, restoreOrderItems } from "../controllers/OrderController.js";

export const OrderRoute = express.Router();


OrderRoute.post('/creat/order' , createOrder);

OrderRoute.put('/delete/order' , deleteOrder);

OrderRoute.put('/order/update' , restoreOrderItems);

OrderRoute.get('/daily/completed/deleted/orders' , getDaliyOrders);

