const { getDb } = require('./db');
const { ask } = require('./llm');

const COLLECTION = 'channels';

/**
 * Called the first time the bot becomes admin in a channel.
 * Pulls the channel's own name/description, asks the LLM to summarize
 * its niche + tone, and generates a one-off intro message — unique per
 * channel, not a fixed template, so it doesn't feel copy-pasted.
 */
async function registerChannel(chatId, title, description) {
  const db = getDb();

  const nicheSummary = await ask(
    `A Telegram channel is named "${title}" and has this description: ` +
      `"${description || '(no description provided)'}".\n\n` +
      `In 2-3 sentences, summarize: (1) what topic/niche this channel is about, ` +
      `(2) what tone daily posts should have, (3) whether posts typically need ` +
      `up-to-date/live information from the web or can be evergreen content.`
  );

  const introText = await ask(
    `You've just been added as the posting bot for a Telegram channel.\n` +
      `Channel niche: "${nicheSummary}"\n\n` +
      `Write a short, warm introduction post (under 400 characters) telling ` +
      `the channel you'll be sharing daily content matched to this channel's ` +
      `topic. Do NOT call yourself a "moderator" or "admin" \u2014 you only post ` +
      `content, you don't moderate or enforce rules. Match the tone to the ` +
      `niche. Vary your phrasing \u2014 don't use a generic corporate greeting. ` +
      `Output only the message text, nothing else.`
  );

  // lastPostedAt is set to "now" (not left null) so the very next
  // heartbeat doesn't immediately fire a second post right after the
  // intro — the channel's normal cadence starts from here.
  const doc = {
    chatId: String(chatId),
    title,
    description: description || '',
    nicheSummary,
    postingFrequencyHours: 24,
    lastPostedAt: Date.now(),
    recentPosts: [],
    active: true,
    createdAt: Date.now(),
  };

  await db.collection(COLLECTION).doc(String(chatId)).set(doc);
  return { ...doc, introText };
}

async function deactivateChannel(chatId) {
  const db = getDb();
  await db.collection(COLLECTION).doc(String(chatId)).update({ active: false });
}

async function getDueChannels() {
  const db = getDb();
  const snap = await db.collection(COLLECTION).where('active', '==', true).get();
  const now = Date.now();

  return snap.docs
    .map((d) => d.data())
    .filter((ch) => {
      if (!ch.lastPostedAt) return true;
      const dueAt = ch.lastPostedAt + ch.postingFrequencyHours * 60 * 60 * 1000;
      return now >= dueAt;
    });
}

/**
 * Records a post and updates lastPostedAt. Keeps only the last 10 posts
 * per channel so the doc doesn't grow unbounded — that's plenty of
 * history for the LLM to avoid repeating itself.
 */
async function markPosted(chatId, postText) {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(String(chatId));
  const doc = await ref.get();
  const existing = doc.exists ? doc.data().recentPosts || [] : [];

  const recentPosts = [...existing, { text: postText, postedAt: Date.now() }].slice(-10);

  await ref.update({ lastPostedAt: Date.now(), recentPosts });
}

module.exports = { registerChannel, deactivateChannel, getDueChannels, markPosted };
