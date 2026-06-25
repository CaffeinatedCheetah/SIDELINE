// SCOUT Agent Memory — public read endpoint
// GET /api/agent-memory → full SCOUT memory state (read-only public access)
// POST /api/agent-memory with x-scout-key header → write/patch memory (internal use)

import { checkRateLimit, getClientIP } from './_ratelimit.js';
import { readMemory, patchMemory }     from './_scout-memory.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-scout-key');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const ip = getClientIP(req);
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Rate limit exceeded' });

  if (req.method === 'POST') {
    const key    = req.headers['x-scout-key'];
    const secret = process.env.SCOUT_SECRET_KEY;
    if (!secret || key !== secret) return res.status(403).json({ error: 'Forbidden' });

    try {
      const update = req.body || {};
      const mem    = await patchMemory(update);
      return res.status(200).json({ ok: true, lastUpdated: mem.lastUpdated });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  const mem = await readMemory();
  res.setHeader('Cache-Control', 's-maxage=30');
  return res.status(200).json({
    lastUpdated:     mem.lastUpdated    || null,
    siteMode:        mem.siteMode       || 'normal',
    topEvent:        mem.topEvent       || null,
    trendingTopics:  mem.trendingTopics || [],
    breakingNews:    mem.breakingNews   || [],
    debatePrompts:   mem.debatePrompts  || [],
    exclusiveFinds:  mem.exclusiveFinds || [],
    hallOfFlame:     mem.hallOfFlame    || [],
    editorNote:      mem.editorNote     || '',
    worldCup:        mem.worldCup       || { active: false, liveGames: [], standings: [], lastGoal: null },
    sentimentMap:    mem.sentimentMap   || {},
    peakTrafficTimes: mem.peakTrafficTimes || [],
  });
}
