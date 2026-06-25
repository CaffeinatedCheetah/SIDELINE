// Shared in-process memory for SCOUT agents.
// Uses globalThis so all agent functions on the same warm Lambda share state.
// Optionally persists to Vercel KV when KV_REST_API_URL + KV_REST_API_TOKEN are set.

const DEFAULT = {
  lastUpdated:          null,
  siteMode:             'normal', // 'normal' | 'worldcup' | 'breaking'
  topEvent:             null,
  trendingTopics:       [],
  breakingNews:         [],
  sentimentMap:         {},
  bestPerformingContent:[],
  peakTrafficTimes:     [],
  exclusiveFinds:       [],
  debatePrompts:        [],
  hallOfFlame:          [],
  editorNote:           '',
  worldCup: {
    active:    false,
    liveGames: [],
    standings: [],
    lastGoal:  null,
  },
  hunterBreaking:    [],
  hunterAlerts:      [],
  hunterWatchlist:   [],
  hunterLastChecked: null,
};

function local() {
  if (!globalThis.__SCOUT_MEM) globalThis.__SCOUT_MEM = structuredClone(DEFAULT);
  return globalThis.__SCOUT_MEM;
}

// ── Optional Vercel KV persistence ─────────────────────────────────────────
const KV_KEY = 'scout-memory';

async function kvGet() {
  const url = process.env.KV_REST_API_URL;
  const tok  = process.env.KV_REST_API_TOKEN;
  if (!url || !tok) return null;
  try {
    const r = await fetch(`${url}/get/${KV_KEY}`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const d = await r.json();
    return d.result ? JSON.parse(d.result) : null;
  } catch { return null; }
}

async function kvSet(mem) {
  const url = process.env.KV_REST_API_URL;
  const tok  = process.env.KV_REST_API_TOKEN;
  if (!url || !tok) return;
  try {
    await fetch(`${url}/set/${KV_KEY}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(mem), ex: 86400 }), // 24h TTL
    });
  } catch { /* ignore KV write errors */ }
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function readMemory() {
  // Try KV first (cross-instance persistence)
  const kv = await kvGet();
  if (kv) {
    globalThis.__SCOUT_MEM = kv;
    return kv;
  }
  return local();
}

export async function patchMemory(update) {
  const mem = local();
  Object.assign(mem, update, { lastUpdated: new Date().toISOString() });
  globalThis.__SCOUT_MEM = mem;
  await kvSet(mem);
  return mem;
}

export function getMemorySync() {
  return local();
}
