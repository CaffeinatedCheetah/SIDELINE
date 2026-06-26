import webpush from 'web-push';
import { checkRateLimit, getClientIP } from './_ratelimit.js';
import { readMemory, patchMemory } from './_scout-memory.js';

const NOTIFY_INTERVAL = 5 * 60 * 1000;

function vapidReady() {
  const pub  = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const mail = process.env.VAPID_EMAIL || 'mailto:admin@fantakes.app';
  if (!pub || !priv) return false;
  webpush.setVapidDetails(mail, pub, priv);
  return true;
}

async function send(sub, payload) {
  try {
    await webpush.sendNotification(sub.subscription, JSON.stringify(payload), { TTL: 86400 });
    return true;
  } catch (err) {
    // 410/404 = subscription expired, remove it
    if (err.statusCode === 410 || err.statusCode === 404) {
      const subs = globalThis.__SL_PUSH_SUBS || [];
      const i    = subs.findIndex(s => s.subscription.endpoint === sub.subscription.endpoint);
      if (i >= 0) subs.splice(i, 1);
    }
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

  const ip = getClientIP(req);
  if (!checkRateLimit(ip, 20, 60000)) return res.status(429).json({ error: 'Rate limit' });

  const subs = globalThis.__SL_PUSH_SUBS || [];
  if (!subs.length) return res.status(200).json({ sent: 0, message: 'No subscribers' });
  if (!vapidReady()) return res.status(200).json({ sent: 0, message: 'VAPID not configured — set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL' });

  const mem      = await readMemory();
  const lastRun  = mem.pushLastNotified || 0;
  const stale    = Date.now() - new Date(lastRun || 0).getTime() > NOTIFY_INTERVAL;
  if (!stale && !req.query.force) return res.status(200).json({ sent: 0, message: 'Not due yet' });

  const sentIds = new Set(mem.pushSentIds || []);
  const queue   = [];

  // Breaking news
  for (const story of (mem.breakingNews || []).slice(0, 1)) {
    const id = `break-push-${(story.title || '').slice(0, 30)}`;
    if (!sentIds.has(id)) {
      queue.push({ id, topic: 'breaking', payload: {
        title: '🚨 BREAKING — Sideline',
        body:  String(story.title || '').slice(0, 100),
        icon:  '/favicon.ico',
        badge: '/favicon.ico',
        tag:   'breaking',
        data:  { url: 'https://fantakes.app' },
      }});
    }
  }

  // World Cup goals
  const goal = mem.worldCup?.lastGoal;
  if (goal && mem.worldCup?.active) {
    const id = `goal-push-${goal.team}-${goal.minute}`;
    if (!sentIds.has(id)) {
      queue.push({ id, topic: 'goals', payload: {
        title: '⚽ GOAL! — World Cup 2026',
        body:  `${goal.team} scored! Minute ${goal.minute}. React on Sideline.`,
        icon:  '/favicon.ico',
        tag:   'goal',
        data:  { url: 'https://fantakes.app/#soccer' },
      }});
    }
  }

  let sent = 0;
  for (const item of queue.slice(0, 2)) {
    const eligible = subs.filter(s => !s.topics || s.topics.includes(item.topic) || s.topics.includes('all'));
    const outcomes = await Promise.allSettled(eligible.map(sub => send(sub, item.payload)));
    sent += outcomes.filter(o => o.value === true).length;
    sentIds.add(item.id);
  }

  await patchMemory({ pushLastNotified: new Date().toISOString(), pushSentIds: [...sentIds].slice(-500) });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ sent, subscribers: subs.length, queued: queue.length });
}
