import express from "express";
import {
  generateQuiz,
  submitQuiz,
  getQuizHistory,
  retakeQuiz,
  generateHint,
} from "../controllers/quiz.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
const quizRouter = express.Router();

// Generate new quiz (AI-based)
quizRouter.post("/generate", authMiddleware, generateQuiz);

// Submit quiz answers and get score
quizRouter.post("/submit", authMiddleware, submitQuiz);

// Get quiz history with filters
quizRouter.get("/history", authMiddleware, getQuizHistory);

// Retake quiz and re-evaluate
quizRouter.get("/retake", authMiddleware, retakeQuiz);

//hint
quizRouter.post("/:quizId/hint/:questionId", authMiddleware, generateHint);

export { quizRouter };
