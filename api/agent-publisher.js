import { createHmac } from 'crypto';
import { checkRateLimit, getClientIP } from './_ratelimit.js';
import { patchMemory, readMemory } from './_scout-memory.js';

const PUBLISH_INTERVAL = 30 * 60 * 1000;

// ── OAuth 1.0a signing for Twitter API v2 ────────────────────────────────
function pct(s) {
  return encodeURIComponent(s)
    .replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28')
    .replace(/\)/g, '%29').replace(/\*/g, '%2A');
}

function oauthHeader(method, url, creds) {
  const nonce  = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const ts     = String(Math.floor(Date.now() / 1000));
  const params = {
    oauth_consumer_key:     creds.apiKey,
    oauth_nonce:            nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        ts,
    oauth_token:            creds.accessToken,
    oauth_version:          '1.0',
  };
  const paramStr = Object.keys(params).sort()
    .map(k => `${pct(k)}=${pct(params[k])}`).join('&');
  const base       = `${method}&${pct(url)}&${pct(paramStr)}`;
  const signingKey = `${pct(creds.apiSecret)}&${pct(creds.accessSecret)}`;
  params.oauth_signature = createHmac('sha1', signingKey).update(base).digest('base64');
  const header = Object.entries(params)
    .map(([k, v]) => `${pct(k)}="${pct(v)}"`).join(', ');
  return `OAuth ${header}`;
}

async function postTweet(text, creds) {
  const url  = 'https://api.twitter.com/2/tweets';
  const auth = oauthHeader('POST', url, creds);
  const r    = await fetch(url, {
    method:  'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json', 'User-Agent': 'Sideline/1.0' },
    body:    JSON.stringify({ text: text.slice(0, 280) }),
    signal:  AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`Twitter ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
  return r.json();
}

// ── Tweet builders ────────────────────────────────────────────────────────
function breakingTweet(story) {
  const sport = story.sport ? `[${String(story.sport).toUpperCase()}] ` : '';
  const title = String(story.title || story.headline || '').slice(0, 210);
  return `🚨 ${sport}${title}\n\nAnalysis + fan debate → fantakes.app 🔥`;
}

function viralTweet(moment) {
  if (moment.tweet) return moment.tweet.slice(0, 280);
  return `🔥 Sports fans are losing it:\n\n"${String(moment.title || '').slice(0, 180)}"\n\n→ fantakes.app`;
}

function debateTweet(prompt) {
  return `🎙️ "${String(prompt.question || '').slice(0, 180)}"\n\nFire or Ice? → fantakes.app 🔥❄️`;
}

function repurposedTweet(item) {
  const thread = item.twitterThread;
  if (Array.isArray(thread) && thread[0]) return thread[0].slice(0, 280);
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

  const ip = getClientIP(req);
  if (!checkRateLimit(ip, 10, 60000)) return res.status(429).json({ error: 'Rate limit' });

  const mem          = await readMemory();
  const lastPub      = mem.publisherLastRun || 0;
  const stale        = Date.now() - new Date(lastPub || 0).getTime() > PUBLISH_INTERVAL;

  if (!stale && !req.query.force) {
    return res.status(200).json({
      published: 0,
      message:   'Not due yet',
      nextRun:   new Date(new Date(lastPub).getTime() + PUBLISH_INTERVAL).toISOString(),
    });
  }

  const creds = {
    apiKey:      process.env.TWITTER_API_KEY,
    apiSecret:   process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret:process.env.TWITTER_ACCESS_SECRET,
  };
  const dryRun     = !creds.apiKey || !creds.accessToken;
  const sentIds    = new Set(mem.publisherSentIds || []);
  const results    = { published: 0, dryRun, tweets: [], errors: [] };

  // Build priority-ordered candidates
  const candidates = [];

  for (const story of (mem.breakingNews || []).slice(0, 2)) {
    const id = `break-${(story.title || '').slice(0, 28)}`;
    if (!sentIds.has(id)) candidates.push({ id, text: breakingTweet(story), priority: 3 });
  }
  for (const moment of (mem.viralMoments || []).filter(m => m.isWorthy).slice(0, 2)) {
    const id = `viral-${moment.id || (moment.title || '').slice(0, 20)}`;
    if (!sentIds.has(id)) candidates.push({ id, text: viralTweet(moment), priority: 2 });
  }
  for (const item of (mem.repurposedContent || []).filter(i => !i.used).slice(0, 2)) {
    const t = repurposedTweet(item);
    if (t) {
      const id = `rep-${item.id}`;
      if (!sentIds.has(id)) candidates.push({ id, text: t, priority: 2, markUsed: item.id });
    }
  }
  for (const prompt of (mem.debatePrompts || []).slice(0, 3)) {
    const id = `debate-${(prompt.question || '').slice(0, 28)}`;
    if (!sentIds.has(id)) candidates.push({ id, text: debateTweet(prompt), priority: 1 });
  }

  // Post one tweet per run to stay within rate limits
  const toPost = candidates.sort((a, b) => b.priority - a.priority)[0];
  if (toPost) {
    if (dryRun) {
      results.tweets.push({ text: toPost.text, dryRun: true });
      results.published++;
      sentIds.add(toPost.id);
    } else {
      try {
        await postTweet(toPost.text, creds);
        results.published++;
        results.tweets.push({ text: toPost.text });
        sentIds.add(toPost.id);
      } catch (err) {
        results.errors.push(err.message);
      }
    }

    // Mark repurposed content as used
    if (toPost.markUsed) {
      const rep = (mem.repurposedContent || []).find(i => i.id === toPost.markUsed);
      if (rep) rep.used = true;
    }
  }

  await patchMemory({
    publisherLastRun: new Date().toISOString(),
    publisherSentIds: [...sentIds].slice(-300),
    repurposedContent: mem.repurposedContent || [],
  });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(results);
}
