// SCOUT master agent — consolidates 5 background jobs into one invocation:
// breaking news, viral scan, SEO articles, repurpose, tweet publisher.
// agent-pulse.js stays separate: it's called live by the frontend on every
// page load (banner + personalization), not just a cron background job.
import { createHmac } from 'crypto';
import { checkRateLimit, getClientIP } from './_ratelimit.js';
import { callClaude, parseJSON } from './_claude-api.js';
import { readMemory, patchMemory, acquireLock, releaseLock } from './_scout-memory.js';

const LOCK_KEY  = 'scout:lock';
const LOCK_TTL  = 330; // seconds — must exceed maxDuration (300s, vercel.json) so a still-running
                        // invocation's lock never expires before the function itself can time out

const CHECK_INTERVAL     = 5 * 60 * 1000;   // breaking
const VIRAL_INTERVAL     = 5 * 60 * 1000;
const SEO_INTERVAL       = 6 * 60 * 60 * 1000;
const REPURPOSE_INTERVAL = 60 * 60 * 1000;
const PUBLISH_INTERVAL   = 30 * 60 * 1000;

function getBaseUrl(req) {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host  = req.headers.host || process.env.VERCEL_URL;
  return host ? `${proto}://${host}` : 'http://localhost:3000';
}

function isStale(lastRun, interval) {
  return Date.now() - new Date(lastRun || 0).getTime() > interval;
}

// ── TASK: Breaking News ────────────────────────────────────────────────────
const BREAKING_SYSTEM = `You are SCOUT, Sideline's AI breaking-news detector.
You have a nose for what matters RIGHT NOW to sports fans.
You identify genuinely breaking, urgent stories — not routine recaps.`;

async function detectBreaking(freshArticles, storedHeadlines) {
  const storedSet = new Set(storedHeadlines.map(h => h.toLowerCase()));
  const newOnes   = freshArticles.filter(a => !storedSet.has((a.title || '').toLowerCase()));
  if (!newOnes.length || !process.env.ANTHROPIC_API_KEY) return [];

  const list = newOnes.slice(0, 15).map((a, i) => `${i + 1}. ${a.title}`).join('\n');
  const prompt = `You are SCOUT. Scan these new sports headlines and identify BREAKING stories only.
Breaking = injury announcements, trades, firings, immediate game events, records broken NOW.
NOT breaking = previews, analysis, opinion.

HEADLINES:
${list}

Return ONLY valid JSON array of breaking items (empty array if none):
[{"title":"...","urgency":1-10,"sport":"nfl|nba|mlb|nhl|soccer|ufc|f1|general","summary":"1 sentence max"}]
Max 3 items. If nothing is truly breaking, return [].`;

  try {
    const text    = await callClaude({ prompt, system: BREAKING_SYSTEM, maxTokens: 512 });
    const results = parseJSON(text) || [];
    return Array.isArray(results)
      ? results.filter(r => r.urgency >= 7).slice(0, 3).map(r => ({ ...r, detectedAt: new Date().toISOString() }))
      : [];
  } catch { return []; }
}

async function runBreaking(mem, baseUrl) {
  if (!isStale(mem.breakingLastChecked, CHECK_INTERVAL)) return { status: 'skipped', reason: 'not stale' };

  const r = await fetch(`${baseUrl}/api/news?sport=home&limit=30`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) return { status: 'error', error: `news fetch ${r.status}` };

  const fresh       = (await r.json()).articles || [];
  const stored      = (mem.breakingNews || []).map(b => b.title);
  const newBreaking = await detectBreaking(fresh, stored);

  const now    = Date.now();
  const TWO_HR = 2 * 60 * 60 * 1000;
  const kept   = (mem.breakingNews || []).filter(b => now - new Date(b.detectedAt).getTime() < TWO_HR);
  const merged = [...newBreaking, ...kept].slice(0, 5);

  await patchMemory({ breakingNews: merged, breakingLastChecked: new Date().toISOString() });
  return { status: 'done', newBreaking: newBreaking.length, total: merged.length };
}

// ── TASK: Viral Scan ────────────────────────────────────────────────────────
const SUBREDDITS      = ['nba', 'nfl', 'soccer', 'baseball', 'hockey', 'formula1', 'ufc', 'rugbyunion', 'sports', 'worldcup'];
const VIRAL_THRESHOLD = 800;

