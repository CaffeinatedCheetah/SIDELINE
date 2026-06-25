// SCOUT AGENT 1: Pulse — the main brain of fantakes.app
// GET  /api/agent-pulse              → returns current SCOUT state (fast)
// POST /api/agent-pulse { userProfile, allContent } → returns personalized content
//
// Triggers a full refresh when last run >30 min ago.
// Generates debate prompts, editor note, trending topics, and detects site mode.

import { checkRateLimit, getClientIP } from './_ratelimit.js';
import { readMemory, patchMemory }     from './_scout-memory.js';
import { callClaude, parseJSON }       from './_claude-api.js';

const PULSE_INTERVAL = 30 * 60 * 1000; // 30 minutes

const SCOUT_SYSTEM = `You are SCOUT — the AI brain of Sideline, a live sports fan platform.
You have the energy of Stephen A. Smith and the analytical depth of Bill Simmons.
You're always watching, always learning, always one step ahead.
Your job is to keep fans engaged with the hottest takes, debates, and breaking moments.
You speak directly to fans — passionate, opinionated, never boring.`;

// ── Debate prompt generation ──────────────────────────────────────────────
async function generateDebatePrompts(topStories, trendingTopics) {
  const context = topStories.slice(0, 10).map(s => `- ${s.title} (${s.source})`).join('\n');
  const topics  = trendingTopics.slice(0, 5).join(', ');

  const prompt = `You are SCOUT. Based on today's top sports stories, generate 5 debate prompts that will ignite fan passion.

TOP STORIES:
${context}

TRENDING: ${topics || 'general sports'}

Generate exactly 5 debate prompts. Each must be a different sport and a different type.
Return ONLY valid JSON array with NO markdown fences:
[{"question":"...","sport":"nfl|nba|mlb|nhl|soccer|ufc|f1|general","type":"hot-take|prediction|goat-debate|controversy","energyLevel":1-10}]`;

  try {
    const text = await callClaude({ prompt, system: SCOUT_SYSTEM, maxTokens: 512 });
    const prompts = parseJSON(text) || [];
    return Array.isArray(prompts) ? prompts.slice(0, 5) : [];
  } catch { return []; }
}

