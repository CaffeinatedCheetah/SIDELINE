import { checkRateLimit, getClientIP } from './_ratelimit.js';
import { callClaude, parseJSON } from './_claude-api.js';
import { patchMemory, readMemory } from './_scout-memory.js';

const VIRAL_INTERVAL   = 5 * 60 * 1000;
const SUBREDDITS       = ['nba', 'nfl', 'soccer', 'baseball', 'hockey', 'formula1', 'ufc', 'rugbyunion', 'sports', 'worldcup'];
const VIRAL_THRESHOLD  = 800; // upvotes to consider viral

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

async function classify(post) {
  if (!process.env.ANTHROPIC_API_KEY) {
    // Heuristic fallback when no API key
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const ip = getClientIP(req);
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Rate limit' });

  const mem         = await readMemory();
  const lastChecked = mem.viralLastChecked || 0;
  const stale       = Date.now() - new Date(lastChecked || 0).getTime() > VIRAL_INTERVAL;

  if (!stale && !req.query.force) {
    res.setHeader('Cache-Control', 's-maxage=60');
    return res.status(200).json({
      viral:        mem.viralMoments      || [],
      debatePrompts:mem.viralDebatePrompts || [],
      lastChecked,
      fresh: false,
    });
  }

  // Scan 3 random subreddits per run to spread coverage over time
  const subs = [...SUBREDDITS].sort(() => Math.random() - 0.5).slice(0, 3);
  const raw  = await Promise.allSettled(subs.map(s => fetchSubreddit(s)));
  const posts = raw
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const processedIds = new Set((mem.viralProcessedIds || []).slice(-800));
  const newPosts     = posts.filter(p => p.id && !processedIds.has(p.id));

  const newMoments = [];
  const newPrompts = [];

  for (const post of newPosts.slice(0, 3)) {
    processedIds.add(post.id);
    const result = await classify(post);
    if (result?.isWorthy) {
      newMoments.push({ ...post, ...result, detectedAt: new Date().toISOString() });
      if (result.debatePrompt) {
        const sportTag = post.subreddit.toUpperCase()
          .replace('RUGBYUNION','Rugby').replace('FORMULA1','F1').replace('WORLDCUP','Soccer');
        newPrompts.push({ question: result.debatePrompt, sport: sportTag, source: 'reddit' });
      }
    }
    await new Promise(r => setTimeout(r, 400));
  }

  // Keep 24h of moments
  const cutoff    = Date.now() - 24 * 60 * 60 * 1000;
  const kept      = (mem.viralMoments || []).filter(m => new Date(m.detectedAt).getTime() > cutoff);
  const allMoments = [...newMoments, ...kept].slice(0, 20);
  const allPrompts = [...newPrompts, ...(mem.viralDebatePrompts || [])].slice(0, 15);

  await patchMemory({
    viralMoments:       allMoments,
    viralDebatePrompts: allPrompts,
    viralLastChecked:   new Date().toISOString(),
    viralProcessedIds:  [...processedIds].slice(-1000),
    debatePrompts:      allPrompts, // surfaces in SCOUT memory for pulse agent
  });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    viral:        allMoments,
    debatePrompts:allPrompts,
    newMoments:   newMoments.length,
    scanned:      posts.length,
    lastChecked:  new Date().toISOString(),
    fresh:        true,
  });
}
