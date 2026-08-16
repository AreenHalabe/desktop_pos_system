import  express  from "express";
import { createInvoiceFromSupplier, deleteInvoice, payIncoice } from "../controllers/InvoiceController.js";

export const InvoiceRoute = express.Router();


InvoiceRoute.post('/invoice/add' , createInvoiceFromSupplier);
InvoiceRoute.post('/invoice/payment' , payIncoice);

InvoiceRoute.delete('/invoice/delete', deleteInvoice);