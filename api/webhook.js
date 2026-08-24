const { bot } = require('../lib/bot');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(200).send('channel-poster-bot webhook is alive');
    return;
  }

  try {
    await bot.handleUpdate(req.body, res);
  } catch (err) {
    console.error('Webhook error:', err);
  }

  if (!res.writableEnded) {
    res.status(200).end();
  }
};
