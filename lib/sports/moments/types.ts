export type GameMomentType =
  | "SCORE"
  | "LEAD_CHANGE"
  | "TIE"
  | "TURNOVER"
  | "PENALTY"
  | "EJECTION"
  | "PERIOD_END"
  | "GAME_START"
  | "GAME_END"
  | "OTHER";

export type MomentMetadata = Record<
  string,
  string | number | boolean | null | string[]
>;

export type CanonicalGameMoment = {
  provider: string;
  providerRef: string;
  gameProviderRef: string;
  type: GameMomentType;
  title: string;
  description?: string;
  occurredAt: Date;
  period?: string;
  clock?: string;
  homeScore?: number;
  awayScore?: number;
  importance: number;
  metadata?: MomentMetadata;
};

export function shouldCreateFlashThread(moment: CanonicalGameMoment) {
  return (
    moment.type === "SCORE" ||
    moment.type === "LEAD_CHANGE" ||
    moment.type === "TIE" ||
    moment.type === "EJECTION" ||
    moment.type === "GAME_END" ||
    moment.importance >= 70
  );
}
