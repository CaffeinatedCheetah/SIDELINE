import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { CommunityCard } from "@/components/communities/community-card";
import { DebateCard } from "@/components/debates/debate-card";
import { GameCard } from "@/components/games/game-card";
import { HallOfFlamePreviewSection } from "@/components/home/hall-of-flame-preview-section";
import { ExploreLeaguesSection } from "@/components/home/explore-leagues-section";
import { LiveRightNowSection } from "@/components/home/live-right-now-section";
import { MySidelineSection } from "@/components/home/my-sideline-section";
import { TodaysScheduleSection } from "@/components/home/todays-schedule-section";
import { ProfileCard } from "@/components/profile/profile-card";
import { TakeCard } from "@/components/takes/take-card";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/foundations";
import { db } from "@/lib/db/client";
import { getLeagueHub } from "@/lib/db/league-hub";
import { getMySideline } from "@/lib/db/my-sideline";
import {
  gameStatusLabel,
  getSportsGameDirectory,
} from "@/lib/sports/read-model";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your game. Your take.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "FanTakes — Your game. Your take.",
    description: "Live sports, real conversation, and fan identity.",
  },
};

async function discovery(viewerId: string | undefined) {
  try {
    const [gameDirectory, takes, debates, communities] = await Promise.all([
      getSportsGameDirectory({ limit: 3 }),
      db.take.findMany({
        take: 3,
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        include: {
          // See app/games/[gameId]/page.tsx for why this is a scoped
          // select, not `author: true`.
          author: { select: { handle: true, displayName: true, image: true } },
          _count: { select: { reactions: true, replies: true } },
        },
      }),
      db.debate.findMany({
        take: 3,
        where: { status: "OPEN" },
        orderBy: { createdAt: "desc" },
        include: {
          options: {
            include: { _count: { select: { votes: true } } },
            orderBy: { displayOrder: "asc" },
          },
          _count: { select: { comments: true } },
        },
      }),
      db.community.findMany({
        take: 3,
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
        include: { _count: { select: { members: true, takes: true } } },
      }),
    ]);

    let viewer = null;
    let reactedTakeIds = new Set<string>();
    let joinedCommunityIds = new Set<string>();
    if (viewerId) {
      const [viewerRow, reactions, memberships] = await Promise.all([
        db.user.findUnique({
          where: { id: viewerId },
          include: { profile: true },
        }),
        db.reaction.findMany({
          where: {
            userId: viewerId,
            kind: "FIRE",
            takeId: { in: takes.map((take) => take.id) },
          },
          select: { takeId: true },
        }),
        db.communityMember.findMany({
          where: {
            userId: viewerId,
            status: "ACTIVE",
            communityId: { in: communities.map((community) => community.id) },
          },
          select: { communityId: true },
        }),
      ]);
      viewer = viewerRow;
      reactedTakeIds = new Set(
        reactions
          .map((reaction) => reaction.takeId)
          .filter((takeId): takeId is string => takeId !== null),
      );
      joinedCommunityIds = new Set(
        memberships.map((membership) => membership.communityId),
      );
    }

    return {
      games: gameDirectory.games,
      takes,
      debates,
      communities,
      viewer,
      reactedTakeIds,
      joinedCommunityIds,
      failed: false,
      gameDataFailed:
        gameDirectory.providerError && gameDirectory.games.length === 0,
    };
  } catch {
    return {
      games: [],
      takes: [],
      debates: [],
      communities: [],
      viewer: null,
      reactedTakeIds: new Set<string>(),
      joinedCommunityIds: new Set<string>(),
      failed: true,
      gameDataFailed: true,
    };
  }
}

