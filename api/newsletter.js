import { checkRateLimit, getClientIP } from './_ratelimit.js';

if (!globalThis.__SL_NL_SUBS)    globalThis.__SL_NL_SUBS    = [];
if (!globalThis.__SL_NL_SUBS_LG) globalThis.__SL_NL_SUBS_LG = [];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip   = getClientIP(req);
  const subs = globalThis.__SL_NL_SUBS;

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ subscribers: subs.length });
  }

  if (req.method === 'POST') {
    if (!checkRateLimit(ip, 3, 60000)) return res.status(429).json({ error: 'Rate limit' });
    const { email, sport } = req.body || {};
    if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Valid email required' });

    const existing = subs.find(s => s.email.toLowerCase() === email.toLowerCase());
    if (!existing) {
      subs.push({ email: email.toLowerCase(), sport: sport || 'all', ts: Date.now() });
      if (subs.length > 50000) subs.splice(0, subs.length - 50000);
      globalThis.__SL_NL_SUBS_LG = subs.slice(-100);
    }
    return res.status(200).json({ ok: true, message: "You're on the list!" });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
