import type { GameRecapContext } from "@/lib/ai/retrieval/game-recap";
import type { GameRecap } from "@/lib/ai/schemas/game-recap";

export function validateGroundedGameRecap(
  recap: GameRecap,
  context: NonNullable<GameRecapContext>,
) {
  const errors: string[] = [];
  const momentIds = new Set(context.moments.map((moment) => moment.id));
  for (const moment of recap.keyMoments) {
    if (!momentIds.has(moment.momentId))
      errors.push(`UNKNOWN_MOMENT:${moment.momentId}`);
  }

  const allText = [
    recap.headline,
    recap.dek,
    recap.summary,
    ...recap.keyMoments.flatMap((moment) => [moment.label, moment.description]),
    recap.fanConversation.summary ?? "",
    ...recap.fanConversation.themes,
    ...recap.caveats,
  ].join(" ");
  if (/<\/?[a-z][\s\S]*>/i.test(allText)) errors.push("HTML");

  const { away, home } = context.officialFacts.finalScore;
  if (away !== null && home !== null) {
    const scorePatterns = [
      ...allText.matchAll(/\b(\d{1,3})\s*[-–—]\s*(\d{1,3})\b/g),
    ];
    for (const match of scorePatterns) {
      const left = Number(match[1]);
      const right = Number(match[2]);
      const agrees =
        (left === away && right === home) || (left === home && right === away);
      if (!agrees) errors.push(`CONTRADICTORY_SCORE:${left}-${right}`);
    }
  }

  const hasCommunity =
    context.community.takes.length > 0 ||
    context.community.threads.some((thread) => thread.takes.length > 0) ||
    context.community.debates.length > 0;
  if (
    !hasCommunity &&
    (recap.fanConversation.summary !== null ||
      recap.fanConversation.themes.length > 0)
  )
    errors.push("UNSUPPORTED_FAN_CONVERSATION");

  return { valid: errors.length === 0, errors };
}
