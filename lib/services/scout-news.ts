// Real-time sports news scanner for SCOUT
// Scans ESPN, Reddit, and RSS feeds to gather what's actually happening
// right now across all major sports. Feeds into SCOUT's take generation
// so content reacts to real events, not generic hot takes.

const ESPN_SCOREBOARD_URLS: Record<string, string> = {
  NBA: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
  NFL: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  MLB: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
  NHL: "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard",
  MLS: "https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard",
  WNBA: "https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard",
  "College Football": "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard",
  UFC: "https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard",
  EPL: "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard",
  "La Liga": "https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard",
  F1: "https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard",
};

const ESPN_NEWS_URLS: Record<string, string> = {
  NFL: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/news",
  NBA: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news",
  MLB: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news",
  NHL: "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/news",
  MLS: "https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/news",
  UFC: "https://site.api.espn.com/apis/site/v2/sports/mma/ufc/news",
  "College Football": "https://site.api.espn.com/apis/site/v2/sports/football/college-football/news",
};

const REDDIT_SUBS = [
  "nba", "nfl", "baseball", "hockey", "soccer", "mma", "CollegeBasketball",
  "CFB", "wnba", "boxing", "tennis", "formula1",
];

const RSS_FEEDS = [
  { url: "https://www.espn.com/espn/rss/news", name: "ESPN" },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml", name: "NYT Sports" },
  { url: "https://www.cbssports.com/rss/headlines", name: "CBS Sports" },
];

export type LiveGame = {
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string; // "in", "pre", "post"
  statusDetail: string;
  situation?: string;
};

export type NewsHeadline = {
  title: string;
  source: string;
  sport: string;
  url?: string;
  publishedAt?: string;
};

export type RedditPost = {
  title: string;
  subreddit: string;
  score: number;
  url: string;
};

export type SportsBrief = {
  liveGames: LiveGame[];
  recentResults: LiveGame[];
  headlines: NewsHeadline[];
  redditTrending: RedditPost[];
  timestamp: string;
};

// ── ESPN scoreboard parser ──────────────────────────────────────────────
async function fetchESPNScoreboard(league: string, url: string): Promise<LiveGame[]> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json() as Record<string, unknown>;
    const events = (data.events || []) as Array<Record<string, unknown>>;
    return events.slice(0, 8).map((event) => {
      const competition = ((event.competitions || []) as Array<Record<string, unknown>>)[0] || {} as Record<string, unknown>;
      const competitors = (competition.competitors || []) as Array<Record<string, unknown>>;
      const home = competitors.find((c) => c.homeAway === "home") || {} as Record<string, unknown>;
      const away = competitors.find((c) => c.homeAway === "away") || {} as Record<string, unknown>;
      const homeTeamObj = (home.team || {}) as Record<string, string>;
      const awayTeamObj = (away.team || {}) as Record<string, string>;
      const statusObj = (event.status || {}) as Record<string, unknown>;
      const statusType = (statusObj.type || {}) as Record<string, unknown>;
      const situation = (competition.situation || {}) as Record<string, string>;
      return {
        league,
        homeTeam: homeTeamObj.displayName || homeTeamObj.name || "TBD",
        awayTeam: awayTeamObj.displayName || awayTeamObj.name || "TBD",
        homeScore: home.score ? parseInt(String(home.score), 10) : null,
        awayScore: away.score ? parseInt(String(away.score), 10) : null,
        status: String(statusType.state || "pre"),
        statusDetail: String((statusType.shortDetail || statusType.detail || "") as string),
        situation: situation.lastPlay || undefined,
      };
    });
  } catch {
    return [];
  }
}

// ── ESPN news parser ────────────────────────────────────────────────────
async function fetchESPNNews(sport: string, url: string): Promise<NewsHeadline[]> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json() as { articles?: Array<{ headline?: string; published?: string; links?: { web?: { href?: string } } }> };
    return (data.articles || []).slice(0, 5).map((a) => ({
      title: a.headline || "",
      source: "ESPN",
      sport,
      url: a.links?.web?.href,
      publishedAt: a.published,
    })).filter((h) => h.title.length > 5);
  } catch {
    return [];
  }
}

// ── Reddit scanner ──────────────────────────────────────────────────────
async function fetchRedditHot(sub: string): Promise<RedditPost[]> {
  try {
    const res = await fetch(
      `https://www.reddit.com/r/${sub}/hot.json?limit=10&raw_json=1`,
      {
        headers: { "User-Agent": "Sideline-SCOUT/2.0 (+https://fantakes.app)" },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return [];
    const data = await res.json() as { data?: { children?: Array<{ data: { title: string; score: number; permalink: string; stickied?: boolean } }> } };
    return (data.data?.children || [])
      .filter((p) => !p.data.stickied && p.data.score > 50)
      .slice(0, 3)
      .map((p) => ({
        title: p.data.title,
        subreddit: sub,
        score: p.data.score,
        url: `https://reddit.com${p.data.permalink}`,
      }));
  } catch {
    return [];
  }
}

// ── RSS scanner ─────────────────────────────────────────────────────────
function parseTitlesFromXML(xml: string, source: string): NewsHeadline[] {
  const items: NewsHeadline[] = [];
  const re = /<item>[\s\S]*?<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const raw = m[0];
    const title = (raw.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1] || "")
      .replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, " ").trim();
    if (title.length > 10) items.push({ title, source, sport: "General" });
  }
  return items.slice(0, 5);
}

async function fetchRSSFeed(url: string, name: string): Promise<NewsHeadline[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Sideline-SCOUT/2.0 (+https://fantakes.app)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    return parseTitlesFromXML(await res.text(), name);
  } catch {
    return [];
  }
}

// ── Main: gather everything in parallel ─────────────────────────────────
export async function gatherSportsBrief(): Promise<SportsBrief> {
  const [scoreboards, news, reddit, rss] = await Promise.all([
    // Scoreboards from all leagues in parallel
    Promise.all(
      Object.entries(ESPN_SCOREBOARD_URLS).map(([league, url]) =>
        fetchESPNScoreboard(league, url),
      ),
    ),
    // News from ESPN per sport
    Promise.all(
      Object.entries(ESPN_NEWS_URLS).map(([sport, url]) =>
        fetchESPNNews(sport, url),
      ),
    ),
    // Reddit hot posts
    Promise.all(REDDIT_SUBS.map((sub) => fetchRedditHot(sub))),
    // RSS feeds
    Promise.all(RSS_FEEDS.map((f) => fetchRSSFeed(f.url, f.name))),
  ]);

  const allGames = scoreboards.flat();
  return {
    liveGames: allGames.filter((g) => g.status === "in"),
    recentResults: allGames.filter((g) => g.status === "post").slice(0, 15),
    headlines: [...news.flat(), ...rss.flat()].slice(0, 30),
    redditTrending: reddit.flat().sort((a, b) => b.score - a.score).slice(0, 15),
    timestamp: new Date().toISOString(),
  };
}
