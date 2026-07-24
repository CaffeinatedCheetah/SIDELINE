export function isPredictionLocked(locksAt: Date, now = new Date()) {
  return now.getTime() >= locksAt.getTime();
}

export function assertPredictionOpen(input: {
  locksAt: Date;
  gameStatus: string;
  now?: Date;
}) {
  if (
    input.gameStatus !== "SCHEDULED" ||
    isPredictionLocked(input.locksAt, input.now)
  )
    throw new Error("PREDICTION_LOCKED");
}