async function fetchSubreddit(sub) {
  try {
    const r = await fetch(
      `https://www.reddit.com/r/${sub}/hot.json?limit=10`,
      { headers: { 'User-Agent': 'Sideline/1.0 sports platform' }, signal: AbortSignal.timeout(6000) }
    );
    if (!r.ok) return [];
    const d = await r.json();
    return (d.data?.children || []).map(c => ({
      id:        c.data?.id        || '',
      title:     c.data?.title     || '',
      score:     c.data?.score     || 0,
      comments:  c.data?.num_comments || 0,
      created:   c.data?.created_utc  || 0,
      subreddit: c.data?.subreddit || sub,
      url:       `https://reddit.com${c.data?.permalink || ''}`,
      isVideo:   !!(c.data?.is_video || c.data?.media),
    })).filter(p => p.title && p.score >= VIRAL_THRESHOLD);
  } catch { return []; }
}

async function classifyViral(post) {
  if (!process.env.ANTHROPIC_API_KEY) {
    if (post.score < 3000) return { isWorthy: false };
    return {
      isWorthy:     true,
      debatePrompt: `${post.title.slice(0, 90)} — Fire or Ice?`,
      tweet:        `🔥 Sports Twitter is reacting:\n\n"${post.title.slice(0, 200)}"\n\nDrop your take → fantakes.app`,
      reason:       `${post.score.toLocaleString()} upvotes on r/${post.subreddit}`,
    };
  }
  const ageMin = Math.round((Date.now() / 1000 - post.created) / 60);
  const text   = await callClaude({
    prompt: `This Reddit post is going viral in sports:
"${post.title}"
r/${post.subreddit} — ${post.score.toLocaleString()} upvotes, ${post.comments} comments, ${ageMin} minutes old

Is this a genuine sports moment we should cover? If yes, write:
- A spicy Fan Takes debate prompt about it (max 95 chars, ends with "— Fire or Ice?")
- A Twitter post about it (max 235 chars, end with "→ fantakes.app")
- Why fans care about this (1 sentence)

Return ONLY JSON: {"isWorthy":true,"debatePrompt":"...","tweet":"...","reason":"..."}
If not worthy: {"isWorthy":false}`,
    maxTokens: 350,
  });
  return parseJSON(text) || { isWorthy: false };
}

async function runViral(mem) {
  if (!isStale(mem.viralLastChecked, VIRAL_INTERVAL)) return { status: 'skipped', reason: 'not stale' };

  const subs  = [...SUBREDDITS].sort(() => Math.random() - 0.5).slice(0, 3);
  const raw   = await Promise.allSettled(subs.map(s => fetchSubreddit(s)));
  const posts = raw.filter(r => r.status === 'fulfilled').flatMap(r => r.value)
    .sort((a, b) => b.score - a.score).slice(0, 6);

  const processedIds = new Set((mem.viralProcessedIds || []).slice(-800));
  const newPosts      = posts.filter(p => p.id && !processedIds.has(p.id));

  const newMoments = [];
  const newPrompts = [];
  for (const post of newPosts.slice(0, 3)) {
    processedIds.add(post.id);
    const result = await classifyViral(post);
    if (result?.isWorthy) {
      newMoments.push({ ...post, ...result, detectedAt: new Date().toISOString() });
      if (result.debatePrompt) {
        const sportTag = post.subreddit.toUpperCase()
          .replace('RUGBYUNION', 'Rugby').replace('FORMULA1', 'F1').replace('WORLDCUP', 'Soccer');
        newPrompts.push({ question: result.debatePrompt, sport: sportTag, source: 'reddit' });
      }
    }
    await new Promise(r => setTimeout(r, 400));
  }

  const cutoff     = Date.now() - 24 * 60 * 60 * 1000;
  const kept       = (mem.viralMoments || []).filter(m => new Date(m.detectedAt).getTime() > cutoff);
  const allMoments = [...newMoments, ...kept].slice(0, 20);
  const allPrompts = [...newPrompts, ...(mem.viralDebatePrompts || [])].slice(0, 15);

  await patchMemory({
    viralMoments:       allMoments,
    viralDebatePrompts: allPrompts,
    viralLastChecked:   new Date().toISOString(),
    viralProcessedIds:  [...processedIds].slice(-1000),
    debatePrompts:      allPrompts,
  });
  return { status: 'done', newMoments: newMoments.length, scanned: posts.length };
}

