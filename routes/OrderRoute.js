import  express  from "express";
import { createOrder, deleteOrder, getDaliyOrders } from "../controllers/OrderController.js";

export const OrderRoute = express.Router();


OrderRoute.post('/creat/order' , createOrder);

OrderRoute.put('/delete/order' , deleteOrder);

OrderRoute.get('/daily/completed/deleted/orders' , getDaliyOrders);

