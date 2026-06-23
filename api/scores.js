export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const LEAGUES = [
    { sport: 'football',   league: 'nfl',             label: 'NFL',        cat: 'american' },
    { sport: 'basketball', league: 'nba',             label: 'NBA',        cat: 'american' },
    { sport: 'baseball',   league: 'mlb',             label: 'MLB',        cat: 'american' },
    { sport: 'hockey',     league: 'nhl',             label: 'NHL',        cat: 'american' },
    { sport: 'soccer',     league: 'eng.1',           label: 'EPL',        cat: 'soccer'   },
    { sport: 'soccer',     league: 'usa.1',           label: 'MLS',        cat: 'soccer'   },
    { sport: 'soccer',     league: 'esp.1',           label: 'La Liga',    cat: 'soccer'   },
    { sport: 'soccer',     league: 'ger.1',           label: 'Bundesliga', cat: 'soccer'   },
    { sport: 'soccer',     league: 'ita.1',           label: 'Serie A',    cat: 'soccer'   },
    { sport: 'soccer',     league: 'fra.1',           label: 'Ligue 1',    cat: 'soccer'   },
    { sport: 'soccer',     league: 'uefa.champions',  label: 'UCL',        cat: 'soccer'   },
  ];

  const dateParam = req.query.date ? `?dates=${req.query.date}` : '';

  try {
    const results = await Promise.all(LEAGUES.map(async ({ sport, league, label, cat }) => {
      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard${dateParam}`;
        const r = await fetch(url);
        const d = await r.json();
        return (d.events || []).map(ev => {
          const comp = ev.competitions?.[0];
          if (!comp) return null;
          const home = comp.competitors?.find(c => c.homeAway === 'home');
          const away = comp.competitors?.find(c => c.homeAway === 'away');
          if (!home || !away) return null;
          const status = comp.status?.type;
          const gameUrl = (ev.links || []).find(l => (l.rel || []).includes('gamecast'))?.href
                       || (ev.links || [])[0]?.href
                       || '';
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
      } catch { return []; }
    }));

    const games = results.flat();
    res.setHeader('Cache-Control', 's-maxage=30');
    return res.status(200).json({ games });
  } catch (err) {
    return res.status(500).json({ error: err.message, games: [] });
  }
}
