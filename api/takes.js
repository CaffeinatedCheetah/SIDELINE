import { checkRateLimit, getClientIP } from './_ratelimit.js';

if (!globalThis.__SL_TAKES)    globalThis.__SL_TAKES    = [];
if (!globalThis.__SL_TAKES_LG) globalThis.__SL_TAKES_LG = [];

function markViral(take) {
  const total = (take.fires || 0) + (take.ices || 0);
  take.viral = total >= 100 && (take.fires || 0) / total > 0.7 && (take.fires || 0) >= 500;
  return take;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip  = getClientIP(req);
  const store = globalThis.__SL_TAKES;

  // ── GET: list takes ────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { sport, sort = 'hot', limit = '20', page = '1', viral } = req.query;
    let takes = store.length ? store : globalThis.__SL_TAKES_LG;

    if (sport && sport !== 'All') takes = takes.filter(t => t.sport === sport);
    if (viral === '1')            takes = takes.filter(t => t.viral);

    const sorted = [...takes];
    if      (sort === 'new')       sorted.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    else if (sort === 'discussed') sorted.sort((a, b) => (b.replies?.length || 0) - (a.replies?.length || 0));
    else                           sorted.sort((a, b) => (b.fires || 0) - (a.fires || 0));

    const lim   = Math.min(parseInt(limit) || 20, 100);
    const pg    = Math.max(parseInt(page)  || 1,  1);
    const start = (pg - 1) * lim;

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ takes: sorted.slice(start, start + lim), total: takes.length, page: pg });
  }

  // ── POST: submit take ──────────────────────────────────────────────────
  if (req.method === 'POST') {
    if (!checkRateLimit(ip, 10, 60000)) return res.status(429).json({ error: 'Too many takes' });
    const take = req.body;
    if (!take?.id || (!take?.text && !take?.parts?.length)) {
      return res.status(400).json({ error: 'id and text (or parts) required' });
    }
    if (!store.find(t => t.id === take.id)) {
      store.unshift(markViral({ ...take, serverTs: Date.now() }));
      if (store.length > 2000) store.splice(2000);
      globalThis.__SL_TAKES_LG = store.slice(0, 500);
    }
    return res.status(200).json({ ok: true });
  }

  // ── PATCH: update vote counts ──────────────────────────────────────────
  if (req.method === 'PATCH') {
    const { id, fires, ices } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const take = store.find(t => t.id === id);
    if (take) {
      if (fires !== undefined) take.fires = fires;
      if (ices  !== undefined) take.ices  = ices;
      markViral(take);
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
