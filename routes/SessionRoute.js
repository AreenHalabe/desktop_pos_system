import  express  from "express";
import { checkCashSession, closeSession, getSessionAnalytics, openNewSession } from "../controllers/SessionController.js";

export const SessionRoute = express.Router();

SessionRoute.get('/check/cash-session' , checkCashSession );

SessionRoute.post('/open/cash-session' , openNewSession);


SessionRoute.put('/close/cash-session' , closeSession);


SessionRoute.get('/daily/session-analytics' , getSessionAnalytics);