import mongoose, { Schema } from "mongoose";

const LateSchema = new Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'students',
    },
    datesOfLate :[ {type:String} ]
});

export const Late = mongoose.model("Lates" , LateSchema);