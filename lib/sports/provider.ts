import type { GameStatus } from "@prisma/client";

export type ProviderTeam = {
  externalId: string;
  key: string;
  name: string;
  abbreviation: string;
  city?: string;
};

export type ProviderGame = {
  externalId: string;
  homeTeam: ProviderTeam;
  awayTeam: ProviderTeam;
  scheduledAt: Date;
  status: GameStatus;
  homeScore: number | null;
  awayScore: number | null;
  period: string | null;
  clock: string | null;
};

/**
 * A sport a provider can supply games for. Maps 1:1 to a `League.key` in the
 * schema, not a `Sport.key` -- a provider might support one league (NBA) or
 * several under the same account (NFL, MLB), each fetched independently.
 */
export type ProviderLeague = "nba" | "nfl";

export interface SportsProvider {
  readonly name: string;
  /** True if this provider is actually usable right now (has credentials configured). */
  isConfigured(): boolean;
  /**
   * Fetch today's games (provider's local sense of "today") for the given
   * league. Returns an empty array if the provider doesn't support that
   * league or has none scheduled -- never throws for "no games," only for
   * real request failures (network, auth, rate limit).
   */
  fetchTodaysGames(league: ProviderLeague): Promise<ProviderGame[]>;
}