// ── TASK: SEO Articles ──────────────────────────────────────────────────────
const SEO_TOPICS = [
  { sport: 'NFL',    kws: ['nfl trade rumors', 'nfl injury report', 'nfl power rankings', 'super bowl predictions', 'fantasy football picks', 'nfl draft analysis'] },
  { sport: 'NBA',    kws: ['nba trade rumors', 'nba mvp race', 'nba playoff predictions', 'best nba players 2025', 'nba standings analysis', 'basketball power rankings'] },
  { sport: 'Soccer', kws: ['world cup 2026 predictions', 'premier league standings', 'champions league analysis', 'best soccer players 2025', 'la liga results', 'soccer transfer news'] },
  { sport: 'MLB',    kws: ['mlb trade deadline rumors', 'world series predictions', 'best pitchers 2025', 'mlb power rankings', 'baseball standings analysis'] },
  { sport: 'NHL',    kws: ['stanley cup predictions', 'nhl trade rumors', 'best nhl players 2025', 'hockey power rankings', 'nhl playoff race'] },
  { sport: 'UFC',    kws: ['ufc fight card analysis', 'mma pound for pound rankings', 'best fighters 2025', 'boxing vs mma debate', 'ufc predictions tonight'] },
  { sport: 'F1',     kws: ['f1 standings 2025', 'best f1 drivers ever', 'formula 1 predictions', 'f1 constructor championship', 'monaco grand prix analysis'] },
  { sport: 'Rugby',  kws: ['six nations 2025 predictions', 'best rugby players world', 'rugby union vs league', 'premiership rugby standings', 'world rugby rankings'] },
];

const SEO_SYSTEM = `You are a sports journalist writing SEO-optimized articles for Sideline (fantakes.app).
Articles target specific Google search queries. Write with energy, facts, and fan perspective.
Every article must end with a question inviting fans to debate: "What's your take? Drop it on Sideline →"`;

async function generateSeoArticle(topic, keyword) {
  const text = await callClaude({
    prompt: `Write a short SEO article for Sideline about: "${keyword}"

Requirements:
- headline: 50-65 chars, includes keyword, punchy
- subheadline: 110-140 chars, adds context
- body: 3 paragraphs (~150 words each). Current state → historical context → fan debate angle.
  End final paragraph with: "What's your take? Drop it on Sideline →"
- metaDescription: 150-160 chars for Google
- keywords: 5-7 related search terms
- sport: ${topic.sport}
- tag: one of [Hot Take, Trending, Must See, Exclusive, Analysis]

Return ONLY valid JSON:
{"headline":"...","subheadline":"...","body":"...","metaDescription":"...","keywords":["..."],"sport":"${topic.sport}","tag":"...","targetKeyword":"${keyword}"}`,
    system: SEO_SYSTEM,
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 1400,
  });
  return parseJSON(text);
}

async function runSeo(mem, baseUrl) {
  if (!isStale(mem.seoLastRun, SEO_INTERVAL)) return { status: 'skipped', reason: 'not stale' };
  if (!process.env.ANTHROPIC_API_KEY) return { status: 'skipped', reason: 'ANTHROPIC_API_KEY not set' };

  const shuffled = [...SEO_TOPICS].sort(() => Math.random() - 0.5).slice(0, 3);
  const result   = { articles: 0, generated: [], errors: [] };

  for (const topic of shuffled) {
    const keyword = topic.kws[Math.floor(Math.random() * topic.kws.length)];
    try {
      const article = await generateSeoArticle(topic, keyword);
      if (!article?.headline) { result.errors.push({ keyword, error: 'No headline' }); continue; }

      const full = {
        id:             `seo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type:           'seo',
        seoOptimized:   true,
        aiGenerated:    true,
        publishedAt:    new Date().toISOString(),
        sourceUrl:      `https://fantakes.app/#${topic.sport.toLowerCase()}`,
        sourceUsername: 'sideline_scout',
        ...article,
      };
      await fetch(`${baseUrl}/api/articles-store`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(full),
      });
      result.articles++;
      result.generated.push({ headline: full.headline, keyword, sport: topic.sport });
    } catch (err) {
      result.errors.push({ keyword, error: err.message });
    }
    await new Promise(r => setTimeout(r, 1200));
  }

  await patchMemory({ seoLastRun: new Date().toISOString(), seoLastCount: result.articles });
  return { status: 'done', ...result };
}

