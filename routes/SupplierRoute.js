import  express  from "express";
import { getSuppliers, addSupplier, updateSupplier, deleteSupplier } from "../controllers/SupplierController.js";

export const SupplierRoute = express.Router();


SupplierRoute.get('/suppliers' , async(req , res) => {
        getSuppliers(req , res);
    }
);

SupplierRoute.post('/supplier/add' , async(req , res) => {
        addSupplier(req , res);
    }
);

SupplierRoute.put('/supplier/update' , async(req , res) => {
        updateSupplier(req , res);
    }
);

SupplierRoute.delete('/supplier/delete' , async(req , res) => {
        deleteSupplier(req , res);
    }
);
