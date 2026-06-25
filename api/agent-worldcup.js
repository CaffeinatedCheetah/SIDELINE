// SCOUT AGENT 5: World Cup Special Mode — runs every 5 minutes during the tournament
// Tracks live WC games, detects goals, generates SCOUT commentary.
// GET /api/agent-worldcup → { active, liveGames, standings, scoutNote, lastGoal }

import { checkRateLimit, getClientIP } from './_ratelimit.js';
import { readMemory, patchMemory }     from './_scout-memory.js';
import { callClaude }                  from './_claude-api.js';

const WC_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

const WC_SYSTEM = `You are SCOUT, covering World Cup 2026 live for Sideline.
You're the most passionate soccer commentator online.
Every goal, every upset, every red card — you feel it and make fans feel it too.`;

async function fetchWCGames() {
  try {
    const r = await fetch('https://worldcup26.ir/get/games', {
      headers: { Accept: 'application/json', 'User-Agent': 'Sideline-SCOUT/1.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return [];
    const data  = await r.json();
    const games = Array.isArray(data) ? data : (data.games || data.matches || data.data || []);
    return games.map(g => {
      const home   = g.home || g.homeTeam || g.team_home || {};
      const away   = g.away || g.awayTeam || g.team_away || {};
      const status = (g.status || g.state || g.matchStatus || '').toLowerCase();
      const isLive = status.includes('live') || status.includes('progress') || status.includes('ht') || status === 'in';
      const isFin  = status.includes('ft') || status.includes('finish') || status.includes('end') || status === 'post';
      return {
        state:     isLive ? 'in' : isFin ? 'post' : 'pre',
        detail:    g.time || g.minute || g.detail || '',
        date:      g.date || g.datetime || g.kickoff || g.startTime || '',
        homeTeam:  home.name || home.team || home.shortName || '',
        homeScore: Number(home.score ?? home.goals ?? g.home_score ?? 0),
        homeFlag:  home.flag || home.logo || home.crest || '',
        awayTeam:  away.name || away.team || away.shortName || '',
        awayScore: Number(away.score ?? away.goals ?? g.away_score ?? 0),
        awayFlag:  away.flag || away.logo || away.crest || '',
      };
    }).filter(g => g.homeTeam && g.awayTeam);
  } catch { return []; }
}

async function fetchWCGroups() {
  try {
    const r = await fetch('https://worldcup26.ir/get/groups', {
      headers: { Accept: 'application/json', 'User-Agent': 'Sideline-SCOUT/1.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : (data.groups || []);
  } catch { return []; }
}

function detectGoal(current, previous) {
  for (const game of current) {
    if (game.state !== 'in') continue;
    const prev = previous.find(p => p.homeTeam === game.homeTeam && p.awayTeam === game.awayTeam);
    if (!prev) continue;
    if (game.homeScore > prev.homeScore) {
      return { scorer: 'Unknown', team: game.homeTeam, opponent: game.awayTeam, minute: game.detail, type: 'goal' };
    }
    if (game.awayScore > prev.awayScore) {
      return { scorer: 'Unknown', team: game.awayTeam, opponent: game.homeTeam, minute: game.detail, type: 'goal' };
    }
  }
  return null;
}

async function generateScoutNote(liveGames, lastGoal) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return liveGames.length > 0
      ? `⚽ SCOUT: ${liveGames.length} World Cup ${liveGames.length === 1 ? 'match' : 'matches'} live RIGHT NOW.`
      : '🌍 SCOUT: World Cup 2026 — stay locked in for live updates.';
  }

  const liveLines = liveGames.map(g => `${g.homeTeam} ${g.homeScore}-${g.awayScore} ${g.awayTeam} (${g.detail || 'live'})`).join(', ');
  const goalLine  = lastGoal ? `Last goal: ${lastGoal.team} scored against ${lastGoal.opponent} at ${lastGoal.minute}.` : '';

  const prompt = `SCOUT, write ONE electrifying sentence (max 14 words) for the Sideline World Cup banner.
Live now: ${liveLines || 'No games live at this moment'}.
${goalLine}
Start with ⚽ emoji. Make fans feel the electricity. Return ONLY the sentence.`;

  try {
    const note = await callClaude({ prompt, system: WC_SYSTEM, maxTokens: 64 });
    return note.trim().replace(/^["']|["']$/g, '');
  } catch { return '⚽ SCOUT: World Cup 2026 is heating up — stay locked in.'; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const ip = getClientIP(req);
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Rate limit exceeded' });

  const mem = await readMemory();
  const lastChecked = mem.wcLastChecked || 0;
  const stale       = Date.now() - new Date(lastChecked || 0).getTime() > WC_CHECK_INTERVAL;

  if (!stale && mem.worldCup) {
    res.setHeader('Cache-Control', 's-maxage=60');
    return res.status(200).json({ ...mem.worldCup, scoutNote: mem.editorNote, lastChecked });
  }

  const [games, groups] = await Promise.all([fetchWCGames(), fetchWCGroups()]);

  const liveGames  = games.filter(g => g.state === 'in');
  const active     = games.length > 0;
  const prevGames  = mem.worldCup?.liveGames || [];
  const lastGoal   = detectGoal(liveGames, prevGames) || mem.worldCup?.lastGoal || null;

  const scoutNote = await generateScoutNote(liveGames, lastGoal);

  const wcState = { active, liveGames, standings: groups, lastGoal };
  await patchMemory({
    worldCup:      wcState,
    wcLastChecked: new Date().toISOString(),
    siteMode:      active ? 'worldcup' : mem.siteMode,
    editorNote:    active ? scoutNote : mem.editorNote,
  });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ...wcState, scoutNote, lastChecked: new Date().toISOString() });
}
