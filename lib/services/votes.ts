export function assertVoteAllowed(input: {
  userId?: string;
  debateStatus: "OPEN" | "LOCKED" | "DRAFT" | "ARCHIVED";
  optionBelongsToDebate: boolean;
  alreadyVoted: boolean;
}) {
  if (!input.userId) throw new Error("AUTH_REQUIRED");
  if (input.debateStatus !== "OPEN") throw new Error("DEBATE_NOT_OPEN");
  if (!input.optionBelongsToDebate) throw new Error("INVALID_OPTION");
  if (input.alreadyVoted) throw new Error("DUPLICATE_VOTE");
}
