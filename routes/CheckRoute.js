import  express  from "express";
import { createCheck, getChecksHandler, updateCheckStatus, deleteCheck, getChecksRecentAdded } from "../controllers/CheckController.js";

export const CheckRoute = express.Router();


CheckRoute.get('/check/get' , getChecksHandler);
CheckRoute.get('/check/get-recently-added' , getChecksRecentAdded);

CheckRoute.post('/check/add' , createCheck);

CheckRoute.patch('/check/status' , updateCheckStatus);

CheckRoute.delete('/check/delete', deleteCheck);