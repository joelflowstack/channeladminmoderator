const { GoogleGenerativeAI } = require('@google/generative-ai');
const fetch = require('node-fetch');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

/**
 * Fallback path via Groq (OpenAI-compatible endpoint). Used automatically
 * whenever Gemini fails for any reason — quota, an account-level flag,
 * a deprecated model name, etc. Same "primary + fallback" pattern as Flow.
 */
async function askGroq(prompt) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq fallback failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.choices[0].message.content.trim();
}

/**
 * Calls Gemini with a plain prompt and returns raw text. Falls back to
 * Groq automatically if Gemini errors for any reason.
 */
async function ask(prompt) {
  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error('Gemini failed, falling back to Groq:', err.message);
    return askGroq(prompt);
  }
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
