import { checkRateLimit, getClientIP } from './_ratelimit.js';

const lastGood = new Map(); // persistent last-good cache, never expires

const LEAGUES = [
  { sport: 'football',   league: 'nfl',            label: 'NFL',        cat: 'american' },
  { sport: 'basketball', league: 'nba',            label: 'NBA',        cat: 'american' },
  { sport: 'baseball',   league: 'mlb',            label: 'MLB',        cat: 'american' },
  { sport: 'hockey',     league: 'nhl',            label: 'NHL',        cat: 'american' },
  { sport: 'basketball', league: 'wnba',           label: 'WNBA',       cat: 'american' },
  { sport: 'soccer',     league: 'eng.1',          label: 'EPL',        cat: 'soccer'   },
  { sport: 'soccer',     league: 'usa.1',          label: 'MLS',        cat: 'soccer'   },
  { sport: 'soccer',     league: 'esp.1',          label: 'La Liga',    cat: 'soccer'   },
  { sport: 'soccer',     league: 'ger.1',          label: 'Bundesliga', cat: 'soccer'   },
  { sport: 'soccer',     league: 'ita.1',          label: 'Serie A',    cat: 'soccer'   },
  { sport: 'soccer',     league: 'fra.1',          label: 'Ligue 1',    cat: 'soccer'   },
  { sport: 'soccer',     league: 'uefa.champions', label: 'UCL',        cat: 'soccer'   },
  { sport: 'soccer',     league: 'fifa.world',     label: 'World Cup',  cat: 'soccer'   },
  { sport: 'mma',        league: 'ufc',            label: 'UFC',        cat: 'combat'   },
  { sport: 'racing',     league: 'f1',             label: 'F1',         cat: 'racing'   },
];

