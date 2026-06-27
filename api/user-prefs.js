import { checkRateLimit, getClientIP } from './_ratelimit.js';

async function kvGet(key) {
  const url = process.env.KV_REST_API_URL;
  const tok  = process.env.KV_REST_API_TOKEN;
  if (!url || !tok) return null;
  try {
    const r = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const d = await r.json();
    return d.result ? JSON.parse(d.result) : null;
  } catch { return null; }
}

async function kvSet(key, value) {
  const url = process.env.KV_REST_API_URL;
  const tok  = process.env.KV_REST_API_TOKEN;
  if (!url || !tok) return;
  try {
    await fetch(`${url}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(value) }),
    });
  } catch {}
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip = getClientIP(req);
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Rate limit exceeded' });

  const userId = req.query.userId || req.body?.userId;
  if (!userId || typeof userId !== 'string' || userId.length > 128) {
    return res.status(400).json({ error: 'userId required' });
  }

  const key = `user:${userId}:prefs`;

  if (req.method === 'GET') {
    const prefs = await kvGet(key);
    return res.status(200).json(prefs || {});
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const existing = await kvGet(key) || {};
    const updated = {
      ...existing,
      ...body,
      userId,
      updated_at: new Date().toISOString(),
      onboarding_complete: true,
    };
    await kvSet(key, updated);
    return res.status(200).json({ success: true, prefs: updated });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
