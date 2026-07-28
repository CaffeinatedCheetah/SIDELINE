export interface SupportedLeague {
  key: string;
  name: string;
  abbreviation: string;
  sportKey: string;
  sportName: string;
  providerSport: string;
  providerLeague: string;
  gameRoomCompatible: boolean;
  refreshSeconds: { live: number; idle: number };
  limitations?: string;
}

export const SUPPORTED_LEAGUES: SupportedLeague[] = [
  league("nfl", "NFL", "Football", "football", "nfl"),
  league("nba", "NBA", "Basketball", "basketball", "nba"),
  league("mlb", "MLB", "Baseball", "baseball", "mlb"),
  league("nhl", "NHL", "Hockey", "hockey", "nhl"),
  league("wnba", "WNBA", "Basketball", "basketball", "wnba"),
  league("epl", "Premier League", "Soccer", "soccer", "eng.1"),
  league("mls", "MLS", "Soccer", "soccer", "usa.1"),
  league("la-liga", "La Liga", "Soccer", "soccer", "esp.1"),
  league("bundesliga", "Bundesliga", "Soccer", "soccer", "ger.1"),
  league("serie-a", "Serie A", "Soccer", "soccer", "ita.1"),
  league("ligue-1", "Ligue 1", "Soccer", "soccer", "fra.1"),
  league(
    "champions-league",
    "UEFA Champions League",
    "Soccer",
    "soccer",
    "uefa.champions",
  ),
  league("world-cup", "FIFA World Cup", "Soccer", "soccer", "fifa.world"),
];

function league(
  key: string,
  name: string,
  sportName: string,
  providerSport: string,
  providerLeague: string,
): SupportedLeague {
  return {
    key,
    name,
    abbreviation: name === "Premier League" ? "EPL" : name,
    sportKey: providerSport,
    sportName,
    providerSport,
    providerLeague,
    gameRoomCompatible: true,
    refreshSeconds: { live: 15, idle: 300 },
  };
}

export function getSupportedLeague(key: string) {
  return SUPPORTED_LEAGUES.find((league) => league.key === key);
}
