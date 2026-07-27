// Live scoreboard display data from ESPN's public (no-key) endpoints.
// Deliberately separate from lib/sports/provider.ts's SportsProvider/
// syncTodaysGames pipeline: that pipeline upserts into the Game/Team/League
// tables so takes/debates/predictions can attach via real foreign keys.
// ESPN data here is fetched live per page load (60s Next.js Data Cache) and
// never written to the database -- schedule/score *display* only, per
// explicit instruction: "Database games are for games that have user takes/
// debates attached."
//
// Field shapes below were confirmed against real ESPN responses (NBA, NFL,
// F1, UFC scoreboard endpoints fetched and inspected directly), not
// guessed. Two real findings from that inspection shaped this file:
// - competitor.score is a STRING ("0"), not a number -- must be parsed.
// - F1 and UFC events do NOT fit the two-competitor home/away shape every
//   team sport uses. F1 has 20+ drivers with no home/away pairing at all;
//   UFC has exactly 2 competitors but they're `athlete`, not `team`, with
//   no numeric score (a fight resolves to a `winner` boolean, not a
//   score). UFC is supported via a separate fighter-vs-fighter adapter
//   (no invented scores). F1 is NOT supported by fetchScoreboardsForTab --
//   forcing a 20-driver grid through a two-competitor GameCard would mean
//   either silently returning nothing or inventing a fake pairing, both
//   of which are exactly the "looks done but isn't" failure mode this
//   project's own audit has been finding and fixing everywhere else.
//   Flagging this explicitly rather than shipping a quietly-broken F1 tab.

export type EspnGameStatus =
  | "SCHEDULED"
  | "LIVE"
  | "FINAL"
  | "POSTPONED"
  | "CANCELED";

export type EspnTeam = {
  name: string;
  abbreviation: string;
  logo?: string;
  /** ESPN's own numeric team id -- only populated by fetchEspnEvent, for
   * building a stable Team.key when materializing into Prisma. The
   * scoreboard endpoint's mappers don't need it and leave it undefined. */
  externalId?: string;
};

export type EspnGame = {
  id: string;
  tab: SportTab;
  leagueLabel: string;
  homeTeam: EspnTeam;
  awayTeam: EspnTeam;
  /** Null for UFC (fights resolve to a winner, not a numeric score). */
  homeScore: number | null;
  awayScore: number | null;
  status: EspnGameStatus;
  statusDetail: string;
  scheduledAt: string;
  venue?: string;
  broadcast?: string;
};

// F1 is deliberately NOT a clickable tab (see file header): it's excluded
// from LEAGUES because it has no home/away pairing, so a tab that existed
// here would always render the generic "No games today" empty state --
// indistinguishable from a real quiet day, i.e. a permanently-dead tab
// dressed up as a live one. Confirmed via production audit.
export const SPORT_TABS = [
  "ALL",
  "NBA",
  "NFL",
  "MLB",
  "NHL",
  "MLS",
  "WNBA",
  "NCAA",
  "UFC",
  "Soccer",
] as const;
export type SportTab = (typeof SPORT_TABS)[number] | "F1";

export type LeagueConfig = {
  key: string;
  tab: Exclude<SportTab, "ALL" | "F1">;
  label: string;
  espnSport: string;
  espnLeague: string;
  kind: "team" | "fighter";
};

export const LEAGUES: LeagueConfig[] = [
  { key: "nba", tab: "NBA", label: "NBA", espnSport: "basketball", espnLeague: "nba", kind: "team" },
  { key: "nfl", tab: "NFL", label: "NFL", espnSport: "football", espnLeague: "nfl", kind: "team" },
  { key: "mlb", tab: "MLB", label: "MLB", espnSport: "baseball", espnLeague: "mlb", kind: "team" },
  { key: "nhl", tab: "NHL", label: "NHL", espnSport: "hockey", espnLeague: "nhl", kind: "team" },
  { key: "mls", tab: "MLS", label: "MLS", espnSport: "soccer", espnLeague: "usa.1", kind: "team" },
  { key: "wnba", tab: "WNBA", label: "WNBA", espnSport: "basketball", espnLeague: "wnba", kind: "team" },
  {
    key: "cfb",
    tab: "NCAA",
    label: "NCAAF",
    espnSport: "football",
    espnLeague: "college-football",
    kind: "team",
  },
  {
    key: "cbb",
    tab: "NCAA",
    label: "NCAAB",
    espnSport: "basketball",
    espnLeague: "mens-college-basketball",
    kind: "team",
  },
  { key: "ufc", tab: "UFC", label: "UFC", espnSport: "mma", espnLeague: "ufc", kind: "fighter" },
  { key: "epl", tab: "Soccer", label: "EPL", espnSport: "soccer", espnLeague: "eng.1", kind: "team" },
  {
    key: "laliga",
    tab: "Soccer",
    label: "La Liga",
    espnSport: "soccer",
    espnLeague: "esp.1",
    kind: "team",
  },
];

