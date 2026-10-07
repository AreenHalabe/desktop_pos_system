import  express  from "express";
import { createInvoiceFromSupplier } from "../controllers/InvoicesController.js";

export const InvoiceRoute = express.Router();


InvoiceRoute.post('/invoice/create' , createInvoiceFromSupplier);