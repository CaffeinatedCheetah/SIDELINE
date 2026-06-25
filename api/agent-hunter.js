// SCOUT HUNTER: Real-time breaking news detector — runs every 5 minutes
// Scans 13 sources simultaneously, detects multi-source convergence, generates instant reactions.
// Same story on 3+ sources in 10 min = BREAKING. Transaction keyword = BREAKING immediately.
// GET /api/agent-hunter        → { breaking, alerts, watchlist, lastChecked, fresh }
// GET /api/agent-hunter?force  → force fresh scan regardless of cache

import { checkRateLimit, getClientIP } from './_ratelimit.js';
import { readMemory, patchMemory }     from './_scout-memory.js';
import { callClaude, parseJSON }       from './_claude-api.js';

const CHECK_INTERVAL = 5 * 60 * 1000;

const HUNTER_SYSTEM = `You are SCOUT — Sideline's AI breaking-news hunter. You have the speed of Woj, the passion of Stephen A. Smith, and the accuracy of AP Sports. You identify what MATTERS RIGHT NOW to fans: trades, injuries, firings, retirements. You never miss a real story and never over-hype a non-story.`;

// Words that signal a transaction or urgent event — immediate BREAKING regardless of source count
const TRANSACTION_WORDS = ['traded','trade ','signed ','signs ','released','waived','fired','retires','retiring','suspended','suspension','injury report','out for season','done for year','arrested','indicted','retirement','cut by','drops'];
const BREAKING_KEYWORDS = ['breaking:','breaking —','per sources','per espn','per woj','per shams','per rapoport','report:','sources:','confirmed:','official:'];

// ── RSS title extractor ───────────────────────────────────────────────────────
function parseTitles(xml, source) {
  const out = [];
  const re  = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const raw    = m[1];
    const title  = (raw.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1] || '')
      .replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/\s+/g,' ').trim();
    const link   = raw.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim()
                || raw.match(/<link[^>]*href="([^"]+)"/i)?.[1] || '';
    const pub    = raw.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() || '';
    if (title.length > 5) out.push({ title, url: link, source, publishedAt: pub ? new Date(pub).toISOString() : new Date().toISOString() });
  }
  return out;
}

async function fetchFeed(url, name) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Sideline-SCOUT-HUNTER/1.0; +https://fantakes.app)', Accept: 'application/rss+xml,application/xml,text/xml,*/*' },
    signal: AbortSignal.timeout(7000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return parseTitles(await r.text(), name);
}

async function fetchReddit(sub) {
  const r = await fetch(`https://www.reddit.com/r/${sub}/new.json?limit=20&raw_json=1`, {
    headers: { 'User-Agent': 'Sideline-SCOUT-HUNTER/1.0 (+https://fantakes.app)' },
    signal: AbortSignal.timeout(7000),
  });
  if (!r.ok) return [];
  const d = await r.json();
  return (d.data?.children || []).map(p => ({
    title: p.data.title,
    url:   `https://reddit.com${p.data.permalink}`,
    source:`r/${sub}`,
    publishedAt: new Date(p.data.created_utc * 1000).toISOString(),
    flair: (p.data.link_flair_text || '').toLowerCase(),
  })).filter(p => {
    const t = p.title.toLowerCase();
    return p.flair.includes('break') || p.flair.includes('transaction') || TRANSACTION_WORDS.some(w => t.includes(w));
  });
}

// ── Keyword overlap (for story grouping) ─────────────────────────────────────
const STOP = new Set(['the','a','an','is','was','in','on','at','to','of','for','and','or','with','has','had','been','will','that','this','from','after','over','says','said','per','new','just','now','back','about']);

function kw(title) {
  return new Set(title.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w => w.length > 3 && !STOP.has(w)));
}

function overlap(a, b) {
  let n = 0; for (const w of a) if (b.has(w)) n++; return n;
}

// ── Signal classification ────────────────────────────────────────────────────
function classifySignal(item) {
  const t = item.title.toLowerCase();
  if (TRANSACTION_WORDS.some(w => t.includes(w))) return 'transaction';
  if (BREAKING_KEYWORDS.some(w => t.includes(w))) return 'breaking';
  return 'news';
}

