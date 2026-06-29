import  express  from "express";
import { body,query} from "express-validator";
import { addCategory, getCategoryList, updateCategory, deleteCategory } from "../controllers/CategoryController.js";

export const CategoryRoute = express.Router();


CategoryRoute.get('/category/list' , async(req , res) => {
        getCategoryList(req , res);
    }
);

CategoryRoute.post('/category/add' , async(req , res) => {
        addCategory(req , res);
    }
);

CategoryRoute.put('/category/edit' , async(req , res) => {
        updateCategory(req , res);
    }
);

CategoryRoute.delete('/category/delete' , async(req , res) =>{
        deleteCategory(req , res);
    }
);