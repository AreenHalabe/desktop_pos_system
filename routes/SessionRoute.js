import  express  from "express";
import { checkCashSession, closeSession, getSessionAnalytics, openNewSession } from "../controllers/SessionController.js";

export const SessionRoute = express.Router();

SessionRoute.get('/check/cash-session' , async(req , res) => {
        checkCashSession(req , res);
    }
);

SessionRoute.post('/open/cash-session' , async(req , res) => {
        openNewSession(req , res);
    }
);


SessionRoute.put('/close/cash-session' , async(req , res) => {
        closeSession(req , res);
    }
);


SessionRoute.get('/daily/session-analytics' , async(req , res) => {
        getSessionAnalytics(req , res);
    }
);