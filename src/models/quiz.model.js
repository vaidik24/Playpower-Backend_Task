import mongoose from "mongoose";

// Schema for quiz attempts
const AttemptSchema = new mongoose.Schema({
  score: { type: Number, required: true }, // Score of the quiz attempt
  details: [
    {
      questionId: String,
      correctAnswer: String,
      userResponse: String,
      isCorrect: Boolean,
    },
  ], // Array of question details for the attempt
  date: { type: Date, default: Date.now }, // Date of the attempt
});

const QuizSchema = new mongoose.Schema({
  grade: { type: String, required: true },
  subject: { type: String, required: true },
  questions: [{ question: String, options: [String], correctAnswer: String }], // Original quiz questions
  attempts: [AttemptSchema], // Array to store all quiz attempts
  date: { type: Date, default: Date.now }, // Date when the quiz was created
});

export const Quiz = mongoose.model("Quiz", QuizSchema);
