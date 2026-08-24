const fetch = require('node-fetch');

/**
 * Runs a web search via Tavily and returns text results + any image URLs.
 * Tavily: 1,000 free queries/month, no card required.
 * https://tavily.com
 */
async function webSearch(query) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      include_images: true,
      include_answer: true,
      max_results: 5,
    }),
  });

  if (!res.ok) {
    throw new Error(`Tavily search failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();

  return {
    answer: data.answer || null,
    results: (data.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
    })),
    images: data.images || [], // array of image URLs
  };
}

module.exports = { webSearch };
