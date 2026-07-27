import { notFound, redirect } from "next/navigation";
import { materializeEspnGame } from "@/lib/sports/espn-materialize";

export const dynamic = "force-dynamic";

// Thin resolver: an ESPN-sourced GameCard links here instead of directly to
// /games/[id] (it has no real Prisma id yet). Materializes-or-finds the
// real Game row, then redirects into the normal Game Room -- from that
// point on it's a completely ordinary Prisma-backed game page, same as any
// BallDontLie-synced or seeded one.
export default async function FromEspnGame({
  params,
}: {
  params: Promise<{ leagueKey: string; eventId: string }>;
}) {
  const { leagueKey, eventId } = await params;
  const gameId = await materializeEspnGame(leagueKey, eventId);
  if (!gameId) notFound();
  redirect(`/games/${gameId}`);
}