// ── ESPN scoreboard fetch ──────────────────────────────────────────────────
async function fetchESPN(dateParam) {
  const results = await Promise.allSettled(LEAGUES.map(async ({ sport, league, label, cat }) => {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard${dateParam}`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.events || []).map(ev => {
      const comp = ev.competitions?.[0];
      if (!comp) return null;
      const home = comp.competitors?.find(c => c.homeAway === 'home');
      const away = comp.competitors?.find(c => c.homeAway === 'away');
      if (!home || !away) return null;
      const status = comp.status?.type;
      const gameUrl = (ev.links || []).find(l => (l.rel || []).includes('gamecast'))?.href
                   || (ev.links || [])[0]?.href || '';
      return {
        state:  status?.state || 'pre',
        detail: status?.detail || '',
        cat,
        label,
        date: comp.date || ev.date || '',
        url:  gameUrl,
        home: {
          name:   home.team?.abbreviation || home.team?.name || '',
          score:  home.score ?? 0,
          logo:   home.team?.logo || '',
          winner: home.winner || false,
        },
        away: {
          name:   away.team?.abbreviation || away.team?.name || '',
          score:  away.score ?? 0,
          logo:   away.team?.logo || '',
          winner: away.winner || false,
        },
      };
    }).filter(Boolean);
  }));
  return results.filter(r => r.status === 'fulfilled').flatMap(r => r.value);
}

// ── World Cup 2026 live API ───────────────────────────────────────────────
async function fetchWorldCup() {
  try {
    const r = await fetch('https://worldcup26.ir/get/games', {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Sideline/1.0' }
    });
    if (!r.ok) return [];
    const data = await r.json();
    const games = Array.isArray(data) ? data : (data.games || data.matches || data.data || []);
    return games.map(g => {
      const home = g.home || g.homeTeam || g.team_home || {};
      const away = g.away || g.awayTeam || g.team_away || {};
      const status = (g.status || g.state || g.matchStatus || '').toLowerCase();
      const isLive = status.includes('live') || status.includes('progress') || status.includes('ht') || status === 'in';
      const isFin  = status.includes('ft') || status.includes('finish') || status.includes('end') || status === 'post';
      return {
        state:  isLive ? 'in' : isFin ? 'post' : 'pre',
        detail: g.time || g.minute || g.detail || '',
        cat:    'soccer',
        label:  'World Cup 2026',
        wc:     true,
        date:   g.date || g.datetime || g.kickoff || g.startTime || '',
        url:    '',
        home: {
          name:   home.name || home.team || home.shortName || '',
          score:  Number(home.score ?? home.goals ?? g.home_score ?? 0),
          logo:   home.flag || home.logo || home.crest || '',
          winner: !!(home.winner || (isFin && Number(home.score ?? 0) > Number(away.score ?? 0))),
        },
        away: {
          name:   away.name || away.team || away.shortName || '',
          score:  Number(away.score ?? away.goals ?? g.away_score ?? 0),
          logo:   away.flag || away.logo || away.crest || '',
          winner: !!(away.winner || (isFin && Number(away.score ?? 0) > Number(home.score ?? 0))),
        },
      };
    }).filter(g => g.home.name && g.away.name);
  } catch { return []; }
}

// ── TheSportsDB free-tier fallback ─────────────────────────────────────────
const TSDB_SPORT_MAP = {
  'Soccer': 'soccer', 'Football': 'american', 'Basketball': 'american',
  'Ice Hockey': 'american', 'Baseball': 'american', 'Rugby': 'rugby',
  'Mixed Martial Arts': 'combat', 'Motorsport': 'racing',
};

async function fetchTheSportsDB(dateStr) {
  // dateStr: YYYYMMDD -> need YYYY-MM-DD
  const d = dateStr || new Date().toISOString().split('T')[0].replace(/-/g, '');
  const iso = d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8);
  const r = await fetch(`https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${iso}`);
  if (!r.ok) return [];
  const data = await r.json();
  return (data.events || []).map(ev => {
    const cat = TSDB_SPORT_MAP[ev.strSport] || 'american';
    const hs = ev.intHomeScore, as_ = ev.intAwayScore;
    const finished = ev.strStatus === 'Match Finished' || ev.strStatus === 'FT' || ev.strStatus === 'AOT' || ev.strStatus === 'PEN';
    const live = ev.strStatus === 'In Progress' || ev.strStatus === 'HT' || ev.strStatus === 'ET';
    return {
      state:  live ? 'in' : finished ? 'post' : 'pre',
      detail: ev.strStatus || '',
      cat,
      label:  ev.strLeague || ev.strSport || '',
      date:   (ev.dateEvent || '') + 'T' + (ev.strTime || '00:00:00') + 'Z',
      url:    '',
      home: { name: ev.strHomeTeam || '', score: hs ?? 0, logo: ev.strHomeTeamBadge || '', winner: finished && hs > as_ },
      away: { name: ev.strAwayTeam || '', score: as_ ?? 0, logo: ev.strAwayTeamBadge || '', winner: finished && as_ > hs },
    };
  }).filter(g => g.home.name && g.away.name);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const ip = getClientIP(req);
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.', games: [] });
  }

  const dateParam = req.query.date ? `?dates=${req.query.date}` : '';

  try {
    // ── LAYER 1: ESPN + World Cup live simultaneously ─────────────────────
    const [espnGames, wcGames] = await Promise.all([
      fetchESPN(dateParam),
      !req.query.date ? fetchWorldCup() : Promise.resolve([]),
    ]);

    // Merge: WC games first (pinned), then ESPN (dedup any WC games ESPN also returned)
    let games = [...wcGames];
    for (const g of espnGames) {
      const isWcDup = g.label === 'World Cup' && wcGames.some(
        w => w.home.name === g.home.name && w.away.name === g.away.name
      );
      if (!isWcDup) games.push(g);
    }

    // ── LAYER 2: TheSportsDB fallback if all returned nothing ─────────────
    if (!games.length) {
      try {
        games = await fetchTheSportsDB(req.query.date || '');
      } catch { /* ignore */ }
    }

    // ── Filter: live, finished <3h ago, or starting <2h from now ────────
    if (!req.query.date) {
      const now = Date.now();
      const THREE_HOURS = 3 * 60 * 60 * 1000;
      const TWO_HOURS   = 2 * 60 * 60 * 1000;
      games = games.filter(g => {
        if (g.state === 'in') return true;
        const t = g.date ? new Date(g.date).getTime() : 0;
        if (!t || isNaN(t)) return g.state !== 'pre';
        if (g.state === 'post') return now - t < THREE_HOURS;
        if (g.state === 'pre')  return t - now < TWO_HOURS && t > now;
        return false;
      });

      // Sort: live first, then upcoming by start time, then finished by recency
      games.sort((a, b) => {
        const aLive = a.state === 'in' ? 2 : a.state === 'pre' ? 1 : 0;
        const bLive = b.state === 'in' ? 2 : b.state === 'pre' ? 1 : 0;
        if (aLive !== bLive) return bLive - aLive;
        const at = a.date ? new Date(a.date).getTime() : 0;
        const bt = b.date ? new Date(b.date).getTime() : 0;
        if (a.state === 'pre') return at - bt;  // soonest first
        return bt - at;                          // most recent first
      });
    }

    // Cache result if we got data
    if (games.length) lastGood.set('games', games);

    // ── LAYER 3: Last-good fallback if both sources returned nothing ────
    if (!games.length) {
      const fallback = lastGood.get('games');
      if (fallback) {
        res.setHeader('Cache-Control', 's-maxage=30');
        return res.status(200).json({ games: fallback, source: 'fallback' });
      }
    }

    res.setHeader('Cache-Control', 's-maxage=30');
    return res.status(200).json({ games });
  } catch (err) {
    const fallback = lastGood.get('games');
    if (fallback) {
      res.setHeader('Cache-Control', 's-maxage=30');
      return res.status(200).json({ games: fallback, source: 'fallback' });
    }
    return res.status(500).json({ error: err.message, games: [] });
  }
}
