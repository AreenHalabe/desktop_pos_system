import  express  from "express";
import { createInvoiceFromSupplier } from "../controllers/InvoiceController.js";

export const InvoiceRoute = express.Router();


InvoiceRoute.post('/invoice/add' , createInvoiceFromSupplier);