// ── TASK: Repurpose ─────────────────────────────────────────────────────────
const REPURPOSE_SYSTEM = `You are a social media strategist for Sideline (fantakes.app).
Repurpose sports content into high-engagement platform-native posts.
Keep opinions sharp. Drive traffic back to fantakes.app.`;

async function repurposeItem(item) {
  const text = await callClaude({
    prompt: `Repurpose this ${item.type} for social media:

"${String(item.text || '').slice(0, 400)}"
Sport: ${item.sport || 'Sports'}

Return ONLY JSON:
{
  "twitterThread": ["tweet1 (max 230 chars, end with 1/3)","tweet2 (2/3)","tweet3 — fantakes.app (3/3)"],
  "instagram": "caption here (max 220 chars)\n\n#sports #fansonly #fantakes + 7 more relevant hashtags",
  "threads": "conversational 400-char post asking fans a spicy question, end with fantakes.app",
  "blogIntro": "120-word punchy first paragraph for a blog article on this topic, SEO-friendly"
}`,
    system: REPURPOSE_SYSTEM,
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 900,
  });
  return parseJSON(text);
}

async function runRepurpose(mem, baseUrl) {
  if (!isStale(mem.repurposeLastRun, REPURPOSE_INTERVAL)) return { status: 'skipped', reason: 'not stale' };
  if (!process.env.ANTHROPIC_API_KEY) return { status: 'skipped', reason: 'ANTHROPIC_API_KEY not set' };

  let articles = [];
  try {
    const r = await fetch(`${baseUrl}/api/articles-store`, { signal: AbortSignal.timeout(5000) });
    if (r.ok) articles = await r.json();
  } catch {}

  const candidates = [
    ...articles.slice(0, 3).map(a => ({ id: a.id, type: 'article', text: `${a.headline}. ${a.subheadline || ''}`.trim(), sport: a.sport || 'Sports' })),
    ...(mem.viralMoments || []).filter(m => m.isWorthy).slice(0, 2).map(m => ({ id: m.id, type: 'viral take', text: m.title, sport: (m.subreddit || 'sports').toUpperCase() })),
  ];

  const repurposed = [];
  for (const item of candidates.slice(0, 4)) {
    try {
      const result = await repurposeItem(item);
      if (result) {
        repurposed.push({ id: `rep-${item.id}-${Date.now()}`, source: item, ...result, createdAt: new Date().toISOString(), used: false });
      }
    } catch { /* skip failed items silently */ }
    await new Promise(r => setTimeout(r, 900));
  }

  const sportCounts = {};
  for (const m of mem.viralMoments || []) {
    const s = m.subreddit || 'other';
    sportCounts[s] = (sportCounts[s] || 0) + 1;
  }
  const topSport = Object.entries(sportCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'sports';

  await patchMemory({
    repurposedContent: repurposed,
    repurposeLastRun:  new Date().toISOString(),
    contentInsights:   { topSport, totalRepurposed: repurposed.length, lastAnalyzed: new Date().toISOString() },
  });
  return { status: 'done', repurposed: repurposed.length, topSport };
}

// ── TASK: Publisher (Twitter) ───────────────────────────────────────────────
function pct(s) {
  return encodeURIComponent(s)
    .replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28')
    .replace(/\)/g, '%29').replace(/\*/g, '%2A');
}

