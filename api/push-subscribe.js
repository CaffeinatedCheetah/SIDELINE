import { checkRateLimit, getClientIP } from './_ratelimit.js';

if (!globalThis.__SL_PUSH_SUBS) globalThis.__SL_PUSH_SUBS = [];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip   = getClientIP(req);
  const subs = globalThis.__SL_PUSH_SUBS;

  if (req.method === 'GET') {
    return res.status(200).json({
      publicKey:   process.env.VAPID_PUBLIC_KEY || null,
      subscribers: subs.length,
      ready:       !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    });
  }

  if (req.method === 'POST') {
    if (!checkRateLimit(ip, 5, 60000)) return res.status(429).json({ error: 'Rate limit' });
    const { subscription, topics = ['breaking', 'goals'] } = req.body || {};
    if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalid subscription' });

    const idx = subs.findIndex(s => s.subscription.endpoint === subscription.endpoint);
    if (idx >= 0) {
      subs[idx] = { subscription, topics, ts: Date.now() };
    } else {
      subs.push({ subscription, topics, ts: Date.now() });
      if (subs.length > 10000) subs.splice(0, subs.length - 10000);
    }
    return res.status(200).json({ ok: true, subscribers: subs.length });
  }

  if (req.method === 'DELETE') {
    const { endpoint } = req.body || {};
    const idx = subs.findIndex(s => s.subscription.endpoint === endpoint);
    if (idx >= 0) subs.splice(idx, 1);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
