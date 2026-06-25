// SCOUT AGENT: Fan Engagement Tracker — runs every hour
// Tracks fire/ice sentiment ratios, peak traffic times, Hall of Flame entries.
// POST /api/agent-engagement { event, data } → records engagement event
// GET  /api/agent-engagement → { sentimentMap, peakTrafficTimes, hallOfFlame }

import { checkRateLimit, getClientIP } from './_ratelimit.js';
import { readMemory, patchMemory }     from './_scout-memory.js';

const VALID_EVENTS = ['fire', 'ice', 'vote', 'share', 'view', 'debate-reply'];

function nowHour() {
  return new Date().toISOString().slice(0, 13); // "2026-06-24T15"
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const ip = getClientIP(req);
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Rate limit exceeded' });

  const mem = await readMemory();

  // POST: record an engagement event
  if (req.method === 'POST') {
    const { event, data } = req.body || {};
    if (!event || !VALID_EVENTS.includes(event)) {
      return res.status(400).json({ error: `event must be one of: ${VALID_EVENTS.join(', ')}` });
    }

    // Update sentiment map (fire/ice per topic)
    let sentimentMap = { ...mem.sentimentMap };
    if ((event === 'fire' || event === 'ice') && data?.topic) {
      const key = data.topic.toLowerCase().slice(0, 50);
      sentimentMap[key] = sentimentMap[key] || { fire: 0, ice: 0 };
      sentimentMap[key][event]++;
    }

    // Track peak traffic times
    const peakTrafficTimes = [...(mem.peakTrafficTimes || [])];
    const hourKey = nowHour();
    const existing = peakTrafficTimes.find(p => p.hour === hourKey);
    if (existing) existing.count++;
    else peakTrafficTimes.push({ hour: hourKey, count: 1 });
    // Keep last 168 hours (1 week)
    peakTrafficTimes.sort((a, b) => b.count - a.count).splice(168);

    // Hall of Flame: track viral debate topics (fire rate > 80%)
    let hallOfFlame = [...(mem.hallOfFlame || [])];
    if (data?.topic && sentimentMap[data.topic?.toLowerCase()?.slice(0, 50)]) {
      const s = sentimentMap[data.topic.toLowerCase().slice(0, 50)];
      const total = s.fire + s.ice;
      if (total >= 10 && s.fire / total >= 0.8) {
        const existing = hallOfFlame.find(h => h.topic === data.topic);
        if (!existing) {
          hallOfFlame.unshift({ topic: data.topic, fireRate: Math.round(s.fire / total * 100), total, addedAt: new Date().toISOString() });
          hallOfFlame = hallOfFlame.slice(0, 20);
        }
      }
    }

    await patchMemory({ sentimentMap, peakTrafficTimes, hallOfFlame });
    return res.status(200).json({ ok: true });
  }

  // GET: return engagement analytics
  res.setHeader('Cache-Control', 's-maxage=60');
  return res.status(200).json({
    sentimentMap:    mem.sentimentMap    || {},
    peakTrafficTimes: mem.peakTrafficTimes || [],
    hallOfFlame:     mem.hallOfFlame     || [],
    lastUpdated:     mem.lastUpdated     || null,
  });
}
