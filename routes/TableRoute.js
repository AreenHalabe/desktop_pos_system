import  express  from "express";
import { addNewTable, deleteTable, destroyTables, getAllTable, LoadOrdersAccordingTables, moveOrder } from "../controllers/TableController.js";

export const TableRoute = express.Router();

TableRoute.get('/table' , (req , res) => {
        getAllTable(req , res);
    }
);

TableRoute.post('/table/add' , (req , res) => {
        addNewTable(req , res);
    }
);


TableRoute.delete('/table/delete' , (req , res) =>{
        deleteTable(req , res);
    }
);

TableRoute.delete('/table/destroy' , (req , res) =>{
        destroyTables(req , res);
    }
);

TableRoute.get('/table/orders' , (req , res) => {
        LoadOrdersAccordingTables(req , res);
    }
);

TableRoute.put('/table/move' , (req , res)=>{
        moveOrder(req , res);
    }
);