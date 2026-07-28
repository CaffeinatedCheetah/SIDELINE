import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CommunityCard } from "@/components/communities/community-card";
import { GameCard } from "@/components/games/game-card";
import { PageHeading } from "@/components/layout/page-heading";
import { TakeCard } from "@/components/takes/take-card";
import { Badge, Card, EmptyState } from "@/components/ui/foundations";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";
// Personalized, per-session content -- must never land in a shared cache.
export const metadata: Metadata = {
  title: "My Arena",
  robots: { index: false, follow: false },
};

const VIEWS = ["for-you", "predictions", "replies", "communities"] as const;
type ArenaView = (typeof VIEWS)[number];
const VIEW_LABELS: Record<ArenaView, string> = {
  "for-you": "For you",
  predictions: "Predictions",
  replies: "Replies",
  communities: "Communities",
};

export default async function Arena({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in?callbackUrl=/arena");
  const { view: rawView } = await searchParams;
  const view: ArenaView = (VIEWS as readonly string[]).includes(rawView ?? "")
    ? (rawView as ArenaView)
    : "for-you";

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      profile: true,
      communityMemberships: {
        where: { status: "ACTIVE" },
        include: { community: { include: { _count: { select: { members: true } } } } },
      },
    },
  });
  if (!user?.onboardedAt) redirect("/onboarding");

  // Server-side block/mute filtering -- doc: "Server filters blocks, mutes,
  // removed/private content." Applied both directions so neither party's
  // content surfaces in the other's feed.
  const [blockedByMe, blockingMe, mutedByMe] = await Promise.all([
    db.block.findMany({ where: { blockerId: user.id }, select: { blockedId: true } }),
    db.block.findMany({ where: { blockedId: user.id }, select: { blockerId: true } }),
    db.mute.findMany({
      where: { userId: user.id, targetType: "USER" },
      select: { targetId: true },
    }),
  ]);
  const excludedAuthors = [
    ...blockedByMe.map((b) => b.blockedId),
    ...blockingMe.map((b) => b.blockerId),
    ...mutedByMe.map((m) => m.targetId),
  ];

  const [scoreAgg, resolvedPredictions, followingIds] = await Promise.all([
    db.fanScoreEvent.aggregate({ where: { userId: user.id }, _sum: { points: true } }),
    db.prediction.findMany({
      where: { userId: user.id, result: { isNot: null } },
      select: { result: { select: { outcome: true } } },
    }),
    db.follow.findMany({
      where: { followerId: user.id },
      select: { followedId: true },
    }),
  ]);
  const fanScore = scoreAgg._sum.points ?? 0;
  const resolvedCount = resolvedPredictions.length;
  const correctCount = resolvedPredictions.filter((p) => p.result?.outcome === "CORRECT").length;
  const accuracy = resolvedCount ? Math.round((correctCount / resolvedCount) * 100) : null;
  const followedIds = followingIds
    .map((f) => f.followedId)
    .filter((id) => !excludedAuthors.includes(id));

  const favoriteTeamIds = user.profile?.favoriteTeams ?? [];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [happeningNow, predictions, myTakeIds, communityActivity] = await Promise.all([
    db.game.findMany({
      where: {
        status: "LIVE",
        OR: [
          ...(favoriteTeamIds.length
            ? [
                { homeTeamId: { in: favoriteTeamIds } },
                { awayTeamId: { in: favoriteTeamIds } },
              ]
            : []),
          { follows: { some: { userId: user.id } } },
        ],
      },
      orderBy: { scheduledAt: "asc" },
      take: 6,
      include: {
        league: true,
        homeTeam: true,
        awayTeam: true,
        _count: { select: { takes: true } },
      },
    }),
    db.prediction.findMany({
      where: { userId: user.id },
      orderBy: { submittedAt: "desc" },
      take: 6,
      include: {
        game: { include: { homeTeam: true, awayTeam: true, league: true } },
        result: true,
      },
    }),
    db.take.findMany({
      where: { authorId: user.id, status: "ACTIVE" },
      select: { id: true },
    }),
    db.communityMember.findMany({
      where: { userId: user.id, status: "ACTIVE" },
      select: {
        communityId: true,
        community: {
          select: {
            _count: {
              select: {
                takes: { where: { createdAt: { gte: sevenDaysAgo } } },
              },
            },
          },
        },
      },
    }),
  ]);

  const [replies, followingTakes] = await Promise.all([
    myTakeIds.length
      ? db.take.findMany({
          where: {
            parentId: { in: myTakeIds.map((t) => t.id) },
            status: "ACTIVE",
            authorId: { notIn: [...excludedAuthors, user.id] },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
          // See app/games/[gameId]/page.tsx for why these are scoped
          // selects, not `author: true`.
          include: {
            author: { select: { displayName: true } },
            parent: { select: { body: true } },
          },
        })
      : Promise.resolve([]),
    followedIds.length
      ? db.take.findMany({
          where: { authorId: { in: followedIds }, status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
          take: 6,
          include: {
            author: { select: { handle: true, displayName: true, image: true } },
            _count: { select: { reactions: true, replies: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const activityByCommunity = new Map(
    communityActivity.map((m) => [m.communityId, m.community._count.takes]),
  );

  const showImproveArena =
    favoriteTeamIds.length === 0 ||
    followedIds.length === 0 ||
    user.communityMemberships.length === 0;

  return (
    <>
      <PageHeading
        eyebrow="Your sports world"
        title={`Welcome back, ${user.displayName}`}
        description={`${fanScore} Fan Score${accuracy === null ? "" : ` · ${accuracy}% prediction accuracy`}`}
      />
      <nav aria-label="Arena sections" className="mb-6 flex gap-1 overflow-x-auto lg:hidden">
        {VIEWS.map((key) => (
          <Link
            key={key}
            href={key === "for-you" ? "/arena" : `/arena?view=${key}`}
            aria-current={view === key ? "page" : undefined}
            className={`min-h-11 shrink-0 rounded-sm px-4 py-2 text-sm font-bold whitespace-nowrap ${
              view === key
                ? "bg-brand-surface text-brand-light"
                : "text-text-secondary hover:bg-surface-3"
            }`}
          >
            {VIEW_LABELS[key]}
          </Link>
        ))}
      </nav>

      <div className={view === "for-you" ? "" : "hidden lg:block"}>
        <Section title="Happening now">
          {happeningNow.length ? (
            happeningNow.map((game) => (
              <GameCard
                key={game.id}
                id={game.id}
                league={game.league.abbreviation}
                homeTeam={game.homeTeam.name}
                awayTeam={game.awayTeam.name}
                homeScore={game.homeScore ?? undefined}
                awayScore={game.awayScore ?? undefined}
                status={game.status}
                statusText={game.status}
                conversationCount={game._count.takes}
              />
            ))
          ) : (
            <EmptyState
              title="No live games from your teams right now"
              description="Follow a team or a game to see it here when it goes live."
            />
          )}
        </Section>
      </div>

      <div className={view === "predictions" ? "" : "hidden lg:block"}>
        <Section title="Your predictions">
          {predictions.length ? (
            predictions.map((prediction) => {
              const locked = prediction.locksAt <= new Date();
              return (
                <Card key={prediction.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">
                      {prediction.game.league.abbreviation} ·{" "}
                      {prediction.game.awayTeam.abbreviation} @{" "}
                      {prediction.game.homeTeam.abbreviation}
                    </p>
                    <p className="text-text-secondary text-sm">Picked {prediction.selection}</p>
                  </div>
                  {prediction.result ? (
                    <Badge tone={prediction.result.outcome === "CORRECT" ? "success" : "danger"}>
                      {prediction.result.outcome}
                    </Badge>
                  ) : (
                    <Badge tone={locked ? "neutral" : "live"}>
                      {locked ? "Awaiting result" : "Open"}
                    </Badge>
                  )}
                </Card>
              );
            })
          ) : (
            <EmptyState
              title="No predictions yet"
              description="Make a prediction in any game room to track your record here."
            />
          )}
        </Section>
      </div>

      <div className={view === "replies" ? "" : "hidden lg:block"}>
        <Section title="Conversations">
          {replies.length ? (
            replies.map((reply) => (
              <Card key={reply.id}>
                <p className="text-text-secondary text-sm">
                  {reply.author.displayName} replied to your take
                </p>
                <p className="mt-2">{reply.body}</p>
              </Card>
            ))
          ) : (
            <EmptyState
              title="No replies waiting on you"
              description="Replies to your takes show up here."
            />
          )}
        </Section>
      </div>

      <div className={view === "communities" ? "" : "hidden lg:block"}>
        <Section title="Your communities">
          {user.communityMemberships.length ? (
            user.communityMemberships.map((member) => (
              <CommunityCard
                key={member.id}
                id={member.community.id}
                slug={member.community.slug}
                name={member.community.name}
                description={
                  activityByCommunity.get(member.community.id)
                    ? `${activityByCommunity.get(member.community.id)} takes this week`
                    : member.community.description
                }
                members={member.community._count.members}
                joined
              />
            ))
          ) : (
            <EmptyState
              title="Find your crowd"
              description="Join public communities to personalize this space."
              action={
                <Link href="/communities" className="text-brand font-bold hover:underline">
                  Browse communities
                </Link>
              }
            />
          )}
        </Section>
      </div>

      <div className={view === "for-you" ? "" : "hidden lg:block"}>
        <Section title="Following">
          {followingTakes.length ? (
            followingTakes.map((take) => (
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
              />
            ))
          ) : (
            <EmptyState
              title="Follow fans to fill this feed"
              description="New takes from people you follow appear here."
              action={
                <Link href="/search" className="text-brand font-bold hover:underline">
                  Find people to follow
                </Link>
              }
            />
          )}
        </Section>
      </div>

      {showImproveArena && (
        <Section title="Improve your Arena">
          <Card className="sm:col-span-2 xl:col-span-3">
            <ul className="grid gap-3">
              {favoriteTeamIds.length === 0 && (
                <ImproveItem
                  label="Add favorite teams to see their live games here"
                  href="/settings"
                  cta="Add teams"
                />
              )}
              {followedIds.length === 0 && (
                <ImproveItem
                  label="Follow other fans to build your Following feed"
                  href="/search"
                  cta="Find fans"
                />
              )}
              {user.communityMemberships.length === 0 && (
                <ImproveItem
                  label="Join a community to see it here"
                  href="/communities"
                  cta="Browse communities"
                />
              )}
            </ul>
          </Card>
        </Section>
      )}
    </>
  );
}

function ImproveItem({ label, href, cta }: { label: string; href: string; cta: string }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-text-secondary">{label}</span>
      <Link href={href} className="text-brand shrink-0 font-bold hover:underline">
        {cta}
      </Link>
    </li>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display mb-4 text-2xl font-black">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}
