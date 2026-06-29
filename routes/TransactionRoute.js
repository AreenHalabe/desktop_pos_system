import  express  from "express";
import { body,query} from "express-validator";
import { createTransaction, deleteTransaction, loadTransactions } from "../controllers/TransactionController.js";

export const TransactionRoute = express.Router();

TransactionRoute.get('/load-transaction/according-to-session' , (req , res) => {
        loadTransactions(req , res);
    }
);


TransactionRoute.post('/creat-transaction' , (req , res) => {
        createTransaction(req , res);
    }
)


TransactionRoute.delete('/delete-transaction' , (req , res) => {
        deleteTransaction(req , res);
    }
)