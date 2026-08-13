import express from "express";
import { getFinancialAnalysis, getItemsSellingAnalysis, getOrderAnalysis, getPerformanceAnalysis, getTransactionsForSessions, getWeklyAnalysis, loadMoreOrdersAnalysis } from "../controllers/ReportController.js";

export const ReportRoute = express.Router();


ReportRoute.post('/reports/home', getWeklyAnalysis);

ReportRoute.post('/reports/financial/sessions', getFinancialAnalysis);


ReportRoute.post('/reports/financial/transactions', getTransactionsForSessions);



ReportRoute.post('/reports/orders/details', getOrderAnalysis);

ReportRoute.post('/reports/orders/list', loadMoreOrdersAnalysis);


ReportRoute.get('/reports/items-selling-details', getItemsSellingAnalysis);




ReportRoute.post('/reports/performance-analysis', getPerformanceAnalysis);