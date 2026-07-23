const windows = new Map<string, { count: number; resetsAt: number }>();

export function checkRateLimit(
  key: string,
  options = { limit: 60, windowMs: 60_000 },
) {
  const now = Date.now();
  const entry = windows.get(key);
  if (!entry || entry.resetsAt <= now) {
    windows.set(key, { count: 1, resetsAt: now + options.windowMs });
    return { allowed: true, remaining: options.limit - 1 };
  }
  entry.count += 1;
  return {
    allowed: entry.count <= options.limit,
    remaining: Math.max(0, options.limit - entry.count),
  };
}
