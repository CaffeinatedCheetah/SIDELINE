import type { Contest, ContestState, Participant } from "@/lib/sports/types";
import type { SupportedLeague } from "@/lib/sports/leagues";

interface EspnCompetitor {
  homeAway?: string;
  score?: string;
  team?: {
    id?: string;
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    logo?: string;
  };
}

interface EspnEvent {
  id?: string;
  date?: string;
  season?: { year?: number; slug?: string };
  competitions?: Array<{
    date?: string;
    competitors?: EspnCompetitor[];
    status?: {
      type?: {
        name?: string;
        state?: string;
        detail?: string;
        shortDetail?: string;
        completed?: boolean;
      };
      period?: number;
      displayClock?: string;
    };
    venue?: { fullName?: string };
    broadcasts?: Array<{ names?: string[] }>;
  }>;
}

export const ESPN_ADAPTER_VERSION = "1.0.0";
export const SPORTS_SCHEMA_VERSION = "1.0.0";
const ESPN_PAYLOAD_VERSION = "site-v2-scoreboard";

export function normalizeEspnStatus(input: {
  name?: string;
  state?: string;
  detail?: string;
  completed?: boolean;
}): ContestState {
  const value = `${input.name ?? ""} ${input.state ?? ""} ${input.detail ?? ""}`
    .toLowerCase()
    .replaceAll("_", " ");
  if (input.completed || value.includes("final") || input.state === "post")
    return "final";
  if (value.includes("cancel")) return "cancelled";
  if (value.includes("postpon")) return "postponed";
  if (value.includes("suspend")) return "suspended";
  if (value.includes("delay")) return "delayed";
  if (value.includes("halftime") || value.includes("half time"))
    return "halftime";
  if (input.state === "in" || value.includes("progress")) return "in_progress";
  if (value.includes("pregame") || value.includes("pre game")) return "pregame";
  return "scheduled";
}

function normalizeParticipant(
  competitor: EspnCompetitor,
  fallbackId: string,
): Participant {
  const team = competitor.team ?? {};
  return {
    providerId: team.id ?? fallbackId,
    name:
      team.displayName ??
      team.shortDisplayName ??
      team.abbreviation ??
      "Unknown team",
    abbreviation: team.abbreviation ?? team.shortDisplayName ?? "TBD",
    logoUrl: team.logo,
  };
}

function score(value: string | undefined, state: ContestState) {
  if (state === "scheduled" || state === "pregame") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeEspnEvent(
  event: EspnEvent,
  league: SupportedLeague,
  fetchedAt = new Date(),
): Contest | null {
  const competition = event.competitions?.[0];
  const providerGameId = event.id;
  const scheduledAt = competition?.date ?? event.date;
  if (!competition || !providerGameId || !scheduledAt) return null;
  const home = competition.competitors?.find(
    (competitor) => competitor.homeAway === "home",
  );
  const away = competition.competitors?.find(
    (competitor) => competitor.homeAway === "away",
  );
  if (!home || !away) return null;
  const providerStatus = competition.status?.type ?? {};
  const state = normalizeEspnStatus(providerStatus);
  return {
    id: `espn:${league.key}:${providerGameId}`,
    provider: "espn",
    providerGameId,
    providerUpdatedAt: fetchedAt.toISOString(),
    league: {
      key: league.key,
      name: league.name,
      abbreviation: league.abbreviation,
      sportKey: league.sportKey,
      sportName: league.sportName,
    },
    season: event.season?.year?.toString(),
    competitionDate: scheduledAt.slice(0, 10),
    scheduledAtUtc: new Date(scheduledAt).toISOString(),
    homeParticipant: normalizeParticipant(home, `${providerGameId}:home`),
    awayParticipant: normalizeParticipant(away, `${providerGameId}:away`),
    homeScore: score(home.score, state),
    awayScore: score(away.score, state),
    state,
    period: competition.status?.period?.toString(),
    clock: competition.status?.displayClock,
    detail: providerStatus.shortDetail ?? providerStatus.detail,
    venue: competition.venue?.fullName,
    broadcast: competition.broadcasts?.flatMap((item) => item.names ?? [])[0],
    versions: {
      payload: ESPN_PAYLOAD_VERSION,
      schema: SPORTS_SCHEMA_VERSION,
      adapter: ESPN_ADAPTER_VERSION,
    },
  };
}

export async function fetchEspnSchedule(
  league: SupportedLeague,
  { date, fetcher = fetch }: { date?: string; fetcher?: typeof fetch } = {},
) {
  const url = new URL(
    `https://site.api.espn.com/apis/site/v2/sports/${league.providerSport}/${league.providerLeague}/scoreboard`,
  );
  if (date) url.searchParams.set("dates", date.replaceAll("-", ""));
  const response = await fetcher(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`ESPN request failed: ${response.status}`);
  const payload = (await response.json()) as { events?: EspnEvent[] };
  const fetchedAt = new Date();
  return (payload.events ?? [])
    .map((event) => normalizeEspnEvent(event, league, fetchedAt))
    .filter((contest): contest is Contest => Boolean(contest));
}
