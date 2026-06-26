// api/algorithm-app.js
// App feed algorithm for authenticated app users
// Weights: personalization 40%, engagement 30%, recency 20%, trending 10%
// Feed mix: your teams 35%, fan takes 25%, AI articles 20%, videos 12%, trending 8%

import { checkRateLimit, getClientIP } from './_ratelimit.js';

const WEIGHTS = { personalization: 0.40, engagement: 0.30, recency: 0.20, trending: 0.10 };
const MIX     = { teams: 0.35, takes: 0.25, ai: 0.20, video: 0.12, trending: 0.08 };
const LIMIT   = 30;

// ── Time bucket ────────────────────────────────────────────────────────────

function timeBucket() {
  const h = new Date().getUTCHours() + new Date().getTimezoneOffset() / -60;
  const local = ((h % 24) + 24) % 24;
  if (local >= 6  && local < 12) return 'morning';
  if (local >= 18 && local < 24) return 'evening';
  return 'midday';
}

// ── User profile ───────────────────────────────────────────────────────────

function parseProfile(req) {
  let profile = {};
  try {
    const raw = req.query?.profile || req.headers['x-user-profile'];
    if (raw) profile = JSON.parse(decodeURIComponent(raw));
  } catch {}

  return {
    userId:         req.headers['x-user-id']     || req.headers['userid']   || null,
    deviceId:       req.headers['x-device-id']   || req.headers['deviceid'] || null,
    followedTeams:  Array.isArray(profile.teams)       ? profile.teams       : [],
    followedSports: Array.isArray(profile.sports)      ? profile.sports      : [],
    pushHistory:    Array.isArray(profile.pushHistory) ? profile.pushHistory : [],
  };
}

// ── Scoring helpers ────────────────────────────────────────────────────────

function recencyScore(publishedAt) {
  const h = (Date.now() - new Date(publishedAt || 0).getTime()) / 3_600_000;
  if (h < 1)  return 1.00;
  if (h < 6)  return 0.80;
  if (h < 24) return 0.60;
  if (h < 72) return 0.30;
  return 0.10;
}

function engagementScore(item) {
  if (item.isLive)           return 1.00;
  if (item.breaking)         return 0.95;
  if (item.trending)         return 0.80;
  if (item.type === 'take')  return 0.70;
  if (item.type === 'video') return 0.65;
  if (item.type === 'ai')    return 0.55;
  return 0.40;
}

function trendingScore(item) {
  if (item.breaking || item.tag === 'Breaking')  return 1.00;
  if (item.trending  || item.tag === 'Hot Take') return 0.75;
  return 0.20;
}

function personalizationScore(item, profile, liveTeams) {
  const text = `${item.title} ${item.sport} ${item.source}`.toLowerCase();

  // Live game for followed team — highest signal
  for (const team of liveTeams) {
    if (text.includes(team.toLowerCase())) return 1.00;
  }
  for (const team of profile.followedTeams) {
    if (text.includes(team.toLowerCase())) return 0.90;
  }
  for (const sport of profile.followedSports) {
    if ((item.sport || '').toLowerCase().includes(sport.toLowerCase())) return 0.70;
  }
  for (const slug of profile.pushHistory) {
    if (text.includes(slug.toLowerCase())) return 0.55;
  }
  return 0.10;
}

function scoreItem(item, profile, liveTeams, bucket) {
  let s =
    WEIGHTS.personalization * personalizationScore(item, profile, liveTeams) +
    WEIGHTS.engagement      * engagementScore(item) +
    WEIGHTS.recency         * recencyScore(item.publishedAt) +
    WEIGHTS.trending        * trendingScore(item);

  // Morning: boost scores and recaps
  if (bucket === 'morning' && /recap|highlights?|morning|final|result/i.test(item.title)) {
    s *= 1.5;
  }
  // Evening: boost live content and takes
  if (bucket === 'evening' && (item.isLive || item.type === 'take' || /live|tonight|gameday|game\s?day/i.test(item.title))) {
    s *= 1.5;
  }
  // Live game for followed team: 2x
  if (item.isLive && profile.followedTeams.some(t => `${item.title} ${item.sport}`.toLowerCase().includes(t.toLowerCase()))) {
    s *= 2.0;
  }

  return s;
}

// ── Live teams detection ───────────────────────────────────────────────────

async function fetchLiveTeams(baseUrl, profile) {
  if (!profile.followedTeams.length) return [];
  try {
    const r = await fetch(`${baseUrl}/api/scores`);
    if (!r.ok) return [];
    const data = await r.json();
    const games = data.games || data.scores || [];
    return games
      .filter(g => g.state === 'in')
      .flatMap(g => [g.home?.name, g.away?.name].filter(Boolean))
      .filter(name => profile.followedTeams.some(t => name.toLowerCase().includes(t.toLowerCase())));
  } catch {
    return [];
  }
}

// ── Normalizers ────────────────────────────────────────────────────────────

function fromNews(articles) {
  return articles.map(a => ({
    id:          a.url || a.title,
    type:        a.breaking ? 'breaking' : (a.trending ? 'trending' : 'news'),
    title:       a.title,
    summary:     '',
    image:       a.image || a.urlToImage || '',
    url:         a.url || '#',
    sport:       a.sport || '',
    source:      typeof a.source === 'object' ? a.source.name : (a.source || 'News'),
    publishedAt: a.publishedAt,
    breaking:    !!a.breaking,
    trending:    !!a.trending,
    tag:         a.breaking ? 'Breaking' : '',
    isLive:      false,
  }));
}

