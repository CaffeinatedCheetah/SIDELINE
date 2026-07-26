import { GameStatus } from "@prisma/client";
import type {
  ProviderGame,
  ProviderLeague,
  ProviderTeam,
  SportsProvider,
} from "@/lib/sports/provider";

const BASE_URL = "https://api.balldontlie.io";

const LEAGUE_PATHS: Record<ProviderLeague, string> = {
  nba: "/v1/games",
  nfl: "/nfl/v1/games",
};

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function deriveStatus(
  status: string,
  period: number | null,
  postponed: boolean,
): GameStatus {
  if (postponed) return GameStatus.POSTPONED;
  if (status === "Final") return GameStatus.FINAL;
  if (period && period > 0) return GameStatus.LIVE;
  return GameStatus.SCHEDULED;
}

type BallDontLieTeam = {
  id: number;
  abbreviation: string;
  name: string;
  city?: string;
  location?: string;
};

type BallDontLieNbaGame = {
  id: number;
  date: string;
  datetime: string;
  status: string;
  period: number;
  time: string | null;
  postponed?: boolean;
  home_team_score: number | null;
  visitor_team_score: number | null;
  home_team: BallDontLieTeam;
  visitor_team: BallDontLieTeam;
};

type BallDontLieNflGame = {
  id: number;
  date: string;
  status: string;
  postponed?: boolean;
  home_team_score: number | null;
  visitor_team_score: number | null;
  home_team: BallDontLieTeam;
  visitor_team: BallDontLieTeam;
};

function toProviderTeam(team: BallDontLieTeam): ProviderTeam {
  return {
    externalId: String(team.id),
    key: team.abbreviation.toLowerCase(),
    name: team.name,
    abbreviation: team.abbreviation,
    city: team.city ?? team.location,
  };
}

export class BallDontLieProvider implements SportsProvider {
  readonly name = "balldontlie";

  isConfigured(): boolean {
    return Boolean(process.env.BALLDONTLIE_KEY);
  }

  async fetchTodaysGames(league: ProviderLeague): Promise<ProviderGame[]> {
    const apiKey = process.env.BALLDONTLIE_KEY;
    if (!apiKey) return [];

    const url = new URL(BASE_URL + LEAGUE_PATHS[league]);
    url.searchParams.append("dates[]", todayISODate());

    const response = await fetch(url, {
      headers: { Authorization: apiKey },
      // Games change during this session; never serve a stale fetch cache.
      cache: "no-store",
    });

    if (response.status === 401 || response.status === 403) {
      // balldontlie licenses NBA/NFL/etc separately, so a 401 on one league
      // under an otherwise-valid key is expected and should not block the
      // others. Still log it loudly -- silently returning [] here is
      // indistinguishable from "genuinely no games today" and would hide a
      // fully invalid/expired key exactly the way this was almost shipped.
      console.error(
        `[BallDontLieProvider] ${league} request unauthorized (${response.status}) -- ` +
          "check BALLDONTLIE_KEY is valid and licensed for this league.",
      );
      return [];
    }
    if (!response.ok) {
      throw new Error(
        `balldontlie ${league} request failed: ${response.status} ${response.statusText}`,
      );
    }

    const body = (await response.json()) as {
      data: (BallDontLieNbaGame | BallDontLieNflGame)[];
    };

    return body.data.map((game) => {
      const period = "period" in game ? game.period : null;
      return {
        externalId: `balldontlie-${league}-${game.id}`,
        homeTeam: toProviderTeam(game.home_team),
        awayTeam: toProviderTeam(game.visitor_team),
        scheduledAt: new Date("datetime" in game ? game.datetime : game.date),
        status: deriveStatus(game.status, period, Boolean(game.postponed)),
        homeScore: game.home_team_score,
        awayScore: game.visitor_team_score,
        period: period && period > 0 ? String(period) : null,
        clock: "time" in game ? game.time : null,
      };
    });
  }
}
