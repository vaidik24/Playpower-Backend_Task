import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  quizHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: "Quiz" }],
});

export const User = mongoose.model("User", UserSchema);
