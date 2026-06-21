export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const FDKEY = process.env.FD_API_KEY;
  const BDKEY = process.env.BALLDONTLIE_KEY;

  const ESPN_LEAGUES = [
    { sport: 'football',     league: 'nfl',              label: 'NFL',          cat: 'american' },
    { sport: 'basketball',   league: 'nba',              label: 'NBA',          cat: 'american' },
    { sport: 'basketball',   league: 'wnba',             label: 'WNBA',         cat: 'american' },
    { sport: 'football',     league: 'college-football', label: 'NCAAF',        cat: 'american' },
    { sport: 'baseball',     league: 'mlb',              label: 'MLB',          cat: 'american' },
    { sport: 'hockey',       league: 'nhl',              label: 'NHL',          cat: 'american' },
    { sport: 'soccer',       league: 'usa.1',            label: 'MLS',          cat: 'soccer'   },
    { sport: 'soccer',       league: 'eng.1',            label: 'EPL',          cat: 'soccer'   },
    { sport: 'soccer',       league: 'esp.1',            label: 'La Liga',      cat: 'soccer'   },
    { sport: 'soccer',       league: 'ger.1',            label: 'Bundesliga',   cat: 'soccer'   },
    { sport: 'soccer',       league: 'ita.1',            label: 'Serie A',      cat: 'soccer'   },
    { sport: 'soccer',       league: 'fra.1',            label: 'Ligue 1',      cat: 'soccer'   },
    { sport: 'soccer',       league: 'uefa.champions',   label: 'UCL',          cat: 'soccer'   },
    { sport: 'rugby',        league: 'uru',              label: 'Rugby Union',  cat: 'rugby'    },
    { sport: 'rugby-league', league: 'nrl',              label: 'Rugby League', cat: 'rugby'    },
    { sport: 'golf',         league: 'pga',              label: 'PGA Tour',     cat: 'other'    },
    { sport: 'tennis',       league: 'atp',              label: 'ATP',          cat: 'other'    },
    { sport: 'mma',          league: 'ufc',              label: 'UFC',          cat: 'combat'   },
  ];

  function mkGame(label, cat, state, detail, date, hn, hl, hs, hw, an, al, as_, aw) {
    return {
      label: label || '', cat: cat || 'other',
      state: state || 'pre', detail: detail || '', date: date || '',
      home: { name: hn || 'Home', logo: hl || '', score: hs != null ? String(hs) : '-', winner: !!hw },
      away: { name: an || 'Away', logo: al || '', score: as_ != null ? String(as_) : '-', winner: !!aw }
    };
  }

  // ESPN — no key needed, server-side call bypasses CORS
  async function fetchESPN(lg) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/${lg.sport}/${lg.league}/scoreboard`;
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const d = await r.json();
      return (d.events || []).map(ev => {
        const comp = ev.competitions?.[0];
        const comps = comp?.competitors || [];
        const home = comps.find(c => c.homeAway === 'home') || comps[0] || {};
        const away = comps.find(c => c.homeAway === 'away') || comps[1] || {};
        const st = ev.status?.type || {};
        return mkGame(lg.label, lg.cat, st.state, st.shortDetail, ev.date,
          home.team?.shortDisplayName || home.team?.displayName, home.team?.logo,
          home.score, home.winner,
          away.team?.shortDisplayName || away.team?.displayName, away.team?.logo,
          away.score, away.winner);
      });
    } catch { return []; }
  }

  // Official MLB API — free, no key, most reliable baseball source
  async function fetchMLB() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const r = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&hydrate=linescore,team`);
      const d = await r.json();
      const games = [];
      for (const dt of d.dates || []) {
        for (const g of dt.games || []) {
          const abs = g.status?.abstractGameState;
          const state = abs === 'Live' ? 'in' : abs === 'Final' ? 'post' : 'pre';
          const ls = g.linescore || {};
          const hs = ls.teams?.home?.runs ?? g.teams?.home?.score;
          const as_ = ls.teams?.away?.runs ?? g.teams?.away?.score;
          const inn = ls.currentInningOrdinal ? `${ls.currentInningOrdinal}${ls.isTopInning ? ' T' : ' B'}` : '';
          const ht = g.teams?.home?.team;
          const at = g.teams?.away?.team;
          games.push(mkGame('MLB', 'american', state, inn, g.gameDate,
            ht?.teamName, ht ? `https://www.mlbstatic.com/team-logos/${ht.id}.svg` : '',
            hs, state === 'post' && hs > as_,
            at?.teamName, at ? `https://www.mlbstatic.com/team-logos/${at.id}.svg` : '',
            as_, state === 'post' && as_ > hs));
        }
      }
      return games;
    } catch { return []; }
  }

  // Official NHL API — free, no key, most reliable hockey source
  async function fetchNHL() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const r = await fetch(`https://api-web.nhle.com/v1/score/${today}`);
      const d = await r.json();
      return (d.games || []).map(g => {
        const ps = g.gameState;
        const state = (ps === 'LIVE' || ps === 'CRIT') ? 'in' : (ps === 'FINAL' || ps === 'OFF') ? 'post' : 'pre';
        const hs = g.homeTeam?.score;
        const as_ = g.awayTeam?.score;
        const pd = g.periodDescriptor ? `P${g.periodDescriptor.number || ''}` : '';
        const ht = g.homeTeam || {};
        const at = g.awayTeam || {};
        return mkGame('NHL', 'american', state, pd, g.startTimeUTC,
          ht.name?.default || ht.abbrev,
          `https://assets.nhle.com/logos/nhl/svg/${ht.abbrev || 'NHL'}_light.svg`,
          hs, state === 'post' && hs > as_,
          at.name?.default || at.abbrev,
          `https://assets.nhle.com/logos/nhl/svg/${at.abbrev || 'NHL'}_light.svg`,
          as_, state === 'post' && as_ > hs);
      });
    } catch { return []; }
  }

  // Football-Data.org — soccer specialist (key from env)
  async function fetchSoccer() {
    if (!FDKEY) return [];
    const comps = [
      { code: 'PL',  label: 'EPL'       },
      { code: 'PD',  label: 'La Liga'   },
      { code: 'SA',  label: 'Serie A'   },
      { code: 'BL1', label: 'Bundesliga'},
      { code: 'FL1', label: 'Ligue 1'   },
      { code: 'CL',  label: 'UCL'       },
    ];
    const today = new Date().toISOString().split('T')[0];
    const results = await Promise.all(comps.map(async c => {
      try {
        const r = await fetch(
          `https://api.football-data.org/v4/competitions/${c.code}/matches?dateFrom=${today}&dateTo=${today}`,
          { headers: { 'X-Auth-Token': FDKEY } }
        );
        const d = await r.json();
        return (d.matches || []).map(m => {
          const s = m.status;
          const state = s === 'FINISHED' ? 'post' : (s === 'IN_PLAY' || s === 'PAUSED') ? 'in' : 'pre';
          const hs = m.score?.fullTime?.home;
          const as_ = m.score?.fullTime?.away;
          return mkGame(c.label, 'soccer', state,
            s === 'IN_PLAY' ? 'Live' : s === 'PAUSED' ? 'HT' : '', m.utcDate,
            m.homeTeam?.shortName || m.homeTeam?.name, m.homeTeam?.crest,
            hs != null ? hs : '-', state === 'post' && m.score?.winner === 'HOME_TEAM',
            m.awayTeam?.shortName || m.awayTeam?.name, m.awayTeam?.crest,
            as_ != null ? as_ : '-', state === 'post' && m.score?.winner === 'AWAY_TEAM');
        });
      } catch { return []; }
    }));
    return results.flat();
  }

  // balldontlie — NBA + 20 leagues (key from env)
  async function fetchBallDontLie() {
    if (!BDKEY) return [];
    try {
      const today = new Date().toISOString().split('T')[0];
      const r = await fetch(
        `https://api.balldontlie.io/v1/games?dates[]=${today}&per_page=15`,
        { headers: { 'Authorization': BDKEY } }
      );
      const d = await r.json();
      return (d.data || []).map(g => {
        const s = g.status;
        const inPlay = s && (s.includes('Qtr') || s.includes('Half') || s === 'Halftime');
        const state = s === 'Final' ? 'post' : inPlay ? 'in' : 'pre';
        const hs = g.home_team_score;
        const as_ = g.visitor_team_score;
        return mkGame('NBA', 'american', state, inPlay ? s : '', g.date,
          g.home_team?.full_name, '', hs, state === 'post' && hs > as_,
          g.visitor_team?.full_name, '', as_, state === 'post' && as_ > hs);
      });
    } catch { return []; }
  }

  try {
    // Fire all APIs simultaneously
    const [espnResults, mlb, nhl, soccer, nba] = await Promise.all([
      Promise.all(ESPN_LEAGUES.map(fetchESPN)),
      fetchMLB(),
      fetchNHL(),
      fetchSoccer(),
      fetchBallDontLie(),
    ]);

    const all = [...espnResults.flat(), ...mlb, ...nhl, ...soccer, ...nba];

    // Deduplicate
    const seen = new Set();
    const games = all.filter(g => {
      const key = `${g.home.name}${g.away.name}${g.label}`.toLowerCase().replace(/\s+/g, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return g.home.name !== 'Home' && g.away.name !== 'Away';
    });

    // Sort: live first, then upcoming by time, then final
    const rank = { in: 0, pre: 1, post: 2 };
    games.sort((a, b) =>
      (rank[a.state] || 0) - (rank[b.state] || 0) ||
      new Date(a.date) - new Date(b.date)
    );

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({
      games,
      count: games.length,
      live: games.filter(g => g.state === 'in').length,
      updated: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, games: [] });
  }
}
