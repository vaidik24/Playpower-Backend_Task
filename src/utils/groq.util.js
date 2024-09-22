import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQAPI_KEY });

export async function getGroqChatCompletion(content) {
  return groq.chat.completions.create({
    messages: [
      {
        role: "user",
        content: content,
      },
    ],
    model: "llama3-8b-8192",
  });
}

export async function getSuggestionsForIncorrectAnswers(incorrectResponses) {
  return groq.chat.completions.create({
    messages: [
      {
        role: "user",
        content: `The user answered some questions incorrectly. For each, provide a brief explanation of the correct answer and offer exactly 2 to 3 specific suggestions to improve in the related topic. Do not provide any additional information or explanations beyond the suggestions.

Questions and responses:

${incorrectResponses
  .map(
    (r) =>
      `Question: ${r.question}\nCorrect Answer: ${r.correctAnswer}\nUser's Response: ${r.userResponse}`
  )
  .join("\n\n")}
`,
      },
    ],
    model: "llama3-8b-8192",
  });
}