type EspnAthlete = {
  displayName?: string;
  shortName?: string;
  headshot?: { href?: string };
  flag?: { href?: string };
};
type EspnCompetitor = {
  order?: number;
  homeAway?: "home" | "away";
  winner?: boolean;
  score?: string;
  team?: {
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    logo?: string;
  };
  athlete?: EspnAthlete;
};
type EspnBroadcast = { market?: string; names?: string[] };
type EspnVenue = { fullName?: string; address?: { city?: string; state?: string } };
type EspnStatus = {
  type?: {
    state?: string;
    name?: string;
    description?: string;
    shortDetail?: string;
    completed?: boolean;
  };
};
type EspnCompetition = {
  competitors?: EspnCompetitor[];
  status?: EspnStatus;
  venue?: EspnVenue;
  broadcast?: string;
  broadcasts?: EspnBroadcast[];
};
type EspnEvent = {
  id?: string;
  date?: string;
  status?: EspnStatus;
  competitions?: EspnCompetition[];
};

function mapStatus(status: EspnStatus | undefined): EspnGameStatus {
  const name = status?.type?.name;
  if (name === "STATUS_POSTPONED") return "POSTPONED";
  if (name === "STATUS_CANCELED") return "CANCELED";
  const state = status?.type?.state;
  if (state === "in") return "LIVE";
  if (state === "post") return "FINAL";
  return "SCHEDULED";
}

function broadcastLabel(competition: EspnCompetition | undefined): string | undefined {
  return competition?.broadcast || competition?.broadcasts?.[0]?.names?.[0] || undefined;
}

function venueLabel(venue: EspnVenue | undefined): string | undefined {
  if (!venue?.fullName) return undefined;
  const city = venue.address?.city;
  return city ? `${venue.fullName}, ${city}` : venue.fullName;
}

function scoreOf(competitor?: EspnCompetitor): number | null {
  const value = competitor?.score !== undefined ? Number(competitor.score) : NaN;
  return Number.isFinite(value) ? value : null;
}

function mapTeamEvent(event: EspnEvent, league: LeagueConfig): EspnGame | null {
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  if (!event.id || !event.date || !home?.team || !away?.team) return null;
  const status = competition?.status ?? event.status;
  return {
    id: `espn-${league.key}-${event.id}`,
    tab: league.tab,
    leagueLabel: league.label,
    homeTeam: {
      name: home.team.displayName ?? home.team.shortDisplayName ?? "Home",
      abbreviation: home.team.abbreviation ?? "",
      logo: home.team.logo,
    },
    awayTeam: {
      name: away.team.displayName ?? away.team.shortDisplayName ?? "Away",
      abbreviation: away.team.abbreviation ?? "",
      logo: away.team.logo,
    },
    homeScore: scoreOf(home),
    awayScore: scoreOf(away),
    status: mapStatus(status),
    statusDetail: status?.type?.shortDetail ?? status?.type?.description ?? "",
    scheduledAt: event.date,
    venue: venueLabel(competition?.venue),
    broadcast: broadcastLabel(competition),
  };
}

/** UFC: 2 `athlete` competitors ordered 1/2, no numeric score -- a fight
 * resolves to a winner boolean once FINAL, never to a score. */
