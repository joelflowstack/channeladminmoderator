const { getDb } = require('./db');
const { ask } = require('./llm');

const COLLECTION = 'channels';

/**
 * Called the first time the bot becomes admin in a channel.
 * Pulls the channel's own name/description and asks the LLM to
 * summarize its niche + tone, so we don't have to re-classify on
 * every single post.
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

  const doc = {
    chatId: String(chatId),
    title,
    description: description || '',
    nicheSummary,
    postingFrequencyHours: 24,
    lastPostedAt: null,
    active: true,
    createdAt: Date.now(),
  };

  await db.collection(COLLECTION).doc(String(chatId)).set(doc);
  return doc;
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

async function markPosted(chatId) {
  const db = getDb();
  await db
    .collection(COLLECTION)
    .doc(String(chatId))
    .update({ lastPostedAt: Date.now() });
}

module.exports = { registerChannel, deactivateChannel, getDueChannels, markPosted };
