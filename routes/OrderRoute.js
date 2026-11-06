import  express  from "express";
import { createOrder, getAllOrders, deleteSyncedOrder } from "../controllers/OrderController.js";

export const OrderRoute = express.Router();


OrderRoute.post('/creat/order' , createOrder);

OrderRoute.get('/orders' , getAllOrders);

OrderRoute.post('/orders/delete-synced', deleteSyncedOrder);

