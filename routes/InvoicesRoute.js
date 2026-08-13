import  express  from "express";
import { createInvoiceFromSupplier } from "../controllers/InvoicesController.js";

export const InvoiceRoute = express.Router();


InvoiceRoute.get('/invoice/add' , createInvoiceFromSupplier);