function fromVideos(videos) {
  return videos.map(v => ({
    id:          v.id || v.url,
    type:        'video',
    title:       v.title,
    summary:     '',
    image:       v.thumb || '',
    url:         v.url || `https://www.youtube.com/watch?v=${v.id}`,
    sport:       v.tag || '',
    source:      v.channel || 'Video',
    publishedAt: v.published || v.publishedAt || new Date().toISOString(),
    tag:         'Video',
    isLive:      false,
  }));
}

function fromAI(articles) {
  return articles.map(a => ({
    id:          a.id,
    type:        'ai',
    title:       a.headline,
    summary:     a.subheadline || '',
    image:       a.thumbnail || '',
    url:         a.sourceUrl || '#',
    sport:       a.sport || '',
    source:      `⚡ Sideline AI · @${a.sourceUsername || ''}`,
    publishedAt: a.publishedAt,
    embed:       a.embed || null,
    tag:         a.tag || '',
    breaking:    a.tag === 'Breaking',
    trending:    a.tag === 'Breaking' || a.tag === 'Hot Take',
    isLive:      false,
  }));
}

// ── Feed builder ───────────────────────────────────────────────────────────

function buildFeed(scored, profile, liveTeams, n) {
  const b = { team: [], ai: [], take: [], video: [], trending: [], other: [] };

  for (const item of scored) {
    const isTeam =
      profile.followedTeams.some(t => `${item.title} ${item.sport}`.toLowerCase().includes(t.toLowerCase())) ||
      liveTeams.some(t => `${item.title} ${item.sport}`.toLowerCase().includes(t.toLowerCase()));

    if (isTeam)                    b.team.push(item);
    else if (item.type === 'ai')   b.ai.push(item);
    else if (item.type === 'take') b.take.push(item);
    else if (item.type === 'video') b.video.push(item);
    else if (item.trending || item.breaking) b.trending.push(item);
    else                           b.other.push(item);
  }

  const targets = {
    team:     Math.round(n * MIX.teams),
    ai:       Math.round(n * MIX.ai),
    take:     Math.round(n * MIX.takes),
    video:    Math.round(n * MIX.video),
    trending: Math.round(n * MIX.trending),
  };

  // Live team games pinned to top 3
  const liveTeamItems = b.team.filter(i => i.isLive).slice(0, 3);
  const otherTeamItems = b.team.filter(i => !i.isLive);

  const selected = [
    ...liveTeamItems,
    ...otherTeamItems.slice(0, Math.max(0, targets.team - liveTeamItems.length)),
    ...b.ai.slice(0, targets.ai),
    ...b.take.slice(0, targets.take),
    ...b.video.slice(0, targets.video),
    ...b.trending.slice(0, targets.trending),
  ];

  const used = new Set(selected.map(i => i.id));
  selected.push(...scored.filter(i => !used.has(i.id)).slice(0, n - selected.length));

  // Live team items stay pinned at top, rest sorted by score
  const pinned = selected.filter(i => liveTeamItems.find(p => p.id === i.id));
  const rest   = selected.filter(i => !pinned.find(p => p.id === i.id));
  rest.sort((a, b) => b._score - a._score);

  return [...pinned, ...rest].slice(0, n);
}

// ── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const ip = getClientIP(req);
  if (!checkRateLimit(ip, 60, 60000)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const profile = parseProfile(req);
  const bucket  = timeBucket();
  const proto   = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${proto}://${req.headers['host'] || 'fantakes.app'}`;

  const [newsRes, videosRes, aiRes, liveTeams] = await Promise.all([
    Promise.allSettled([
      fetch(`${baseUrl}/api/news?sport=home`).then(r => r.json()),
      fetch(`${baseUrl}/api/videos?sport=all`).then(r => r.json()),
      fetch(`${baseUrl}/api/articles-store`).then(r => r.json()),
    ]),
    fetchLiveTeams(baseUrl, profile),
  ]).then(([settled, live]) => [...settled, live]);

  const news   = newsRes.status   === 'fulfilled' ? (newsRes.value.articles   || []) : [];
  const videos = videosRes.status === 'fulfilled' ? (videosRes.value.videos   || []) : [];
  const ai     = aiRes.status     === 'fulfilled' && Array.isArray(aiRes.value) ? aiRes.value : [];

  const all = [
    ...fromNews(news),
    ...fromVideos(videos),
    ...fromAI(ai),
  ].map(item => ({ ...item, _score: scoreItem(item, profile, liveTeams, bucket) }))
   .sort((a, b) => b._score - a._score);

  const feed = buildFeed(all, profile, liveTeams, LIMIT);

  return res.status(200).json({
    feed,
    meta: {
      total:          all.length,
      returned:       feed.length,
      userId:         profile.userId,
      deviceId:       profile.deviceId,
      followedTeams:  profile.followedTeams,
      followedSports: profile.followedSports,
      liveTeams,
      timeBucket:     bucket,
      weights:        WEIGHTS,
      mix:            MIX,
      generatedAt:    new Date().toISOString(),
    },
  });
}
