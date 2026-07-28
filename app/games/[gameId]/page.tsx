import { notFound } from "next/navigation";
import { PredictionForm } from "@/components/actions/prediction-form";
import { TakeComposer } from "@/components/actions/take-composer";
import { LiveGameRoom } from "@/components/games/live-game-room";
import { PageHeading } from "@/components/layout/page-heading";
import { PollCard } from "@/components/games/poll-card";
import { TakeCard } from "@/components/takes/take-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/foundations";
import { LocalDateTime } from "@/components/ui/local-date-time";
import { db } from "@/lib/db/client";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function GameRoom({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const session = await auth();
  const [game, preferences] = await Promise.all([
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
            author: true,
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
    session?.user?.id
      ? db.userPreference.findUnique({
          where: { userId: session.user.id },
          select: { reducedData: true },
        })
      : null,
  ]);
  if (!game) notFound();
  return (
    <div className="page-container py-10">
      <PageHeading
        eyebrow={`${game.league.abbreviation} · ${game.status}`}
        title={`${game.awayTeam.name} at ${game.homeTeam.name}`}
        description={
          game.status === "LIVE"
            ? `${game.awayScore ?? 0}–${game.homeScore ?? 0} · ${game.period ?? "Live"} ${game.clock ?? ""}`
            : "Game details and fan conversation."
        }
      />
      {game.status !== "LIVE" && (
        <p className="text-text-secondary -mt-6 mb-6 text-sm">
          Starts{" "}
          <LocalDateTime value={game.scheduledAt.toISOString()} calendar />
        </p>
      )}
      <LiveGameRoom
        gameId={game.id}
        initialStatus={game.status}
        reducedData={preferences?.reducedData}
      />
      <Tabs defaultValue="takes">
        <TabsList>
          {[
            "chat",
            "takes",
            "polls",
            "predictions",
            "stats",
            "play-by-play",
            "highlights",
          ].map((tab) => (
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
                  createdAt=""
                  createdAtIso={take.createdAt.toISOString()}
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
            {game.polls.map((poll) => (
              <PollCard
                key={poll.id}
                question={poll.question}
                disabled
                options={poll.options.map((option) => ({
                  id: option.id,
                  label: option.label,
                  votes: option._count.votes,
                }))}
              />
            ))}
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
        {["chat", "stats", "play-by-play", "highlights"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <div className="mt-5">
              <EmptyState
                title={`${tab.replaceAll("-", " ")} is quiet`}
                description="Live updates appear here when available."
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
