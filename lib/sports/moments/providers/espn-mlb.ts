import type {
  CanonicalGameMoment,
  GameMomentType,
  MomentMetadata,
} from "@/lib/sports/moments/types";

type EspnMlbPlay = {
  id?: string;
  text?: string;
  shortText?: string;
  wallclock?: string;
  modified?: string;
  scoringPlay?: boolean;
  homeScore?: number | string;
  awayScore?: number | string;
  type?: { id?: string; text?: string; abbreviation?: string };
  period?: { number?: number; displayValue?: string };
  clock?: { displayValue?: string };
};

export type EspnMlbPlayByPlay = {
  header?: { id?: string };
  plays?: EspnMlbPlay[];
};

function score(value: number | string | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function safeOccurredAt(play: EspnMlbPlay) {
  const value = play.wallclock ?? play.modified;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function textOf(play: EspnMlbPlay) {
  return [play.type?.text, play.type?.abbreviation, play.shortText, play.text]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function basicType(play: EspnMlbPlay): GameMomentType | null {
  const text = textOf(play);
  if (text.includes("eject")) return "EJECTION";
  if (
    text.includes("game final") ||
    text.includes("game end") ||
    text.includes("status final")
  )
    return "GAME_END";
  if (text.includes("game start") || text.includes("first pitch"))
    return "GAME_START";
  if (
    text.includes("end inning") ||
    text.includes("end of inning") ||
    text.includes("end of the inning") ||
    text.includes("end of top") ||
    text.includes("end of bottom")
  )
    return "PERIOD_END";
  if (play.scoringPlay === true) return "SCORE";
  return null;
}

function titleOf(play: EspnMlbPlay) {
  const title = (play.shortText ?? play.text ?? play.type?.text ?? "").trim();
  return title ? title.slice(0, 240) : null;
}

export function normalizeEspnMlbPlays(
  payload: EspnMlbPlayByPlay,
  {
    gameProviderRef,
  }: {
    gameProviderRef?: string;
  } = {},
): CanonicalGameMoment[] {
  const eventId = payload.header?.id;
  const canonicalGameRef =
    gameProviderRef ?? (eventId ? `espn:mlb:${eventId}` : undefined);
  if (!eventId || !canonicalGameRef) return [];

  let previousHomeScore = 0;
  let previousAwayScore = 0;
  const moments: CanonicalGameMoment[] = [];
  for (const play of payload.plays ?? []) {
    const occurredAt = safeOccurredAt(play);
    const title = titleOf(play);
    let type = basicType(play);
    if (!play.id || !occurredAt || !title || !type) continue;

    const homeScore = score(play.homeScore);
    const awayScore = score(play.awayScore);
    const metadata: MomentMetadata = {
      rawProviderRef: play.id,
      classifications: [type],
    };
    let importance =
      type === "GAME_END"
        ? 100
        : type === "EJECTION"
          ? 85
          : type === "SCORE"
            ? 70
            : type === "GAME_START"
              ? 50
              : 35;

    if (
      type === "SCORE" &&
      homeScore !== undefined &&
      awayScore !== undefined
    ) {
      const previousLeader = Math.sign(previousHomeScore - previousAwayScore);
      const currentLeader = Math.sign(homeScore - awayScore);
      const classifications = ["SCORE"];
      if (textOf(play).includes("home run")) classifications.push("HOME_RUN");
      if (currentLeader === 0 && previousLeader !== 0) {
        type = "TIE";
        classifications.push("TIE");
        importance = 85;
      } else if (
        currentLeader !== 0 &&
        previousLeader !== 0 &&
        currentLeader !== previousLeader
      ) {
        type = "LEAD_CHANGE";
        classifications.push("LEAD_CHANGE");
        importance = 90;
      }
      metadata.classifications = classifications;
    }

    moments.push({
      provider: "espn",
      providerRef: `${eventId}:${play.id}`,
      gameProviderRef: canonicalGameRef,
      type,
      title,
      description:
        play.text && play.text.trim() !== title ? play.text.trim() : undefined,
      occurredAt,
      period:
        play.period?.displayValue ??
        (play.period?.number ? String(play.period.number) : undefined),
      clock: play.clock?.displayValue,
      homeScore,
      awayScore,
      importance,
      metadata,
    });

    if (homeScore !== undefined) previousHomeScore = homeScore;
    if (awayScore !== undefined) previousAwayScore = awayScore;
  }
  return moments;
}