function oauthHeader(method, url, creds) {
  const nonce  = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const ts     = String(Math.floor(Date.now() / 1000));
  const params = {
    oauth_consumer_key: creds.apiKey, oauth_nonce: nonce, oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: ts, oauth_token: creds.accessToken, oauth_version: '1.0',
  };
  const paramStr   = Object.keys(params).sort().map(k => `${pct(k)}=${pct(params[k])}`).join('&');
  const base       = `${method}&${pct(url)}&${pct(paramStr)}`;
  const signingKey = `${pct(creds.apiSecret)}&${pct(creds.accessSecret)}`;
  params.oauth_signature = createHmac('sha1', signingKey).update(base).digest('base64');
  return `OAuth ${Object.entries(params).map(([k, v]) => `${pct(k)}="${pct(v)}"`).join(', ')}`;
}

async function postTweet(text, creds) {
  const url  = 'https://api.twitter.com/2/tweets';
  const auth = oauthHeader('POST', url, creds);
  const r    = await fetch(url, {
    method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json', 'User-Agent': 'Sideline/1.0' },
    body: JSON.stringify({ text: text.slice(0, 280) }), signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`Twitter ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
  return r.json();
}

function breakingTweet(story) {
  const sport = story.sport ? `[${String(story.sport).toUpperCase()}] ` : '';
  return `🚨 ${sport}${String(story.title || story.headline || '').slice(0, 210)}\n\nAnalysis + fan debate → fantakes.app 🔥`;
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
  return Array.isArray(thread) && thread[0] ? thread[0].slice(0, 280) : null;
}

async function runPublisher(mem) {
  if (!isStale(mem.publisherLastRun, PUBLISH_INTERVAL)) return { status: 'skipped', reason: 'not stale' };

  const creds = {
    apiKey: process.env.TWITTER_API_KEY, apiSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN, accessSecret: process.env.TWITTER_ACCESS_SECRET,
  };
  const dryRun  = !creds.apiKey || !creds.accessToken;
  const sentIds = new Set(mem.publisherSentIds || []);
  const result  = { published: 0, dryRun, tweets: [], errors: [] };

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

  const toPost = candidates.sort((a, b) => b.priority - a.priority)[0];
  const repurposedContent = mem.repurposedContent || [];
  if (toPost) {
    if (dryRun) {
      result.tweets.push({ text: toPost.text, dryRun: true });
      result.published++;
      sentIds.add(toPost.id);
    } else {
      try {
        await postTweet(toPost.text, creds);
        result.published++;
        result.tweets.push({ text: toPost.text });
        sentIds.add(toPost.id);
      } catch (err) {
        result.errors.push(err.message);
      }
    }
    if (toPost.markUsed) {
      const rep = repurposedContent.find(i => i.id === toPost.markUsed);
      if (rep) rep.used = true;
    }
  }

  await patchMemory({
    publisherLastRun: new Date().toISOString(),
    publisherSentIds: [...sentIds].slice(-300),
    repurposedContent,
  });
  return { status: 'done', ...result };
}

// ── Handler ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

  const ip = getClientIP(req);
  if (!checkRateLimit(ip, 10, 60000)) return res.status(429).json({ error: 'Rate limit exceeded' });

  const got = await acquireLock(LOCK_KEY, LOCK_TTL);
  if (!got) return res.status(200).json({ skipped: true, reason: 'already running' });

  const startTime = Date.now();
  const log     = [`SCOUT started at ${new Date().toISOString()}`];
  const results = {};

  try {
    const baseUrl = getBaseUrl(req);
    let mem = await readMemory();

    const tasks = [
      ['breaking',   () => runBreaking(mem, baseUrl)],
      ['viral',      () => runViral(mem)],
      ['seo',        () => runSeo(mem, baseUrl)],
      ['repurpose',  () => runRepurpose(mem, baseUrl)],
      ['publisher',  () => runPublisher(mem)],
    ];

    for (const [name, run] of tasks) {
      log.push(`Task: ${name}`);
      try {
        results[name] = await run();
      } catch (e) {
        results[name] = { status: 'error', error: e.message };
        log.push(`${name} error: ${e.message}`);
      }
      mem = await readMemory(); // pick up this task's patchMemory writes for the next task
    }

    const duration = Date.now() - startTime;
    await patchMemory({
      scoutLastRun:      new Date().toISOString(),
      scoutLastDuration: duration,
      scoutResults:      results,
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, duration, results, log });
  } finally {
    await releaseLock(LOCK_KEY);
  }
}