export default async function Home() {
  const session = await auth();
  const [data, mySideline, leagueHub] = await Promise.all([
    discovery(session?.user?.id),
    getMySideline(session?.user?.id),
    getLeagueHub(session?.user?.id),
  ]);
  const hasPersonalizedActivity =
    mySideline.liveGames.length > 0 ||
    mySideline.upcomingGames.length > 0 ||
    mySideline.recentGames.length > 0 ||
    mySideline.flashThreads.length > 0;
  return (
    <>
      <section className="hero-grid">
        <div className="page-container grid items-center gap-10 py-16 lg:grid-cols-[1.1fr_.9fr] lg:py-24">
          <div>
            <p className="text-brand text-sm font-bold tracking-[.2em] uppercase">
              Live sports participation
            </p>
            <h1 className="font-display mt-4 max-w-3xl text-6xl leading-[.9] font-black tracking-tight md:text-8xl">
              YOUR GAME.
              <br />
              <span className="text-brand">YOUR TAKE.</span>
            </h1>
            <p className="text-text-secondary mt-6 max-w-xl text-lg">
              Follow the score, enter the conversation, make your prediction,
              and build a fan identity that means something.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/games" className={buttonStyles({ size: "lg" })}>
                Explore live games
              </Link>
              {session?.user ? (
                <Link
                  href="/arena"
                  className={buttonStyles({
                    variant: "secondary",
                    size: "lg",
                  })}
                >
                  Go to My Arena
                </Link>
              ) : (
                <Link
                  href="/auth/sign-up"
                  className={buttonStyles({
                    variant: "secondary",
                    size: "lg",
                  })}
                >
                  Join FanTakes
                </Link>
              )}
            </div>
          </div>
          {data.games[0] ? (
            <GameCard
              featured
              id={data.games[0].id}
              league={data.games[0].league.abbreviation}
              leagueKey={data.games[0].league.key}
              homeTeam={data.games[0].homeTeam.name}
              awayTeam={data.games[0].awayTeam.name}
              homeTeamLogo={data.games[0].homeTeam.logoUrl ?? undefined}
              awayTeamLogo={data.games[0].awayTeam.logoUrl ?? undefined}
              homeScore={data.games[0].homeScore ?? undefined}
              awayScore={data.games[0].awayScore ?? undefined}
              status={data.games[0].status}
              statusText={gameStatusLabel(data.games[0])}
              scheduledAt={data.games[0].scheduledAt.toISOString()}
              broadcast={data.games[0].broadcast ?? undefined}
              conversationCount={data.games[0]._count.takes}
              followerCount={data.games[0]._count.follows}
            />
          ) : (
            <EmptyState
              title={
                data.gameDataFailed
                  ? "Schedules could not refresh"
                  : "No live game right now"
              }
              description={
                data.gameDataFailed
                  ? "No synchronized schedule is available yet. Try again shortly."
                  : "See what starts next."
              }
              action={
                <Link
                  className={buttonStyles({ variant: "secondary" })}
                  href="/games"
                >
                  View games
                </Link>
              }
            />
          )}
        </div>
      </section>
      <div className="page-container grid gap-16 py-14">
        <MySidelineSection
          signedIn={Boolean(session?.user?.id)}
          teams={mySideline.teams}
          liveGames={mySideline.liveGames}
          upcomingGames={mySideline.upcomingGames}
          recentGames={mySideline.recentGames}
          flashThreads={mySideline.flashThreads}
        />
        {!hasPersonalizedActivity ? (
          <>
            <LiveRightNowSection />
            <TodaysScheduleSection />
          </>
        ) : null}
        <ExploreLeaguesSection leagues={leagueHub.leagues} />
        <Section
          title="Trending takes"
          href="/games"
          isEmpty={!data.takes.length}
          emptyState={
            <EmptyState
              title={
                data.failed ? "Takes are unavailable" : "No trending takes yet"
              }
              description={
                data.failed
                  ? "Try again shortly."
                  : "Be the first to share a take."
              }
            />
          }
        >
          {data.takes.map((take) => (
            <TakeCard
              key={take.id}
              id={take.id}
              author={{
                handle: take.author.handle,
                displayName: take.author.displayName,
                avatarUrl: take.author.image,
              }}
              body={take.body}
              createdAt={take.createdAt.toLocaleDateString()}
              reactions={take._count.reactions}
              replies={take._count.replies}
              initialReacted={data.reactedTakeIds.has(take.id)}
            />
          ))}
        </Section>
        <Section
          title="Debates worth entering"
          href="/debates"
          isEmpty={!data.debates.length}
          emptyState={
            <EmptyState
              title={
                data.failed ? "Debates are unavailable" : "No open debates yet"
              }
              description={
                data.failed ? "Try again shortly." : "Start the first one."
              }
            />
          }
        >
          {data.debates.map((debate) => (
            <DebateCard
              key={debate.id}
              id={debate.slug}
              title={debate.title}
              category="Open debate"
              options={debate.options.map((option) => ({
                label: option.label,
                votes: option._count.votes,
              }))}
              replyCount={debate._count.comments}
            />
          ))}
        </Section>
        <Section
          title="Find your crowd"
          href="/communities"
          isEmpty={!data.communities.length}
          emptyState={
            <EmptyState
              title={
                data.failed
                  ? "Communities are unavailable"
                  : "No communities yet"
              }
              description={
                data.failed ? "Try again shortly." : "Check back soon."
              }
            />
          }
        >
          {data.communities.map((community) => (
            <CommunityCard
              key={community.id}
              id={community.id}
              slug={community.slug}
              name={community.name}
              description={community.description}
              members={community._count.members}
              joined={data.joinedCommunityIds.has(community.id)}
            />
          ))}
        </Section>
        <HallOfFlamePreviewSection />
        <section>
          <h2 className="font-display text-3xl font-black">Fan identity</h2>
          <p className="text-text-secondary mt-2">
            Your best takes, predictions, communities, badges, and
            reputation—together.
          </p>
          <div className="mt-6 max-w-md">
            {data.viewer ? (
              <ProfileCard
                handle={data.viewer.handle}
                displayName={data.viewer.displayName}
                bio={
                  data.viewer.profile?.bio ??
                  "Building a fan identity one take at a time."
                }
                fanScore={data.viewer.profile?.reputation ?? 0}
              />
            ) : (
              <EmptyState
                title="Build your fan identity"
                description="Sign in to start earning reputation."
                action={
                  <Link
                    className={buttonStyles({ variant: "secondary" })}
                    href="/auth/sign-up"
                  >
                    Create your profile
                  </Link>
                }
              />
            )}
          </div>
        </section>
        <section className="border-brand/40 bg-brand/10 rounded-lg border p-8 text-center">
          <h2 className="font-display text-4xl font-black">
            Scores bring fans in.
            <br />
            Conversations keep them.
            <br />
            <span className="text-brand">Identity brings them back.</span>
          </h2>
          <Link
            href="/auth/sign-up"
            className={`${buttonStyles({ size: "lg" })} mt-6`}
          >
            Create your fan profile
          </Link>
        </section>
      </div>
    </>
  );
}

function Section({
  title,
  href,
  children,
  isEmpty,
  emptyState,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
  isEmpty?: boolean;
  emptyState?: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h2 className="font-display min-w-0 text-3xl font-black">{title}</h2>
        <Link
          href={href}
          className="text-brand shrink-0 font-bold hover:underline"
        >
          View all
        </Link>
      </div>
      {isEmpty && emptyState ? (
        emptyState
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {children}
        </div>
      )}
    </section>
  );
}
