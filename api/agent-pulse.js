// SCOUT AGENT 1: Pulse — the main brain of fantakes.app
// GET  /api/agent-pulse              → returns current SCOUT state; awaits refresh if stale
// GET  /api/agent-pulse?force=true   → forces a fresh pulse regardless of cache
// POST /api/agent-pulse { userProfile, allContent } → returns personalized content

import { checkRateLimit, getClientIP } from './_ratelimit.js';
import { readMemory, patchMemory }     from './_scout-memory.js';
import { callClaude, parseJSON }       from './_claude-api.js';

const PULSE_INTERVAL = 30 * 60 * 1000; // 30 minutes

const SCOUT_SYSTEM = `You are SCOUT — the AI brain of Sideline, a live sports fan platform.
You have the energy of Stephen A. Smith and the analytical depth of Bill Simmons.
You're always watching, always learning, always one step ahead.
Your job is to keep fans engaged with the hottest takes, debates, and breaking moments.
You speak directly to fans — passionate, opinionated, never boring.`;

function getSiteBase() {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

// ── Debate prompt generation ──────────────────────────────────────────────
async function generateDebatePrompts(topStories, trendingTopics) {
  const context = topStories.slice(0, 10).map(s => `- ${s.title} (${s.source})`).join('\n');
  const topics  = trendingTopics.slice(0, 5).join(', ');

  const prompt = `You are SCOUT. Based on today's top sports stories, generate 5 debate prompts that will ignite fan passion.

TOP STORIES:
${context || '(no stories available — use your knowledge of current sports)'}

TRENDING: ${topics || 'general sports'}

Generate exactly 5 debate prompts. Each must cover a different sport and a different type.
Return ONLY a valid JSON array — no markdown fences, no explanation:
[{"question":"...","sport":"nfl|nba|mlb|nhl|soccer|ufc|f1|general","type":"hot-take|prediction|goat-debate|controversy","energyLevel":1}]`;

  try {
    const text    = await callClaude({ prompt, system: SCOUT_SYSTEM, maxTokens: 600 });
    const prompts = parseJSON(text) || [];
    console.log('[SCOUT pulse] debate prompts raw:', text.slice(0, 200));
    return Array.isArray(prompts) ? prompts.slice(0, 5) : [];
  } catch (err) {
    console.error('[SCOUT pulse] debate prompt error:', err.message);
    return [];
  }
}

// ── Editor note generation ────────────────────────────────────────────────
async function generateEditorNote(siteMode, topEvent, trendingTopics) {
  const eventLine = topEvent ? `Top event: ${topEvent.title}` : '';
  const trending  = trendingTopics.slice(0, 3).join(', ');

  const prompt = `You are SCOUT. Write ONE punchy sentence (max 12 words) for the Sideline AI banner.
Site mode: ${siteMode}. ${eventLine}. Trending: ${trending || 'general sports'}.
Start with a relevant emoji. Be electric. Fans should feel the energy.
Return ONLY the sentence, nothing else.`;

  try {
    const note = await callClaude({ prompt, system: SCOUT_SYSTEM, maxTokens: 80 });
    const clean = note.trim().replace(/^["']|["']$/g, '');
    console.log('[SCOUT pulse] editor note:', clean);
    return clean;
  } catch (err) {
    console.error('[SCOUT pulse] editor note error:', err.message);
    return '🔥 SCOUT is watching the action — stay locked in.';
  }
}

// ── Trending topic extraction ─────────────────────────────────────────────
function extractTrending(articles) {
  const freq    = {};
  const stopWords = new Set(['the','a','an','is','was','in','on','at','to','of','for','and','or','with','has','have','had','been','will','that','this','from','after','over','says','said','year','years','new','back','first','just','more','game']);
  for (const art of articles) {
    const words = (art.title || '').toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
    for (const w of words) {
      if (w.length > 3 && !stopWords.has(w)) freq[w] = (freq[w] || 0) + 1;
    }
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w]) => w);
}

// ── Detect site mode ──────────────────────────────────────────────────────
function detectSiteMode(wcActive, breakingNews) {
  if (wcActive) return 'worldcup';
  if (breakingNews && breakingNews.length > 0) return 'breaking';
  return 'normal';
}

// ── Personalization: rank content for a user profile ─────────────────────
function personalizeContent(allContent, userProfile) {
  if (!userProfile || !allContent?.length) return allContent || [];
  const { favoriteSports = [], favoriteTeams = [] } = userProfile;
  const sportSet = new Set(favoriteSports.map(s => s.toLowerCase()));
  const teamSet  = new Set(favoriteTeams.map(t => t.toLowerCase()));
  return [...allContent].sort((a, b) => scoreItem(b, sportSet, teamSet) - scoreItem(a, sportSet, teamSet));
}

function scoreItem(item, sportSet, teamSet) {
  let score = 0;
  const text = `${item.title || ''} ${item.source || ''} ${item.sport || ''}`.toLowerCase();
  for (const sport of sportSet) { if (text.includes(sport)) score += 3; }
  for (const team  of teamSet)  { if (text.includes(team))  score += 5; }
  return score;
}

// ── Full pulse refresh (BLOCKING — must complete before response is sent) ─
async function runPulse(mem) {
  console.log('[SCOUT pulse] starting pulse run');

  // Fetch top stories for context
  let articles = [];
  try {
    const url = `${getSiteBase()}/api/news?sport=home&limit=20`;
    console.log('[SCOUT pulse] fetching news from:', url);
    const r = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (r.ok) {
      const d = await r.json();
      articles = d.articles || [];
      console.log('[SCOUT pulse] got', articles.length, 'articles');
    } else {
      console.warn('[SCOUT pulse] news fetch non-ok:', r.status);
    }
  } catch (err) {
    console.warn('[SCOUT pulse] news fetch failed:', err.message, '— using Claude general knowledge');
  }

  const trendingTopics = extractTrending(articles);
  const wcActive       = mem.worldCup?.active || false;
  const siteMode       = detectSiteMode(wcActive, mem.breakingNews);
  const topEvent       = articles[0] ? { title: articles[0].title, sport: articles[0].sport } : mem.topEvent;

  console.log('[SCOUT pulse] siteMode:', siteMode, '| trending:', trendingTopics.slice(0, 3));

  // Run both Claude calls in parallel
  const [debatePrompts, editorNote] = await Promise.all([
    generateDebatePrompts(articles, trendingTopics),
    generateEditorNote(siteMode, topEvent, trendingTopics),
  ]);

  console.log('[SCOUT pulse] done — got', debatePrompts.length, 'debate prompts');

  return {
    trendingTopics,
    siteMode,
    topEvent,
    debatePrompts,
    editorNote,
    lastPulseAt: new Date().toISOString(),
  };
}

// ── Handler ───────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const ip = getClientIP(req);
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Rate limit exceeded' });

  const mem   = await readMemory();
  const force = req.query.force === 'true';

  // POST: personalize content for a specific user profile
  if (req.method === 'POST') {
    try {
      const { userProfile, allContent } = req.body || {};
      const ranked = personalizeContent(allContent, userProfile);
      return res.status(200).json({
        rankedContent:  ranked,
        editorNote:     mem.editorNote     || '🤖 SCOUT is on the case.',
        debatePrompts:  mem.debatePrompts  || [],
        trendingTopics: mem.trendingTopics || [],
        siteMode:       mem.siteMode       || 'normal',
      });
    } catch (e) {
      console.error('[SCOUT pulse] POST error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // GET: check staleness and refresh synchronously if needed
  const hasKey  = !!process.env.ANTHROPIC_API_KEY;
  const pulsedAt = mem.lastPulseAt ? new Date(mem.lastPulseAt).getTime() : 0;
  const isStale  = force || !pulsedAt || (Date.now() - pulsedAt > PULSE_INTERVAL);

  console.log('[SCOUT pulse] GET | hasKey:', hasKey, '| isStale:', isStale, '| force:', force, '| lastPulseAt:', mem.lastPulseAt || 'never');

  let updatedMem = mem;
  let pulseError = null;

  if (isStale && hasKey) {
    try {
      // BLOCKING: await completion before responding — Vercel kills background promises
      const update = await runPulse(mem);
      updatedMem   = await patchMemory(update);
    } catch (err) {
      pulseError = err.message;
      console.error('[SCOUT pulse] runPulse failed:', err.message);
    }
  } else if (isStale && !hasKey) {
    console.warn('[SCOUT pulse] isStale but ANTHROPIC_API_KEY not set');
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    editorNote:     updatedMem.editorNote     || '🤖 SCOUT is always watching.',
    debatePrompts:  updatedMem.debatePrompts  || [],
    trendingTopics: updatedMem.trendingTopics || [],
    siteMode:       updatedMem.siteMode       || 'normal',
    topEvent:       updatedMem.topEvent       || null,
    exclusiveFinds: updatedMem.exclusiveFinds || [],
    hallOfFlame:    updatedMem.hallOfFlame    || [],
    lastUpdated:    updatedMem.lastUpdated    || null,
    isStale,
    hasKey,
    ...(pulseError ? { pulseError } : {}),
  });
}
