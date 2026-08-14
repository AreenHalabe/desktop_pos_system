import  express  from "express";
import { getSupplier, getAllSuppliers, addSupplier, updateSupplier, deleteSupplier, getSuppliersItems, getInvoicesForSupplier } from "../controllers/SupplierController.js";

export const SupplierRoute = express.Router();


SupplierRoute.get('/suppliers' , getAllSuppliers);
SupplierRoute.get('/supplier/get' , getSupplier);


SupplierRoute.get('/supplier/items' , getSuppliersItems);

SupplierRoute.post('/supplier/add' , addSupplier);

SupplierRoute.put('/supplier/update' , updateSupplier);

SupplierRoute.delete('/supplier/delete' , deleteSupplier);

SupplierRoute.get('/supplier/invoices' , getInvoicesForSupplier);