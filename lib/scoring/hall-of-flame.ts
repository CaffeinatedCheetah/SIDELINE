export interface HallCandidate {
  id: string;
  quality: number;
  conversation: number;
  trust: number;
  reports: number;
  isActive: boolean;
}

export function hallScore(candidate: HallCandidate) {
  if (!candidate.isActive || candidate.reports > 2) return null;
  const quality = Math.max(0, Math.min(1, candidate.quality));
  const conversation = Math.max(0, Math.min(1, candidate.conversation));
  const trust = Math.max(0, Math.min(1, candidate.trust));
  return Number(
    ((quality * 0.5 + conversation * 0.3 + trust * 0.2) * 100).toFixed(4),
  );
}

export function rankHallCandidates(candidates: readonly HallCandidate[]) {
  return candidates
    .map((candidate) => ({ candidate, score: hallScore(candidate) }))
    .filter(
      (entry): entry is { candidate: HallCandidate; score: number } =>
        entry.score !== null,
    )
    .sort(
      (a, b) =>
        b.score - a.score || a.candidate.id.localeCompare(b.candidate.id),
    )
    .map((entry, index) => ({
      id: entry.candidate.id,
      rank: index + 1,
      score: entry.score,
    }));
}
