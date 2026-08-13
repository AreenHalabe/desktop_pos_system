import  express  from "express";
import { addItem, deleteItem, getItem, updateItem, filterItemsByCategory, getMenueTree, getAllItems } from "../controllers/ItemsController.js";

export const ItemRoute = express.Router();


ItemRoute.get('/item/get' ,  getItem);


ItemRoute.get('/items', getAllItems);

ItemRoute.post('/item/add' , addItem);

ItemRoute.put('/item/update' , updateItem);

ItemRoute.delete('/item/delete' , deleteItem);


ItemRoute.get('/item/by-category' , filterItemsByCategory);


ItemRoute.get('/menu/details' , getMenueTree);
