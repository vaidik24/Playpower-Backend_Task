import { Quiz } from "../models/quiz.model.js";
import {
  getGroqChatCompletion,
  getSuggestionsForIncorrectAnswers,
} from "../utils/groq.util.js";
import { User } from "../models/user.model.js";

// AI-Driven Quiz Generation

const generateQuiz = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { grade, subject, totalQuestions, difficulty } = req.body;

  try {
    // Define the prompt for generating quiz questions
    const prompt = `
    Generate ${totalQuestions} quiz questions with answers for ${subject} at grade ${grade} level with ${difficulty} difficulty.
    Follow this specific format:
    1. [Question]
    A) [Option A]
    B) [Option B]
    C) [Option C]
    D) [Option D]
    **Answer:** [Correct Answer in format: Letter) Answer]
    
    Example:
    1. What is the sum of 2 + 1?
    A) 1
    B) 2
    C) 3
    D) 4
    **Answer:** C) 3
    
    Please provide the questions exactly in this format. do exactly as i say don't differ from it
    `;
    // Call the AI model to generate quiz questions
    const aiResponse = await getGroqChatCompletion(prompt);

    // Extract the message content from the response
    const generatedQuestionsRaw = aiResponse.choices[0]?.message?.content || "";

    // console.log("AI Response:", generatedQuestionsRaw);

    // Split the response based on question numbers (e.g., "1. ", "2. ", etc.)
    const questionBlocks = generatedQuestionsRaw.split(/\n\d+\.\s+/).slice(1); // Ignore the first element (any text before the first question)

    const generatedQuestions = questionBlocks.map((block, index) => {
      const lines = block.split("\n");

      // Extract the question, which should be the first line
      const question = lines[0].trim();

      // Find the options (lines starting with A), B), C), D))
      const options = lines.slice(1, 5).map((line) => {
        return line.substring(3).trim(); // Remove the "A)", "B)", "C)", "D)"
      });

      // Find the answer line that contains "**Answer:**"
      const answerLine = lines.find((line) => line.startsWith("**Answer:**"));
      const correctAnswer = answerLine
        ? answerLine.split("**Answer:** ")[1][0].trim() // Extract the correct answer text
        : null;

      console.log(correctAnswer);

      return {
        questionId: `q${index + 1}`, // Unique ID for the question
        question: question, // The question text
        options: options, // The array of options
        correctAnswer: correctAnswer, // The correct answer text
      };
    });

    // Create a new quiz object to save in the database
    const newQuiz = new Quiz({
      grade,
      subject,
      questions: generatedQuestions,
      date: new Date(),
    });

    // Save the new quiz to the database
    await newQuiz.save();

    // Return the newly created quiz in the response
    return res.status(201).json({ quiz: newQuiz });
  } catch (error) {
    console.error("Error generating quiz from AI:", error);
    return res.status(500).json({ message: "Error generating quiz from AI" });
  }
};

