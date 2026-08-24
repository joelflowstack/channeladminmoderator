// Run once after each Vercel deploy (or when the URL changes):
//   VERCEL_URL=your-project.vercel.app TELEGRAM_BOT_TOKEN=xxx node scripts/set-webhook.js
const fetch = require('node-fetch');

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const domain = process.env.VERCEL_URL;

  if (!token || !domain) {
    console.error('Set TELEGRAM_BOT_TOKEN and VERCEL_URL env vars first.');
    process.exit(1);
  }

  const webhookUrl = `https://${domain}/api/webhook`;
  const res = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
  );
  const data = await res.json();
  console.log(data);
}

main();
