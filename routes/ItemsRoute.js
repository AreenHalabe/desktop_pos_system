import  express  from "express";
import { addItem, deleteItem, getItem, updateItem, filterItemsByCategory, getMenueTree, getAllItems } from "../controllers/ItemsController.js";

export const ItemRoute = express.Router();


ItemRoute.get('/item/get' , async(req , res) => {
        getItem(req , res);
    }
);


ItemRoute.get('/items', async(req , res) =>{
        getAllItems(req , res);
    }
);

ItemRoute.post('/item/add' , async(req , res) => {
        addItem(req , res);
    }
);

ItemRoute.put('/item/update' , async(req , res) => {
        updateItem(req , res);
    }
);

ItemRoute.delete('/item/delete' , async(req , res) =>{
        deleteItem(req , res);
    }
);


ItemRoute.get('/item/by-category' , async(req , res) =>{
        filterItemsByCategory(req , res);
    }
);


ItemRoute.get('/menu/details' , (req , res) => {
        getMenueTree(req , res);
    }
)
