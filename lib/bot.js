const { Telegraf } = require('telegraf');
const { registerChannel, deactivateChannel } = require('./channels');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Fired whenever the bot's own membership status changes in a chat —
// this is how we detect being added/promoted to admin in a channel,
// without polling. No path in this file ever sends a private message
// to a user; it only reacts to channel membership and posts to channels.
bot.on('my_chat_member', async (ctx) => {
  const update = ctx.update.my_chat_member;
  const chat = update.chat;
  const newStatus = update.new_chat_member.status;

  if (chat.type !== 'channel') return;

  if (newStatus === 'administrator') {
    const { introText } = await registerChannel(chat.id, chat.title, chat.description);
    await bot.telegram.sendMessage(chat.id, introText);
  } else if (newStatus === 'left' || newStatus === 'kicked' || newStatus === 'member') {
    // Demoted from admin or removed — stop posting there.
    await deactivateChannel(chat.id);
  }
});

// The bot never initiates a private message — this only replies when a
// user messages it first, so it doesn't leave people hanging.
bot.on('message', async (ctx) => {
  if (ctx.chat.type !== 'private') return;

  await ctx.reply(
    "I'm a channel-posting bot — add me as admin to a channel and I'll " +
      "post daily content matched to that channel's niche. I don't take " +
      'requests or chat over DM, just channel posting.'
  );
});

module.exports = { bot };
