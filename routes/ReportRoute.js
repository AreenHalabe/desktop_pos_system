import  express  from "express";
import { getFinancialAnalysis, getItemsSellingAnalysis, getOrderAnalysis, getPerformanceAnalysis, getTransactionsForSessions, getWeklyAnalysis, loadMoreOrdersAnalysis } from "../controllers/ReportController.js";

export const ReportRoute = express.Router();


ReportRoute.post('/reports/home' , (req , res) => {
        getWeklyAnalysis(req , res);
    }
);

ReportRoute.post('/reports/financial/sessions' , (req , res) => {
        getFinancialAnalysis(req , res);
    }
);


ReportRoute.post('/reports/financial/transactions' , (req , res) => {
        getTransactionsForSessions(req , res);
    }
);



ReportRoute.post('/reports/orders/details' , (req , res) =>{
        getOrderAnalysis(req , res);
    }
);

ReportRoute.post('/reports/orders/list' , (req , res) => {
        loadMoreOrdersAnalysis(req , res);
    }
);


ReportRoute.get('/reports/items-selling-details' , (req , res) => {
        getItemsSellingAnalysis(req , res);
    }
);




ReportRoute.post('/reports/performance-analysis' , (req , res) =>{
        getPerformanceAnalysis(req , res);
    }
);