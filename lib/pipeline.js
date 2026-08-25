const { askJson, ask } = require('./llm');
const { webSearch } = require('./search');

/**
 * Stage 1: decide whether today's post needs fresh info from the web,
 * and if so, what to search for. A motivational-quotes channel might
 * say needsSearch: false; a live-odds channel needs a specific query.
 */
async function planPost(channel) {
  return askJson(
    `Channel niche summary: "${channel.nicheSummary}"\n\n` +
      `Decide what today's post should cover. Return JSON:\n` +
      `{\n` +
      `  "needsSearch": boolean,\n` +
      `  "searchQuery": string | null,  // specific, e.g. "football fixtures today"\n` +
      `  "postAngle": string  // one sentence on what the post should focus on\n` +
      `}`
  );
}

/**
 * Stage 2 + 3: run the search (if needed) and write the actual post.
 */
async function generatePost(channel) {
  const plan = await planPost(channel);

  let searchContext = null;
  let imageUrl = null;

  if (plan.needsSearch && plan.searchQuery) {
    const results = await webSearch(plan.searchQuery);
    searchContext = results;
    imageUrl = results.images && results.images[0] ? results.images[0] : null;
  }

  const contextBlock = searchContext
    ? `Here is fresh web search info to base the post on:\n` +
      `Summary: ${searchContext.answer || '(none)'}\n` +
      searchContext.results
        .map((r) => `- ${r.title}: ${r.content}`)
        .join('\n')
    : `No live data needed for this post — write from general knowledge.`;

  const recentPosts = channel.recentPosts || [];
  const historyBlock = recentPosts.length
    ? `Recent posts to this channel (avoid repeating the same angle, phrasing, or ` +
      `structure as these):\n` +
      recentPosts
        .slice(-5)
        .map((p) => `- ${p.text}`)
        .join('\n')
    : '';

  const postText = await ask(
    `You are the admin/moderator of a Telegram channel — you write in a way that ` +
      `feels native to this specific community, not generic.\n` +
      `Channel niche: "${channel.nicheSummary}"\n` +
      `Today's angle: "${plan.postAngle}"\n\n` +
      `${contextBlock}\n\n` +
      `${historyBlock}\n\n` +
      `Write the post now. Keep it under 600 characters, match the channel's tone, ` +
      `use light emoji if appropriate, no hashtags spam, no markdown headers. ` +
      `Vary your structure and opening line from recent posts above. ` +
      `Output only the post text, nothing else.`
  );

  return { text: postText, imageUrl };
}

module.exports = { planPost, generatePost };