function detectSport(title) {
  const t = title.toLowerCase();
  if (/\bnfl\b|quarterback|touchdowns?|patriots|chiefs|cowboys|eagles|packers/.test(t)) return 'nfl';
  if (/\bnba\b|lakers|warriors|celtics|knicks|lebron|curry|durant/.test(t)) return 'nba';
  if (/\bmlb\b|yankees|dodgers|cubs|home run|pitcher|baseball/.test(t)) return 'mlb';
  if (/\bnhl\b|hockey|goalie|puck|maple leafs/.test(t)) return 'nhl';
  if (/soccer|premier.league|messi|ronaldo|mbappe|transfer|fifa|la liga/.test(t)) return 'soccer';
  if (/ufc|mma\b|fighter|knockout|octagon|conor|khabib/.test(t)) return 'ufc';
  if (/\bf1\b|formula.1|grand prix|hamilton|verstappen|ferrari/.test(t)) return 'f1';
  return 'general';
}

// ── Convergence grouping (10-min window) ─────────────────────────────────────
function groupByStory(items, windowMs) {
  const now    = Date.now();
  const recent = items.filter(i => now - new Date(i.publishedAt).getTime() < windowMs);
  const groups = [];
  for (const item of recent) {
    const ks  = kw(item.title);
    const hit = groups.find(g => overlap(g.kw, ks) >= 4);
    if (hit) { hit.items.push(item); for (const w of ks) hit.kw.add(w); }
    else groups.push({ kw: ks, items: [item] });
  }
  return groups;
}

