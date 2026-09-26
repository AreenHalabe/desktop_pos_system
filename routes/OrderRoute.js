import  express  from "express";
import { addNewItems, createOrder, deleteOrder, destroyOrderTable, getDaliyOrders, payOrder, editItemsOrder, partialPayOrder } from "../controllers/OrderController.js";

export const OrderRoute = express.Router();


OrderRoute.post('/creat/order' , createOrder);

OrderRoute.put('/delete/order' , deleteOrder);

OrderRoute.get('/daily/completed/deleted/orders' , getDaliyOrders)

OrderRoute.put('/order/add-items' , addNewItems);

OrderRoute.put('/order/edit-items' , editItemsOrder);

OrderRoute.put('/order/partial-pay' , partialPayOrder);

OrderRoute.put('/order/pay' , payOrder);

OrderRoute.delete('/order/destroy-table' , destroyOrderTable);