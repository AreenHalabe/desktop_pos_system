import {validationResult} from "express-validator";

export const validate = async (req ,res ,next , StatusCode)=>{
    const errors = validationResult(req,res);
    if (!errors.isEmpty()) {
        const errorMsgs = errors.array().map(error => error.msg);
        return res.status(StatusCode).json({ errors: errorMsgs });
    }
    else{
        next();
    }
}