// ── Editor note generation ────────────────────────────────────────────────
async function generateEditorNote(siteMode, topEvent, trendingTopics) {
  const eventLine = topEvent ? `Top event: ${topEvent.title}` : '';
  const trending  = trendingTopics.slice(0, 3).join(', ');

  const prompt = `You are SCOUT. Write ONE punchy sentence (max 12 words) for the Sideline banner.
Site mode: ${siteMode}. ${eventLine}. Trending: ${trending}.
Start with an emoji that fits the moment. Be electric. Fans should feel the energy.
Return ONLY the sentence, nothing else.`;

  try {
    const note = await callClaude({ prompt, system: SCOUT_SYSTEM, maxTokens: 64 });
    return note.trim().replace(/^["']|["']$/g, '');
  } catch { return '🔥 SCOUT is watching the action — stay locked in.'; }
}

// ── Game recap generation ─────────────────────────────────────────────────
export async function generateGameRecap(homeTeam, homeScore, awayTeam, awayScore, stats = '') {
  const prompt = `Write a punchy 3-sentence game recap for sports fans.
Game: ${homeTeam} ${homeScore} - ${awayTeam} ${awayScore}
Key stats: ${stats || 'none provided'}
Write like a Bleacher Report writer — exciting, fan-focused, with personality.
Include the most exciting moment. End with a debate question.
Return ONLY valid JSON (no fences): {"headline":"...","recap":"...","debateQuestion":"..."}`;

  try {
    const text = await callClaude({ prompt, system: SCOUT_SYSTEM, model: 'claude-sonnet-4-6', maxTokens: 256 });
    return parseJSON(text) || null;
  } catch { return null; }
}

// ── Trending topic extraction ─────────────────────────────────────────────
function extractTrending(articles) {
  const wordFreq = {};
  const stopWords = new Set(['the','a','an','is','was','in','on','at','to','of','for','and','or','with','has','have','had','been','will','that','this','from','after']);
  for (const art of articles) {
    const words = (art.title || '').toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
    for (const w of words) {
      if (w.length > 3 && !stopWords.has(w)) wordFreq[w] = (wordFreq[w] || 0) + 1;
    }
  }
  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w);
}

// ── Detect site mode ──────────────────────────────────────────────────────
function detectSiteMode(wcActive, breakingNews) {
  if (wcActive) return 'worldcup';
  if (breakingNews.length > 0) return 'breaking';
  return 'normal';
}

// ── Personalization: rank content for a user profile ─────────────────────
function personalizeContent(allContent, userProfile) {
  if (!userProfile || !allContent?.length) return allContent || [];
  const { favoriteSports = [], favoriteTeams = [] } = userProfile;
  const sportSet = new Set(favoriteSports.map(s => s.toLowerCase()));
  const teamSet  = new Set(favoriteTeams.map(t => t.toLowerCase()));

  return [...allContent].sort((a, b) => {
    const scoreA = scoreItem(a, sportSet, teamSet);
    const scoreB = scoreItem(b, sportSet, teamSet);
    return scoreB - scoreA;
  });
}

function scoreItem(item, sportSet, teamSet) {
  let score = 0;
  const text = `${item.title || ''} ${item.source || ''} ${item.sport || ''}`.toLowerCase();
  for (const sport of sportSet) { if (text.includes(sport)) score += 3; }
  for (const team  of teamSet)  { if (text.includes(team))  score += 5; }
  return score;
}

// ── Full pulse refresh ────────────────────────────────────────────────────
async function runPulse(mem) {
  // Fetch headlines from /api/news for trending detection
  let articles = [];
  try {
    const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
    const r = await fetch(`${base}/api/news?sport=home&limit=20`, { signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      const d = await r.json();
      articles = d.articles || [];
    }
  } catch { /* continue with stale data */ }

  const trendingTopics = extractTrending(articles);
  const wcActive       = mem.worldCup?.active || false;
  const siteMode       = detectSiteMode(wcActive, mem.breakingNews);
  const topEvent       = articles[0] ? { title: articles[0].title, sport: articles[0].sport } : mem.topEvent;

  const [debatePrompts, editorNote] = await Promise.all([
    generateDebatePrompts(articles, trendingTopics),
    generateEditorNote(siteMode, topEvent, trendingTopics),
  ]);

  return { trendingTopics, siteMode, topEvent, debatePrompts, editorNote, lastPulseAt: new Date().toISOString() };
}

// ── Handler ───────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const ip = getClientIP(req);
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Rate limit exceeded' });

  const mem = await readMemory();

  // POST: personalize content for a specific user
  if (req.method === 'POST') {
    try {
      const { userProfile, allContent } = req.body || {};
      const ranked = personalizeContent(allContent, userProfile);
      return res.status(200).json({
        rankedContent:  ranked,
        editorNote:     mem.editorNote || '🤖 SCOUT is on the case.',
        debatePrompts:  mem.debatePrompts,
        trendingTopics: mem.trendingTopics,
        siteMode:       mem.siteMode,
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // GET: return current state, trigger refresh if stale
  const isStale = !mem.lastPulseAt || (Date.now() - new Date(mem.lastPulseAt).getTime() > PULSE_INTERVAL);

  if (isStale && process.env.ANTHROPIC_API_KEY) {
    // Run pulse async-ish — return current state immediately and patch in background
    runPulse(mem).then(update => patchMemory(update)).catch(() => {});
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    editorNote:     mem.editorNote     || '🤖 SCOUT is always watching.',
    debatePrompts:  mem.debatePrompts  || [],
    trendingTopics: mem.trendingTopics || [],
    siteMode:       mem.siteMode       || 'normal',
    topEvent:       mem.topEvent       || null,
    exclusiveFinds: mem.exclusiveFinds || [],
    hallOfFlame:    mem.hallOfFlame    || [],
    lastUpdated:    mem.lastUpdated    || null,
    isStale,
  });
}
