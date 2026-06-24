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
    // ── LAYER 1: ESPN (primary) ──────────────────────────────────────────
    let games = await fetchESPN(dateParam);

    // ── LAYER 2: TheSportsDB fallback if ESPN returned nothing ──────────
    if (!games.length) {
      try {
        games = await fetchTheSportsDB(req.query.date || '');
      } catch { /* ignore */ }
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