const submitQuiz = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { quizId, responses } = req.body;
  const username = req.user.username; // Get the username of the logged-in user

  try {
    // Fetch the quiz using the quizId
    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    let score = 0;
    const totalQuestions = quiz.questions.length;
    const incorrectResponses = []; // To track incorrect responses with details

    // Evaluate the responses and calculate the score
    const details = responses.map((response) => {
      const question = quiz.questions.find(
        (q) => q._id.toString() === response.questionId
      );

      if (question) {
        const isCorrect = question.correctAnswer === response.userResponse;
        if (isCorrect) {
          score += 1;
        } else {
          // If the answer is wrong, collect the question, correct answer, and user response
          incorrectResponses.push({
            question: question.question,
            correctAnswer: question.correctAnswer,
            userResponse: response.userResponse,
          });
        }

        return {
          questionId: response.questionId,
          correctAnswer: question.correctAnswer,
          userResponse: response.userResponse,
          isCorrect: isCorrect,
        };
      }

      return {
        questionId: response.questionId,
        correctAnswer: null,
        userResponse: response.userResponse,
        isCorrect: false,
      };
    });

    const finalScore = (score / totalQuestions) * 100;

    // Store the attempt in the quiz's attempts array
    const newAttempt = {
      score: finalScore,
      details: details,
      date: new Date(),
    };

    quiz.attempts.push(newAttempt); // Add the new attempt to the quiz
    await quiz.save(); // Save the quiz with the new attempt

    // Find the user by username
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Check if the quiz is already in the user's quiz history
    const quizInHistory = user.quizHistory.includes(quizId);

    // If quiz is not already in the quiz history, add it
    if (!quizInHistory) {
      user.quizHistory.push(quizId); // Add the quiz ID to the user's quizHistory array
      await user.save(); // Save the user with updated quiz history
    }

    // Generate AI suggestions based on incorrect answers
    let suggestions = [];
    let suggestionsResponse;
    if (incorrectResponses.length > 0) {
      suggestionsResponse = await getSuggestionsForIncorrectAnswers(
        incorrectResponses
      ); // Send incorrect responses for AI suggestions
    }
    suggestions =
      suggestionsResponse?.choices[0]?.message?.content?.split("\n"); // Extract the suggestions from the AI response

    console.log(incorrectResponses);

    return res.status(200).json({
      quizId,
      score: finalScore,
      message: "Quiz evaluated and saved to quiz history",
      details,
      suggestions, // Include the AI-generated suggestions in the response
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error evaluating quiz" });
  }
};

// Retrieve Quiz History with Filters
const getQuizHistory = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { grade, subject, from, to } = req.query;
  const username = req.user.username; // Get the logged-in username
  console.log("username:", username);

  try {
    // Filter for the logged-in user
    const filter = { username };

    // Add optional query filters for grade, subject, and date range
    if (grade) filter["quizHistory.grade"] = grade;
    if (subject) filter["quizHistory.subject"] = subject;
    if (from && to) {
      filter["quizHistory.attempts.date"] = {
        $gte: new Date(from),
        $lte: new Date(to),
      };
    }
    console.log("filter:", filter);
    // Find the user and populate quiz history along with the attempts
    const user = await User.findOne({ username }).lean();
    const user_quizHistory = user.quizHistory;
    // console.log(user_quizHistory);
    const allQuizOfUser = [];
    for (let i = 0; i < user_quizHistory.length; i++) {
      allQuizOfUser.push(await Quiz.findById(user_quizHistory[i].toString()));
    }

    return res.status(200).json({ quizzes: allQuizOfUser });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error retrieving quiz history" });
  }
};

// Retake Quiz
const retakeQuiz = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { quizId } = req.body; // Only quizId is needed to fetch the quiz questions

  try {
    // Fetch the original quiz by its ID
    const quiz = await Quiz.findById(quizId).lean();
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    // Return only the quiz questions to the user for retake
    const quizQuestions = quiz.questions.map((q) => ({
      questionId: q._id,
      question: q.question,
      options: q.options, // Assuming multiple-choice type
      correctAnswer: q.correctAnswer,
    }));

    return res.status(200).json({
      message: "Quiz questions fetched for retake",
      questions: quizQuestions, // Return only the questions
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error fetching quiz questions" });
  }
};

//Generate hint for question
const generateHint = async (req, res) => {
  const { quizId, questionId } = req.params;
  //log the param
  // console.log("quizId:", quizId);
  // console.log("questionId:", questionId);
  try {
    // Find the quiz by ID
    const quiz = await Quiz.findById(quizId);
    //log quiz
    // console.log(quiz);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Find the question by ID within the quiz
    const question = quiz.questions.find(
      (q) => q._id.toString() === questionId
    );
    //log question
    // console.log(question);

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    // Prepare the AI prompt with the question content
    const aiPrompt = `Provide a hint for this quiz question:\n[Question: "${question.question}"]\nThe hint should not give away the correct answer, but guide the user toward understanding the concept. and make the hint as small as possible.`;

    // Make a request to the AI model (e.g., OpenAI's GPT) to generate a hint
    const response = await getGroqChatCompletion(aiPrompt);

    //log response
    // console.log(response);
    // Extract the hint from the AI response
    const hint = response.choices[0]?.message?.content || "";

    // Return the hint to the user
    return res.status(200).json({
      questionId,
      hint,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error generating hint" });
  }
};

export { generateQuiz, submitQuiz, getQuizHistory, retakeQuiz, generateHint };
