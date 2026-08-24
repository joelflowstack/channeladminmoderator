const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

/**
 * Calls Gemini with a plain prompt and returns raw text.
 */
async function ask(prompt) {
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

/**
 * Calls Gemini and expects a JSON object back. Strips markdown fences
 * if the model wraps its answer in ```json ... ```.
 */
async function askJson(prompt) {
  const text = await ask(
    `${prompt}\n\nRespond with ONLY valid JSON, no markdown fences, no preamble.`
  );
  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

module.exports = { ask, askJson };
