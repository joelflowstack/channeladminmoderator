# channel-poster-bot

A Telegram bot you add as admin to any channel. It reads the channel's
name + description, infers the niche, and posts daily content —
researching live info via web search when the niche needs it (e.g. live
scores, prices), and pulling a relevant image straight from the search
results instead of generating one.

No per-channel/per-niche API integration required — one generic
search+write pipeline handles every channel.

## How it works

1. **Add the bot as admin** to a channel (needs "Post Messages" right).
2. Telegram fires a `my_chat_member` update → the bot reads the
   channel's title/description via the update payload, asks Gemini to
   summarize the niche + tone, and stores a channel profile in
   Firestore.
3. A **heartbeat** endpoint (hit on a schedule by cron-job.org) checks
   which channels are due for a post, and for each one:
   - asks the LLM whether today's post needs live web info, and what
     to search for
   - if yes, calls Tavily search and grabs a relevant image URL from
     the results
   - asks the LLM to write the actual post
   - sends it to the channel (as a photo+caption if an image was
     found, otherwise plain text)

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in:
   - `TELEGRAM_BOT_TOKEN` — from @BotFather
   - `GEMINI_API_KEY` — Google AI Studio, free tier
   - `TAVILY_API_KEY` — tavily.com, 1,000 free searches/month, no card
   - `FIREBASE_SERVICE_ACCOUNT_BASE64` — base64 of your Firebase
     service account JSON: `base64 -i service-account.json`
   - `HEARTBEAT_SECRET` — any random string, protects the heartbeat
     endpoint from being triggered by strangers
3. Deploy to Vercel, add the same env vars in the Vercel dashboard.
4. Run `scripts/set-webhook.js` once to point Telegram at your deployed
   `/api/webhook`.
5. On cron-job.org, schedule a GET request to
   `https://<your-domain>/api/heartbeat?secret=<HEARTBEAT_SECRET>`
   (e.g. every hour — the heartbeat itself decides which channels are
   actually due based on each channel's posting frequency).
6. Add the bot as admin to any channel — it takes it from there.

## Design notes

- The bot never DMs anyone. It only reacts to `my_chat_member` updates
  and posts to channel IDs it's admin in — there's no code path that
  sends a private message to a user.
- One pipeline (`lib/pipeline.js`) handles every niche generically —
  adding support for a new type of channel means nothing, since the
  channel's own description drives what gets searched and written.
