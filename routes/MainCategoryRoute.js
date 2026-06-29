import  express  from "express";
import { body,query} from "express-validator";
import { getMainCategoryTree, addMainCategory, editMainCategor, updateMainCategory, deleteMainCategory, getMainCategoryList } from "../controllers/MainCategoryController.js";

export const MainCategoryRoute = express.Router();


MainCategoryRoute.get('/maincategory/list' , async(req , res) => {
        getMainCategoryList(req , res);
    }
);

MainCategoryRoute.get('/maincategory/details',async(req , res)=>{
        getMainCategoryTree(req,res);
    }
);

MainCategoryRoute.post('/maincategory/add',async(req , res)=>{
        addMainCategory(req,res);
    }
);
MainCategoryRoute.get('/maincategory/edit',async(req , res)=>{
        editMainCategor(req,res);
    }
);
MainCategoryRoute.put('/maincategory/update',async(req , res)=>{
        updateMainCategory(req,res);
    }
);
MainCategoryRoute.delete('/maincategory/delete',async(req , res)=>{
        deleteMainCategory(req,res);
    }
);