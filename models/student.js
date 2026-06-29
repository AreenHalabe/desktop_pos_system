import mongoose, { Schema } from "mongoose";

const StudentSchema = new Schema({
    name : {type:String , unique: true , index:true},
    class : {type:String , index:true},
    fatherPhone : String,
    motherPhone : String,
    section : { type: Number, index:true,integer: true, min: -2147483648, max: 2147483647 },
});

export const Student = mongoose.model("students" , StudentSchema);