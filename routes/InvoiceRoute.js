import  express  from "express";
import { createInvoiceFromSupplier, deleteInvoice, payIncoice, editInvoice, deletePayment, getInvoice } from "../controllers/InvoiceController.js";

export const InvoiceRoute = express.Router();

InvoiceRoute.get('/invoice' , getInvoice);
InvoiceRoute.post('/invoice/add' , createInvoiceFromSupplier);
InvoiceRoute.post('/invoice/payment' , payIncoice);

InvoiceRoute.put('/invoice/update', editInvoice);

InvoiceRoute.delete('/invoice/delete', deleteInvoice);


InvoiceRoute.delete('/payment/delete', deletePayment);
