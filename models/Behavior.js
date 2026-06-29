import mongoose, { Schema } from "mongoose";


const BehaviorSchema = new Schema({
    student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'students',
        },
    datesOfBehavior :[ {type:String} ]
});

export const Behavior = mongoose.model("Behaviors" , BehaviorSchema);