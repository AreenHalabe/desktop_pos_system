import  express  from "express";
import { createInvoiceFromSupplier, deleteInvoice, payIncoice, deletePayment, getInvoice, updateInvoice }from "../controllers/InvoicesController.js";

export const InvoiceRoute = express.Router();


InvoiceRoute.post('/invoice/create' , createInvoiceFromSupplier);


InvoiceRoute.get('/invoice' , getInvoice);

InvoiceRoute.post('/invoice/payment' , payIncoice);

InvoiceRoute.put('/invoice/update', updateInvoice);

InvoiceRoute.delete('/invoice/delete', deleteInvoice);


InvoiceRoute.delete('/payment/delete', deletePayment);
