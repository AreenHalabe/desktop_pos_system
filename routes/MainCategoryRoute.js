import  express  from "express";
import { getMainCategoryTree, addMainCategory, editMainCategor, updateMainCategory, deleteMainCategory, getMainCategoryList } from "../controllers/MainCategoryController.js";

export const MainCategoryRoute = express.Router();


MainCategoryRoute.get('/maincategory/list' , getMainCategoryList);

MainCategoryRoute.get('/maincategory/details' , getMainCategoryTree);

MainCategoryRoute.post('/maincategory/add' , addMainCategory);

MainCategoryRoute.get('/maincategory/edit' , editMainCategor);

MainCategoryRoute.put('/maincategory/update' , updateMainCategory);

MainCategoryRoute.delete('/maincategory/delete' , deleteMainCategory);