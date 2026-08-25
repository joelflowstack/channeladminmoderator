const { askJson, ask } = require('./llm');
const { webSearch } = require('./search');
const { saveSearchCache } = require('./channels');

function todayStr() {
  return new Date().toISOString().slice(0, 10); // e.g. "2026-08-25"
}

/**
 * Decides once per day whether this channel's content needs fresh info
 * from the web, and if so, what to search for. A motivational-quotes
 * channel might say needsSearch: false; a live-odds channel needs a
 * specific query. This only runs once per calendar day per channel —
 * every post after the first that day reuses the cached result.
 */
async function planSearch(channel) {
  return askJson(
    `Channel niche summary: "${channel.nicheSummary}"\n\n` +
      `Decide what kind of info today's posts should be based on. Return JSON:\n` +
      `{\n` +
      `  "needsSearch": boolean,\n` +
      `  "searchQuery": string | null  // specific, e.g. "football fixtures today"\n` +
      `}`
  );
}

/**
 * Gets today's search context for a channel, running a fresh Tavily
 * search only if one hasn't already been done today. This is what
 * keeps search usage flat (1/channel/day) even as posting frequency
 * increases — multiple posts share the same cached search.
 */
async function getTodaysSearchContext(channel) {
  const today = todayStr();

  if (channel.searchCacheDate === today && channel.searchCache) {
    return channel.searchCache;
  }

  const plan = await planSearch(channel);
  let cache;

  if (plan.needsSearch && plan.searchQuery) {
    const results = await webSearch(plan.searchQuery);
    cache = { needsSearch: true, ...results };
  } else {
    cache = { needsSearch: false };
  }

  await saveSearchCache(channel.chatId, cache, today);
  return cache;
}

/**
 * Writes one post using the day's (possibly cached) search context.
 * Called multiple times per day per channel — post history keeps each
 * call's output from repeating the same angle on the same data.
 */
async function generatePost(channel) {
  const searchContext = await getTodaysSearchContext(channel);

  const contextBlock = searchContext.needsSearch
    ? `Here is today's web search info to base posts on — the same data ` +
      `may be used across several posts today, so focus on a DIFFERENT ` +
      `slice/angle of it each time:\n` +
      `Summary: ${searchContext.answer || '(none)'}\n` +
      (searchContext.results || [])
        .map((r) => `- ${r.title}: ${r.content}`)
        .join('\n')
    : `No live data needed for this content — write from general knowledge.`;

  const recentPosts = channel.recentPosts || [];
  const postsToday = recentPosts.filter(
    (p) => new Date(p.postedAt).toISOString().slice(0, 10) === todayStr()
  );

  const historyBlock = recentPosts.length
    ? `Recent posts to this channel (avoid repeating the same angle, phrasing, or ` +
      `structure as these — this especially matters if today's posts share the ` +
      `same underlying search data):\n` +
      recentPosts
        .slice(-6)
        .map((p) => `- ${p.text}`)
        .join('\n')
    : '';

  const postText = await ask(
    `You post content to a Telegram channel — you write in a way that feels ` +
      `native to this specific community, not generic.\n` +
      `Channel niche: "${channel.nicheSummary}"\n` +
      `This will be post #${postsToday.length + 1} for this channel today.\n\n` +
      `${contextBlock}\n\n` +
      `${historyBlock}\n\n` +
      `Write the post now. Keep it under 600 characters, match the channel's tone, ` +
      `use light emoji if appropriate, no hashtags spam, no markdown headers. ` +
      `Vary your structure, opening line, and specific focus from recent posts above. ` +
      `Output only the post text, nothing else.`
  );

  // Rotate through available images across the day's posts instead of
  // always grabbing the first one, so repeated posts aren't visually identical.
  const images = searchContext.images || [];
  const imageUrl = images.length ? images[postsToday.length % images.length] : null;

  return { text: postText, imageUrl };
}

module.exports = { planSearch, generatePost };
