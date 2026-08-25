const { Telegraf } = require('telegraf');
const { getDueChannels, markPosted } = require('../lib/channels');
const { generatePost } = require('../lib/pipeline');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

module.exports = async (req, res) => {
  // Simple shared-secret check so random internet traffic can't trigger posts.
  const secret = req.query.secret || req.headers['x-heartbeat-secret'];
  if (secret !== process.env.HEARTBEAT_SECRET) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const dueChannels = await getDueChannels();
  const results = [];

  for (const channel of dueChannels) {
    try {
      const post = await generatePost(channel);

      if (post.imageUrl) {
        await bot.telegram.sendPhoto(channel.chatId, post.imageUrl, {
          caption: post.text,
        });
      } else {
        await bot.telegram.sendMessage(channel.chatId, post.text);
      }

      await markPosted(channel.chatId, post.text);
      results.push({ chatId: channel.chatId, status: 'posted' });
    } catch (err) {
      console.error(`Failed to post to ${channel.chatId}:`, err);
      results.push({ chatId: channel.chatId, status: 'error', error: err.message });
    }
  }

  res.status(200).json({ checked: dueChannels.length, results });
};