// ── SCOUT instant reaction ────────────────────────────────────────────────────
async function generateReaction(title, sport, sources) {
  if (!process.env.ANTHROPIC_API_KEY) return { reaction: '🚨 SCOUT is tracking this.', debate: null };
  const prompt = `You are SCOUT. Breaking sports news just hit on ${sources.join(', ')}:
"${title}" (${sport.toUpperCase()})

Return ONLY valid JSON — no fences, no explanation:
{"reaction":"ONE sentence ≤14 words starting with 🚨 or ⚡ that makes fans feel the moment","debate":{"question":"one compelling fan debate question (e.g. 'LeBron to Warriors — Fire or Ice?')","type":"hot-take|controversy|prediction","energyLevel":1-10}}`;
  try {
    const text   = await callClaude({ prompt, system: HUNTER_SYSTEM, model: 'claude-haiku-4-5-20251001', maxTokens: 200 });
    const parsed = parseJSON(text);
    if (parsed?.reaction) return parsed;
  } catch { /* fall through */ }
  return { reaction: '🚨 SCOUT is on it — stay locked in.', debate: null };
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const ip = getClientIP(req);
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Rate limit exceeded' });

  const mem         = await readMemory();
  const lastChecked = mem.hunterLastChecked ? new Date(mem.hunterLastChecked).getTime() : 0;
  const stale       = Date.now() - lastChecked > CHECK_INTERVAL;
  const force       = req.query.force === 'true';

  if (!stale && !force) {
    res.setHeader('Cache-Control', 's-maxage=60');
    return res.status(200).json({
      breaking:       mem.hunterBreaking    || [],
      alerts:         mem.hunterAlerts      || [],
      watchlist:      mem.hunterWatchlist   || [],
      lastChecked:    mem.hunterLastChecked || null,
      fresh:          false,
      sourcesScanned: 0,
    });
  }

  // ── Scan all 13 sources simultaneously ───────────────────────────────────────
  const FEEDS = [
    () => fetchFeed('https://www.espn.com/espn/rss/news',                                    'ESPN'),
    () => fetchFeed('https://www.espn.com/espn/rss/nfl/news',                                'ESPN NFL'),
    () => fetchFeed('https://www.espn.com/espn/rss/nba/news',                                'ESPN NBA'),
    () => fetchFeed('https://www.espn.com/espn/rss/mlb/news',                                'ESPN MLB'),
    () => fetchFeed('https://www.cbssports.com/rss/headlines/',                               'CBS Sports'),
    () => fetchFeed('https://www.cbssports.com/nfl/rss/headlines/',                           'CBS NFL'),
    () => fetchFeed('https://www.cbssports.com/nba/rss/headlines/',                           'CBS NBA'),
    () => fetchFeed('https://feeds.bleacherreport.com/articles/home.rss',                     'Bleacher Report'),
    () => fetchFeed('https://sports.yahoo.com/rss/',                                          'Yahoo Sports'),
    () => fetchFeed('https://news.google.com/rss/search?q=sports+trade+injury+breaking&hl=en-US&gl=US&ceid=US:en', 'Google News'),
    () => fetchReddit('nfl'),
    () => fetchReddit('nba'),
    () => fetchReddit('soccer'),
  ];

  const settled = await Promise.allSettled(FEEDS.map(fn => fn()));
  const allItems = settled.filter(r => r.status === 'fulfilled').flatMap(r => r.value);
  const sourcesOk = settled.filter(r => r.status === 'fulfilled').length;

  console.log('[SCOUT hunter] items:', allItems.length, '| sources ok:', sourcesOk, '/', FEEDS.length);

  // ── Group stories and classify ─────────────────────────────────────────────
  const groups = groupByStory(allItems, 10 * 60 * 1000); // 10-min window

  const classified = groups.map(g => {
    const rep     = g.items[0];
    const signal  = g.items.reduce((best, item) => {
      const s = classifySignal(item);
      const p = { transaction: 3, breaking: 2, news: 1 };
      return (p[s] || 0) > (p[best] || 0) ? s : best;
    }, 'news');
    const sources = [...new Set(g.items.map(i => i.source))];
    return { title: rep.title, url: rep.url, signal, sport: detectSport(rep.title), sources, sourceCount: sources.length, publishedAt: rep.publishedAt };
  });

  // ── Tier assignment ────────────────────────────────────────────────────────
  // BREAKING: transaction keyword OR story on 3+ sources
  // ALERT:    breaking keyword OR story on 2+ sources
  // WATCH:    single-source news with breaking keyword
  const breaking  = classified.filter(g => g.signal === 'transaction' || g.sourceCount >= 3);
  const alerts    = classified.filter(g => !breaking.includes(g) && (g.signal === 'breaking' || g.sourceCount >= 2));
  const watchlist = classified.filter(g => !breaking.includes(g) && !alerts.includes(g) && g.signal !== 'news');

  // ── Generate SCOUT reactions for genuinely new breaking stories ───────────
  const now    = Date.now();
  const TWO_HR = 2 * 60 * 60 * 1000;
  const oldBreaking   = (mem.hunterBreaking || []).filter(b => now - new Date(b.detectedAt || 0).getTime() < TWO_HR);
  const seenTitles    = new Set(oldBreaking.map(b => b.title.toLowerCase().slice(0, 50)));
  const freshBreaking = breaking.filter(b => !seenTitles.has(b.title.toLowerCase().slice(0, 50)));

  const withReactions = await Promise.all(
    freshBreaking.slice(0, 3).map(async story => {
      const { reaction, debate } = await generateReaction(story.title, story.sport, story.sources);
      return { ...story, reaction, debate, detectedAt: new Date().toISOString() };
    })
  );

  const finalBreaking  = [...withReactions, ...oldBreaking].slice(0, 5);
  const finalAlerts    = alerts.slice(0, 8).map(a => ({ ...a, detectedAt: new Date().toISOString() }));
  const finalWatchlist = watchlist.slice(0, 10).map(w => ({ ...w, detectedAt: new Date().toISOString() }));

  // ── Push new debate prompts from breaking stories into SCOUT memory ────────
  const newDebates     = withReactions.filter(s => s.debate).map(s => ({ ...s.debate, sport: s.sport, fromHunter: true }));
  const existingPrompts = (mem.debatePrompts || []).filter(p => !p.fromHunter).slice(0, 3);
  const mergedPrompts   = [...newDebates, ...existingPrompts].slice(0, 5);

  // ── Update memory ──────────────────────────────────────────────────────────
  const update = {
    hunterBreaking:    finalBreaking,
    hunterAlerts:      finalAlerts,
    hunterWatchlist:   finalWatchlist,
    hunterLastChecked: new Date().toISOString(),
    breakingNews:      finalBreaking.map(b => ({ title: b.title, urgency: b.signal === 'transaction' ? 9 : 7, sport: b.sport, summary: b.reaction || '', detectedAt: b.detectedAt })),
  };
  if (newDebates.length) update.debatePrompts = mergedPrompts;
  if (finalBreaking.length && withReactions[0]?.reaction) update.editorNote = withReactions[0].reaction;

  await patchMemory(update);

  console.log('[SCOUT hunter] breaking:', finalBreaking.length, '| alerts:', finalAlerts.length, '| watch:', finalWatchlist.length, '| new debates:', newDebates.length);

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ breaking: finalBreaking, alerts: finalAlerts, watchlist: finalWatchlist, lastChecked: new Date().toISOString(), fresh: true, sourcesScanned: FEEDS.length });
}
