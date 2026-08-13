import  express  from "express";
import { createTransaction, deleteTransaction, loadTransactions } from "../controllers/TransactionController.js";

export const TransactionRoute = express.Router();

TransactionRoute.get('/load-transaction/according-to-session' , loadTransactions);


TransactionRoute.post('/creat-transaction' , createTransaction);


TransactionRoute.delete('/delete-transaction' , deleteTransaction);