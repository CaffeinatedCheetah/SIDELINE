import { createHmac } from 'crypto';
import { checkRateLimit, getClientIP } from './_ratelimit.js';

const HMAC_CONTEXT = 'sideline-admin-v1';

export function verifyAdminToken(req) {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) return false;
  const provided = auth.slice(7);
  const expected = createHmac('sha256', secret).update(HMAC_CONTEXT).digest('hex');
  return provided === expected;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIP(req);
  if (!checkRateLimit(ip, 5, 60000)) {
    return res.status(429).json({ error: 'Too many attempts' });
  }

  const { password } = req.body || {};
  const secret = process.env.ADMIN_PASSWORD;

  if (!secret) return res.status(503).json({ error: 'Admin not configured' });

  // Constant-time delay prevents timing-based enumeration
  await new Promise(r => setTimeout(r, 400 + Math.random() * 200));

  if (!password || password !== secret) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const token = createHmac('sha256', secret).update(HMAC_CONTEXT).digest('hex');
  return res.status(200).json({ token });
}
