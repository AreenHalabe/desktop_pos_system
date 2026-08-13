import  express  from "express";
import { getSuppliers, addSupplier, updateSupplier, deleteSupplier } from "../controllers/SupplierController.js";

export const SupplierRoute = express.Router();


SupplierRoute.get('/suppliers' , getSuppliers);

SupplierRoute.post('/supplier/add' , addSupplier);

SupplierRoute.put('/supplier/update' , updateSupplier);

SupplierRoute.delete('/supplier/delete' , deleteSupplier);