function mapFighterEvent(event: EspnEvent, league: LeagueConfig): EspnGame | null {
  const competition = event.competitions?.[0];
  const competitors = [...(competition?.competitors ?? [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
  const [first, second] = competitors;
  if (!event.id || !event.date || !first?.athlete || !second?.athlete) return null;
  const status = competition?.status ?? event.status;
  const mappedStatus = mapStatus(status);
  const winnerName =
    mappedStatus === "FINAL"
      ? first.winner
        ? first.athlete.displayName
        : second.winner
          ? second.athlete.displayName
          : undefined
      : undefined;
  return {
    id: `espn-${league.key}-${event.id}`,
    tab: league.tab,
    leagueLabel: league.label,
    homeTeam: {
      name: first.athlete.displayName ?? first.athlete.shortName ?? "Fighter",
      abbreviation: "",
      logo: first.athlete.headshot?.href ?? first.athlete.flag?.href,
    },
    awayTeam: {
      name: second.athlete.displayName ?? second.athlete.shortName ?? "Fighter",
      abbreviation: "",
      logo: second.athlete.headshot?.href ?? second.athlete.flag?.href,
    },
    homeScore: null,
    awayScore: null,
    status: mappedStatus,
    statusDetail: winnerName
      ? `Final — ${winnerName} won`
      : (status?.type?.shortDetail ?? status?.type?.description ?? ""),
    scheduledAt: event.date,
    venue: venueLabel(competition?.venue),
    broadcast: broadcastLabel(competition),
  };
}

/** dateParam is "YYYY-MM-DD"; ESPN's `dates` query param wants "YYYYMMDD". */
async function fetchLeagueScoreboard(
  league: LeagueConfig,
  dateParam?: string,
): Promise<EspnGame[]> {
  const url = new URL(
    `https://site.api.espn.com/apis/site/v2/sports/${league.espnSport}/${league.espnLeague}/scoreboard`,
  );
  if (dateParam) url.searchParams.set("dates", dateParam.replaceAll("-", ""));
  try {
    const response = await fetch(url, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { events?: EspnEvent[] };
    const mapper = league.kind === "fighter" ? mapFighterEvent : mapTeamEvent;
    return (data.events ?? [])
      .map((event) => mapper(event, league))
      .filter((game): game is EspnGame => game !== null);
  } catch (error) {
    console.error(
      `[espn] ${league.key} scoreboard fetch failed:`,
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

/**
 * Fetch every league under a tab ("ALL" fetches every supported league).
 * The "F1" tab is intentionally excluded from LEAGUES (see file header) --
 * requesting it returns an empty array, not an error.
 * Never throws -- a single league's failure just yields fewer games.
 */
export async function fetchScoreboardsForTab(
  tab: SportTab,
  dateParam?: string,
): Promise<EspnGame[]> {
  const leagues = tab === "ALL" ? LEAGUES : LEAGUES.filter((l) => l.tab === tab);
  const results = await Promise.allSettled(
    leagues.map((league) => fetchLeagueScoreboard(league, dateParam)),
  );
  return results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
}

/** Parses a card's `espn-<leagueKey>-<eventId>` id back into its parts, for
 * routing a click into the single-event materialization flow. Only matches
 * team-sport leagues -- fighter-sport events (UFC) have no home/away
 * pairing to materialize into a Game row, so this returns null for them
 * and the card renders with no link at all, same as an F1 card. */
export function parseEspnGameId(
  id: string,
): { leagueKey: string; eventId: string } | null {
  const match = /^espn-([a-z]+)-(.+)$/.exec(id);
  if (!match) return null;
  const [, leagueKey, eventId] = match;
  if (!LEAGUES.some((l) => l.key === leagueKey && l.kind === "team")) return null;
  return { leagueKey: leagueKey!, eventId: eventId! };
}

type EspnSummaryTeam = {
  id?: string;
  displayName?: string;
  shortDisplayName?: string;
  abbreviation?: string;
  logos?: { href?: string }[];
};
type EspnSummaryCompetitor = {
  homeAway?: "home" | "away";
  score?: string;
  team?: EspnSummaryTeam;
};

/**
 * Single-event lookup (`.../summary?event=<id>`), confirmed against a real
 * response -- distinct shape from the scoreboard endpoint: team logos live
 * under `logos[]` (an array of sized variants), not a single `logo` string,
 * and `competitor.score` is frequently absent entirely (not just "0") for
 * games that haven't started. Team-sport leagues only; UFC fights have no
 * home/away pairing on this endpoint either, so materialization is scoped
 * to team sports (see LEAGUES `kind` and the Game Room resolver route).
 */
export async function fetchEspnEvent(
  leagueKey: string,
  eventId: string,
): Promise<EspnGame | null> {
  const league = LEAGUES.find((l) => l.key === leagueKey && l.kind === "team");
  if (!league) return null;
  try {
    const url = new URL(
      `https://site.api.espn.com/apis/site/v2/sports/${league.espnSport}/${league.espnLeague}/summary`,
    );
    url.searchParams.set("event", eventId);
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      header?: {
        id?: string;
        competitions?: {
          date?: string;
          competitors?: EspnSummaryCompetitor[];
          status?: EspnStatus;
        }[];
      };
      gameInfo?: { venue?: EspnVenue };
      broadcasts?: EspnBroadcast[];
    };
    const competition = data.header?.competitions?.[0];
    const competitors = competition?.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    if (!data.header?.id || !competition?.date || !home?.team || !away?.team)
      return null;
    return {
      id: `espn-${league.key}-${data.header.id}`,
      tab: league.tab,
      leagueLabel: league.label,
      homeTeam: {
        name: home.team.displayName ?? home.team.shortDisplayName ?? "Home",
        abbreviation: home.team.abbreviation ?? "",
        logo: home.team.logos?.[0]?.href,
        externalId: home.team.id,
      },
      awayTeam: {
        name: away.team.displayName ?? away.team.shortDisplayName ?? "Away",
        abbreviation: away.team.abbreviation ?? "",
        logo: away.team.logos?.[0]?.href,
        externalId: away.team.id,
      },
      homeScore: scoreOf(home),
      awayScore: scoreOf(away),
      status: mapStatus(competition.status),
      statusDetail:
        competition.status?.type?.shortDetail ??
        competition.status?.type?.description ??
        "",
      scheduledAt: competition.date,
      venue: venueLabel(data.gameInfo?.venue),
      broadcast: data.broadcasts?.[0]?.names?.[0],
    };
  } catch (error) {
    console.error(
      `[espn] single-event fetch failed for ${leagueKey}/${eventId}:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

const STATUS_WEIGHT: Record<EspnGameStatus, number> = {
  LIVE: 0,
  SCHEDULED: 1,
  FINAL: 2,
  POSTPONED: 3,
  CANCELED: 4,
};

export function sortByLiveFirst(games: EspnGame[]) {
  return [...games].sort((a, b) => {
    const statusDelta = STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status];
    if (statusDelta !== 0) return statusDelta;
    return (
      new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );
  });
}
