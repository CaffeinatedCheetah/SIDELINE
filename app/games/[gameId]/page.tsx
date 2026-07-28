import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { PredictionForm } from "@/components/actions/prediction-form";
import { TakeComposer } from "@/components/actions/take-composer";
import { LiveGameRoom } from "@/components/games/live-game-room";
import { PageHeading } from "@/components/layout/page-heading";
import { PollVoteCard } from "@/components/games/poll-vote-card";
import { TakeCard } from "@/components/takes/take-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/foundations";
import { db } from "@/lib/db/client";
import { fetchEspnEvent } from "@/lib/sports/espn";

export const dynamic = "force-dynamic";

const getGame = cache(async (gameId: string) =>
  db.game.findUnique({
    where: { id: gameId },
    include: {
      league: true,
      homeTeam: true,
      awayTeam: true,
      takes: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        include: {
          // Explicit select, not `author: true` -- the live DB is missing
          // a column (isOfficial) that exists in the Prisma schema but was
          // never migrated onto production. `include: true` does a
          // SELECT * on User and crashes; this only pulls the fields
          // TakeCard actually renders.
          author: { select: { handle: true, displayName: true, image: true } },
          _count: { select: { reactions: true, replies: true } },
        },
      },
      polls: {
        include: {
          options: {
            orderBy: { displayOrder: "asc" },
            include: { _count: { select: { votes: true } } },
          },
        },
      },
    },
  }),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gameId: string }>;
}): Promise<Metadata> {
  const { gameId } = await params;
  const game = await getGame(gameId);
  if (!game) return { title: "Game not found" };
  return {
    title: `${game.awayTeam.name} at ${game.homeTeam.name}`,
    description: `${game.league.abbreviation} · ${game.status}`,
  };
}

// Games materialized from ESPN (see lib/sports/espn-materialize.ts) have no
// ongoing sync into the DB after their first click -- the row would freeze
// at whatever score/status existed at materialization time otherwise. On
// each real page load, re-fetch live ESPN data and persist it, so every
// visit refreshes the stored row and LiveGameRoom's existing 15s polling
// (which reads that row) benefits too. Never blocks rendering on this: a
// failed refetch just means this load shows the last-known values, same as
// every other "always have a fallback" data path in this app.
async function refreshFromEspnIfMaterialized(
  game: NonNullable<Awaited<ReturnType<typeof getGame>>>,
) {
  if (!game.providerRef?.startsWith("espn-")) return game;
  const match = /^espn-([a-z]+)-(.+)$/.exec(game.providerRef);
  if (!match) return game;
  const [, leagueKey, eventId] = match;
  const fresh = await fetchEspnEvent(leagueKey!, eventId!);
  if (!fresh) return game;
  const updated = await db.game.update({
    where: { id: game.id },
    data: {
      status: fresh.status,
      homeScore: fresh.homeScore,
      awayScore: fresh.awayScore,
      startedAt:
        fresh.status === "LIVE" && !game.startedAt ? new Date() : undefined,
    },
  });
  return { ...game, ...updated };
}

export default async function GameRoom({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const [session, rawGame] = await Promise.all([auth(), getGame(gameId)]);
  if (!rawGame) notFound();
  const game = await refreshFromEspnIfMaterialized(rawGame);

  const myPollVotes = session?.user?.id
    ? await db.pollVote.findMany({
        where: {
          userId: session.user.id,
          pollId: { in: game.polls.map((poll) => poll.id) },
        },
        select: { pollId: true, pollOptionId: true },
      })
    : [];
  const votedOptionByPoll = new Map(
    myPollVotes.map((vote) => [vote.pollId, vote.pollOptionId]),
  );

  return (
    <div className="page-container py-10">
      <PageHeading
        eyebrow={`${game.league.abbreviation} · ${game.status}`}
        title={`${game.awayTeam.name} at ${game.homeTeam.name}`}
        description={
          game.status === "LIVE"
            ? undefined
            : game.status === "FINAL"
              ? `Final: ${game.awayScore ?? 0}–${game.homeScore ?? 0}`
              : game.scheduledAt.toLocaleString()
        }
      />
      <LiveGameRoom
        gameId={game.id}
        initialStatus={game.status}
        initialHomeScore={game.homeScore}
        initialAwayScore={game.awayScore}
        initialPeriod={game.period}
        initialClock={game.clock}
      />
      <Tabs defaultValue="takes">
        <TabsList>
          {["takes", "polls", "predictions"].map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {tab.replaceAll("-", " ")}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="takes">
          <div className="mt-5 grid gap-4">
            <TakeComposer gameId={game.id} />
            {game.takes.length ? (
              game.takes.map((take) => (
                <TakeCard
                  key={take.id}
                  id={take.id}
                  author={{
                    handle: take.author.handle,
                    displayName: take.author.displayName,
                    avatarUrl: take.author.image,
                  }}
                  body={take.body}
                  createdAt={take.createdAt.toLocaleTimeString()}
                  reactions={take._count.reactions}
                  replies={take._count.replies}
                />
              ))
            ) : (
              <EmptyState
                title="Start the conversation"
                description="Sign in to post the first game take."
              />
            )}
          </div>
        </TabsContent>
        <TabsContent value="polls">
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {game.polls.length ? (
              game.polls.map((poll) => (
                <PollVoteCard
                  key={poll.id}
                  pollId={poll.id}
                  question={poll.question}
                  options={poll.options.map((option) => ({
                    id: option.id,
                    label: option.label,
                    votes: option._count.votes,
                  }))}
                  initialSelected={votedOptionByPoll.get(poll.id)}
                  closed={Boolean(poll.closesAt && poll.closesAt <= new Date())}
                />
              ))
            ) : (
              <EmptyState
                title="No polls for this game"
                description="Check back once a poll opens."
              />
            )}
          </div>
        </TabsContent>
        <TabsContent value="predictions">
          <div className="mt-5 max-w-lg">
            <PredictionForm
              gameId={game.id}
              homeTeam={game.homeTeam.name}
              awayTeam={game.awayTeam.name}
              locked={
                game.status !== "SCHEDULED" || new Date() >= game.scheduledAt
              }
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
