import  express  from "express";
import { addCategory, getCategoryList, updateCategory, deleteCategory } from "../controllers/CategoryController.js";

export const CategoryRoute = express.Router();



CategoryRoute.get('/category/list' , getCategoryList);

CategoryRoute.post('/category/add' , addCategory);


CategoryRoute.put('/category/edit' , updateCategory);

CategoryRoute.delete('/category/delete' , deleteCategory);