const store = new Map();

export function checkRateLimit(ip, limit = 100, windowMs = 60000) {
  const now = Date.now();

  if (!store.has(ip)) store.set(ip, []);

  const times = store.get(ip).filter(t => now - t < windowMs);
  store.set(ip, times);

  if (times.length >= limit) return false;

  times.push(now);

  // Prune stale IPs to prevent memory growth in long-lived instances
  if (store.size > 5000) {
    for (const [k, v] of store.entries()) {
      if (!v.length || now - v[v.length - 1] >= windowMs) store.delete(k);
    }
  }

  return true;
}

export function getClientIP(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress
    || 'unknown';
}
