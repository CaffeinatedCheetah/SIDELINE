import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { PredictionForm } from "@/components/actions/prediction-form";
import { GameRecapPanel } from "@/components/ai/game-recap-panel";
import { TakeComposer } from "@/components/actions/take-composer";
import { LiveGameRoom } from "@/components/games/live-game-room";
import { GameRoomPhase } from "@/components/games/game-room-phase";
import { GameMomentsPanel } from "@/components/games/game-moments-panel";
import { PageHeading } from "@/components/layout/page-heading";
import { PollVoteCard } from "@/components/games/poll-vote-card";
import { TakeCard } from "@/components/takes/take-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/foundations";
import { LocalDateTime } from "@/components/ui/local-date-time";
import { db } from "@/lib/db/client";
import { getAiConfig } from "@/lib/ai/config";
import { gameRecapSchema } from "@/lib/ai/schemas/game-recap";
import { materializeContest } from "@/lib/sports/materializer";
import { getSportsSchedule } from "@/lib/sports/service";
import { getSupportedLeague } from "@/lib/sports/leagues";
import {
  getGameFlashThreads,
  getGameMoments,
} from "@/lib/sports/moments/read-model";

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
      _count: { select: { follows: true, takes: true } },
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

async function refreshFromProviderIfMaterialized(
  game: NonNullable<Awaited<ReturnType<typeof getGame>>>,
) {
  if (
    !game.providerRef ||
    ["FINAL", "POSTPONED", "CANCELLED"].includes(game.status)
  )
    return game;
  try {
    const schedule = await getSportsSchedule({
      leagueKeys: [game.league.key],
    });
    const contest = schedule.contests.find(
      (candidate) =>
        candidate.id === game.providerRef ||
        game.providerRef?.endsWith(`-${candidate.providerGameId}`),
    );
    if (!contest) return game;
    return { ...game, ...(await materializeContest(contest)) };
  } catch {
    return game;
  }
}

export default async function GameRoom({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const [session, rawGame] = await Promise.all([auth(), getGame(gameId)]);
  if (!rawGame) notFound();
  const game = await refreshFromProviderIfMaterialized(rawGame);
  const sportKey = getSupportedLeague(game.league.key)?.sportKey ?? "";
  const aiConfig = getAiConfig();

  const [myPollVotes, myGameFollow] = session?.user?.id
    ? await Promise.all([
        db.pollVote.findMany({
          where: {
            userId: session.user.id,
            pollId: { in: game.polls.map((poll) => poll.id) },
          },
          select: { pollId: true, pollOptionId: true },
        }),
        db.gameFollow.findUnique({
          where: {
            userId_gameId: { userId: session.user.id, gameId: game.id },
          },
          select: { userId: true },
        }),
      ])
    : [[], null];
  const votedOptionByPoll = new Map(
    myPollVotes.map((vote) => [vote.pollId, vote.pollOptionId]),
  );
  const [moments, flashThreads, recapArtifact] = await Promise.all([
    getGameMoments(game.id),
    getGameFlashThreads(game.id),
    game.status === "FINAL" && aiConfig.gameRecapsEnabled
      ? db.aiArtifact.findFirst({
          where: { type: "GAME_RECAP", entityType: "GAME", entityId: game.id },
          orderBy: [{ generatedAt: "desc" }, { updatedAt: "desc" }],
          include: {
            feedback: session?.user?.id
              ? { where: { userId: session.user.id }, take: 1 }
              : false,
          },
        })
      : null,
  ]);
  const serializedMoments = (moments ?? []).map((moment) => ({
    id: moment.id,
    type: moment.type,
    title: moment.title,
    description: moment.description,
    period: moment.period,
    clock: moment.clock,
    homeScore: moment.homeScore,
    awayScore: moment.awayScore,
    importance: moment.importance,
    occurredAt: moment.occurredAt.toISOString(),
  }));
  const serializedThreads = (flashThreads ?? []).map((thread) => ({
    id: thread.id,
    title: thread.title,
    status: thread.status,
    moment: {
      id: thread.moment.id,
      type: thread.moment.type,
      title: thread.moment.title,
      description: thread.moment.description,
      period: thread.moment.period,
      clock: thread.moment.clock,
      homeScore: thread.moment.homeScore,
      awayScore: thread.moment.awayScore,
      importance: thread.moment.importance,
      occurredAt: thread.moment.occurredAt.toISOString(),
    },
    takes: thread.takes.map((take) => ({
      id: take.id,
      body: take.body,
      createdAt: take.createdAt.toISOString(),
      author: take.author,
      _count: take._count,
    })),
    takeCount: thread.takeCount,
    reactionCount: thread.reactionCount,
    replyCount: thread.replyCount,
  }));

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
              : undefined
        }
      />
      {game.status !== "LIVE" && game.status !== "FINAL" ? (
        <p className="text-text-secondary -mt-6 mb-6 text-sm">
          Starts{" "}
          <LocalDateTime value={game.scheduledAt.toISOString()} calendar />
        </p>
      ) : null}
      <LiveGameRoom
        gameId={game.id}
        league={{
          key: game.league.key,
          abbreviation: game.league.abbreviation,
          sportKey,
        }}
        startsAt={game.scheduledAt.toISOString()}
        homeTeam={{
          name: game.homeTeam.name,
          abbreviation: game.homeTeam.abbreviation,
          logoUrl: game.homeTeam.logoUrl,
          primaryColor: game.homeTeam.primaryColor,
        }}
        awayTeam={{
          name: game.awayTeam.name,
          abbreviation: game.awayTeam.abbreviation,
          logoUrl: game.awayTeam.logoUrl,
          primaryColor: game.awayTeam.primaryColor,
        }}
        venue={game.venue}
        broadcast={
          game.broadcast
            ?.split(",")
            .map((value) => value.trim())
            .filter(Boolean) ?? []
        }
        initialPhase={game.status}
        initialHomeScore={game.homeScore}
        initialAwayScore={game.awayScore}
        initialPeriod={game.period}
        initialClock={game.clock}
        initialDetail={game.statusDetail}
        initialProviderUpdatedAt={game.providerUpdatedAt?.toISOString() ?? null}
        initialVersion={game.version}
        initialFollowerCount={game._count.follows}
        initialFollowing={Boolean(myGameFollow)}
        signedIn={Boolean(session?.user?.id)}
      />
      {game.status === "FINAL" ? (
        <GameRecapPanel
          artifact={
            recapArtifact
              ? {
                  id: recapArtifact.id,
                  status: recapArtifact.status,
                  content:
                    recapArtifact.status === "READY"
                      ? (gameRecapSchema.safeParse(recapArtifact.content)
                          .data ?? null)
                      : null,
                  generatedAt: recapArtifact.generatedAt,
                }
              : aiConfig.gameRecapsEnabled
                ? null
                : {
                    id: "disabled",
                    status: "DISABLED",
                    content: null,
                    generatedAt: null,
                  }
          }
          signedIn={Boolean(session?.user?.id)}
          feedback={
            recapArtifact?.feedback?.[0]?.value as
              | "HELPFUL"
              | "NOT_HELPFUL"
              | undefined
          }
        />
      ) : null}
      <GameRoomPhase phase={game.status} />
      <GameMomentsPanel
        gameId={game.id}
        phase={game.status}
        sportKey={sportKey}
        initialMoments={serializedMoments}
        initialThreads={serializedThreads}
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
                !["SCHEDULED", "PREGAME"].includes(game.status) ||
                new Date() >= game.scheduledAt
              }
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
