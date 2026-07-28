export type ContestState =
  | "scheduled"
  | "pregame"
  | "in_progress"
  | "halftime"
  | "delayed"
  | "postponed"
  | "suspended"
  | "cancelled"
  | "final";

export interface Participant {
  providerId: string;
  name: string;
  abbreviation: string;
  logoUrl?: string;
}

export interface Contest {
  id: string;
  provider: string;
  providerGameId: string;
  providerUpdatedAt: string;
  league: {
    key: string;
    name: string;
    abbreviation: string;
    sportKey: string;
    sportName: string;
  };
  season?: string;
  competitionDate: string;
  scheduledAtUtc: string;
  homeParticipant: Participant;
  awayParticipant: Participant;
  homeScore?: number;
  awayScore?: number;
  state: ContestState;
  period?: string;
  clock?: string;
  detail?: string;
  venue?: string;
  broadcast?: string;
  versions: {
    payload: string;
    schema: string;
    adapter: string;
  };
}

export interface SportsScheduleResult {
  contests: Contest[];
  fetchedAt: string;
  stale: boolean;
  source: "provider" | "last_good" | "database";
  error?: "provider_unavailable" | "invalid_response";
}
