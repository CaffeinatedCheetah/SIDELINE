import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { auth } from "@/auth";
import { FollowButton } from "@/components/actions/follow-button";
import { UnblockButton } from "@/components/actions/unblock-button";
import { CommunityCard } from "@/components/communities/community-card";
import { DebateCard } from "@/components/debates/debate-card";
import { ProfileActionsMenu } from "@/components/profile/profile-actions-menu";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { PROFILE_TABS } from "@/lib/profile/tabs";
import { TakeCard } from "@/components/takes/take-card";
import { Avatar, Badge, Card, EmptyState } from "@/components/ui/foundations";
import { buttonStyles } from "@/components/ui/button";
import { db } from "@/lib/db/client";
import { FAN_SCORE_POINTS } from "@/lib/scoring/fan-score";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const getProfileUser = cache(async (handle: string) => {
  return db.user.findFirst({
    where: { normalizedHandle: handle.toLowerCase() },
    select: {
      id: true,
      handle: true,
      displayName: true,
      image: true,
      status: true,
      deletedAt: true,
      createdAt: true,
      profile: {
        select: {
          bio: true,
          avatarUrl: true,
          location: true,
          favoriteSports: true,
          favoriteTeams: true,
        },
      },
      preferences: { select: { privacySettings: true } },
      badges: {
        orderBy: { awardedAt: "desc" },
        take: 6,
        include: { badge: true },
      },
      _count: { select: { followers: true, following: true } },
    },
  });
});

type ProfileUser = NonNullable<Awaited<ReturnType<typeof getProfileUser>>>;

function isPublic(user: Pick<ProfileUser, "status" | "deletedAt">) {
  return user.status === "ACTIVE" && !user.deletedAt;
}

function isDiscoverable(user: ProfileUser) {
  const privacy = (user.preferences?.privacySettings ?? {}) as {
    profileDiscoverable?: boolean;
  };
  return privacy.profileDiscoverable !== false;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const user = await getProfileUser(handle);
  if (!user) return { title: "Profile not found" };
  const indexable = isPublic(user) && isDiscoverable(user);
  return {
    title: `${user.displayName} (@${user.handle})`,
    description:
      user.profile?.bio?.trim() || `${user.displayName}'s FanTakes profile.`,
    alternates: { canonical: `/users/${user.handle}` },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ tab?: string; cursor?: string }>;
}) {
  const { handle } = await params;
  const { tab: rawTab, cursor } = await searchParams;
  const tab = PROFILE_TABS.includes(rawTab ?? "") ? rawTab! : "takes";
  const [session, user] = await Promise.all([auth(), getProfileUser(handle)]);
  if (!user) notFound();
  const viewerId = session?.user?.id;
  const isOwner = viewerId === user.id;

  if (!isOwner && !isPublic(user)) {
    return (
      <div className="page-container py-10">
        <EmptyState
          title="This profile isn't available"
          description="It may have been deleted, suspended, or restricted."
        />
      </div>
    );
  }

  let following = false;
  let muted = false;
  let viewerBlockedThem = false;
  let theyBlockedViewer = false;
  if (viewerId && !isOwner) {
    const [followRow, muteRow, blockA, blockB] = await Promise.all([
      db.follow.findUnique({
        where: { followerId_followedId: { followerId: viewerId, followedId: user.id } },
        select: { id: true },
      }),
      db.mute.findUnique({
        where: {
          userId_targetType_targetId: {
            userId: viewerId,
            targetType: "USER",
            targetId: user.id,
          },
        },
        select: { userId: true },
      }),
      db.block.findUnique({
        where: { blockerId_blockedId: { blockerId: viewerId, blockedId: user.id } },
        select: { blockerId: true },
      }),
      db.block.findUnique({
        where: { blockerId_blockedId: { blockerId: user.id, blockedId: viewerId } },
        select: { blockerId: true },
      }),
    ]);
    following = Boolean(followRow);
    muted = Boolean(muteRow);
    viewerBlockedThem = Boolean(blockA);
    theyBlockedViewer = Boolean(blockB);
  }

  // A block hides interaction in both directions -- the blocked-by party
  // sees the same privacy-safe surface as a restricted/deleted profile,
  // without being told specifically that they were blocked.
  if (theyBlockedViewer) {
    return (
      <div className="page-container py-10">
        <EmptyState
          title="This profile isn't available"
          description="It may have been deleted, suspended, or restricted."
        />
      </div>
    );
  }
  if (viewerBlockedThem) {
    return (
      <div className="page-container py-10">
        <EmptyState
          title="You've blocked this account"
          description="You won't see their takes, debates, or profile content until you unblock them."
          action={<UnblockButton userId={user.id} />}
        />
      </div>
    );
  }

  const [favoriteTeams, scoreAgg, resolvedPredictions] = await Promise.all([
    user.profile?.favoriteTeams.length
      ? db.team.findMany({
          where: { id: { in: user.profile.favoriteTeams } },
          select: { id: true, name: true, abbreviation: true, logoUrl: true },
        })
      : Promise.resolve([]),
    db.fanScoreEvent.aggregate({
      where: { userId: user.id },
      _sum: { points: true },
    }),
    // Profile.predictionCorrect/Total are never updated anywhere in the
    // codebase (confirmed via search -- no PredictionResult is ever
    // created), so accuracy is computed live from real Prediction/
    // PredictionResult rows instead of trusting those stale counters.
    db.prediction.findMany({
      where: { userId: user.id, result: { isNot: null } },
      select: { result: { select: { outcome: true } } },
    }),
  ]);
  const fanScore = scoreAgg._sum.points ?? 0;
  const resolvedCount = resolvedPredictions.length;
  const correctCount = resolvedPredictions.filter(
    (p) => p.result?.outcome === "CORRECT",
  ).length;

  const cursorArg = cursor ? { id: cursor } : undefined;
  const paged = { take: PAGE_SIZE + 1, ...(cursorArg && { cursor: cursorArg, skip: 1 }) };

  return (
    <div className="page-container py-10">
      <ProfileHeader
        user={user}
        favoriteTeams={favoriteTeams}
        isOwner={isOwner}
        viewerSignedIn={Boolean(viewerId)}
        following={following}
        muted={muted}
      />
      <ReputationSummary
        fanScore={fanScore}
        resolvedCount={resolvedCount}
        correctCount={correctCount}
        badges={user.badges}
      />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_280px]">
        <ProfileTabs handle={user.handle} active={tab}>
          {tab === "takes" && (await TakesTab({ userId: user.id, paged, tab, handle: user.handle }))}
          {tab === "predictions" &&
            (await PredictionsTab({ userId: user.id, isOwner, paged, tab, handle: user.handle }))}
          {tab === "debates" && (await DebatesTab({ userId: user.id, paged, tab, handle: user.handle }))}
          {tab === "communities" &&
            (await CommunitiesTab({ userId: user.id, viewerId, paged, tab, handle: user.handle }))}
          {tab === "about" && (
            <AboutTab user={user} favoriteTeams={favoriteTeams} />
          )}
        </ProfileTabs>
        <aside className="grid gap-4">
          <Card>
            <h2 className="font-bold">Badges</h2>
            {user.badges.length ? (
              <ul className="mt-3 grid gap-2">
                {user.badges.map(({ badge }) => (
                  <li key={badge.id} className="flex items-center gap-2 text-sm">
                    <Badge>{badge.name}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-text-secondary mt-2 text-sm">
                No badges yet.
              </p>
            )}
          </Card>
          <Card>
            <div className="flex items-center gap-2 text-sm">
              <Users aria-hidden className="size-4" />
              <strong>{user._count.followers}</strong> followers ·{" "}
              <strong>{user._count.following}</strong> following
            </div>
            <p className="text-text-secondary mt-3 text-sm">
              Joined{" "}
              <time dateTime={user.createdAt.toISOString()}>
                {user.createdAt.toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </time>
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function ProfileHeader({
  user,
  favoriteTeams,
  isOwner,
  viewerSignedIn,
  following,
  muted,
}: {
  user: ProfileUser;
  favoriteTeams: { id: string; name: string; abbreviation: string }[];
  isOwner: boolean;
  viewerSignedIn: boolean;
  following: boolean;
  muted: boolean;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        <Avatar
          name={user.displayName}
          src={user.image ?? user.profile?.avatarUrl}
          size="lg"
        />
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight md:text-4xl">
            {user.displayName}
          </h1>
          <p className="text-text-muted">@{user.handle}</p>
          {user.profile?.bio && (
            <p className="text-text-secondary mt-2 max-w-xl">
              {user.profile.bio}
            </p>
          )}
          {favoriteTeams.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {favoriteTeams.map((team) => (
                <Badge key={team.id}>{team.abbreviation}</Badge>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isOwner ? (
          <Link href="/settings" className={buttonStyles({ variant: "secondary" })}>
            Edit profile
          </Link>
        ) : (
          viewerSignedIn && <FollowButton userId={user.id} initialFollowing={following} />
        )}
        {!isOwner && (
          <ProfileActionsMenu userId={user.id} initialMuted={muted} />
        )}
      </div>
    </header>
  );
}

function ReputationSummary({
  fanScore,
  resolvedCount,
  correctCount,
  badges,
}: {
  fanScore: number;
  resolvedCount: number;
  correctCount: number;
  badges: ProfileUser["badges"];
}) {
  const accuracy = resolvedCount
    ? Math.round((correctCount / resolvedCount) * 100)
    : null;
  return (
    <Card>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Fan Score" value={fanScore} />
        <Stat
          label="Prediction accuracy"
          value={accuracy === null ? "No resolved predictions yet" : `${accuracy}%`}
          sub={resolvedCount ? `${correctCount} of ${resolvedCount} resolved` : undefined}
        />
        <Stat label="Badges earned" value={badges.length} />
      </div>
      <details className="text-text-secondary mt-4 text-sm">
        <summary className="text-text-primary cursor-pointer font-bold">
          How reputation works
        </summary>
        <ul className="mt-2 grid gap-1">
          <li>Quality take: +{FAN_SCORE_POINTS.QUALITY_TAKE}</li>
          <li>Constructive reply: +{FAN_SCORE_POINTS.CONSTRUCTIVE_REPLY}</li>
          <li>Correct prediction: +{FAN_SCORE_POINTS.CORRECT_PREDICTION}</li>
          <li>Received insightful: +{FAN_SCORE_POINTS.RECEIVED_INSIGHTFUL}</li>
          <li>Moderation penalty: {FAN_SCORE_POINTS.MODERATION_PENALTY}</li>
        </ul>
      </details>
    </Card>
  );
}
function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div>
      <strong className="font-display text-2xl">{value}</strong>
      <p className="text-text-secondary text-sm">{label}</p>
      {sub && <p className="text-text-muted text-xs">{sub}</p>}
    </div>
  );
}

function LoadMore({
  handle,
  tab,
  cursor,
}: {
  handle: string;
  tab: string;
  cursor: string;
}) {
  return (
    <Link
      href={`/users/${handle}?tab=${tab}&cursor=${cursor}`}
      className="text-brand mt-4 inline-block text-sm font-bold hover:underline"
    >
      Load more
    </Link>
  );
}

async function TakesTab({
  userId,
  paged,
  tab,
  handle,
}: {
  userId: string;
  paged: { take: number; cursor?: { id: string }; skip?: number };
  tab: string;
  handle: string;
}) {
  const takes = await db.take.findMany({
    where: { authorId: userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    ...paged,
    include: {
      // See app/games/[gameId]/page.tsx for why this is a scoped select,
      // not `author: true`.
      author: { select: { handle: true, displayName: true, image: true } },
      _count: { select: { reactions: true, replies: true } },
    },
  });
  const hasMore = takes.length > PAGE_SIZE;
  const page = takes.slice(0, PAGE_SIZE);
  return (
    <div className="mt-5 grid gap-4">
      {page.length ? (
        page.map((take) => (
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
        <EmptyState title="No public takes yet" description="New takes appear here." />
      )}
      {hasMore && <LoadMore handle={handle} tab={tab} cursor={page[page.length - 1]!.id} />}
    </div>
  );
}

async function PredictionsTab({
  userId,
  isOwner,
  paged,
  tab,
  handle,
}: {
  userId: string;
  isOwner: boolean;
  paged: { take: number; cursor?: { id: string }; skip?: number };
  tab: string;
  handle: string;
}) {
  const predictions = await db.prediction.findMany({
    where: { userId },
    orderBy: { submittedAt: "desc" },
    ...paged,
    include: {
      game: { include: { homeTeam: true, awayTeam: true, league: true } },
      result: true,
    },
  });
  const hasMore = predictions.length > PAGE_SIZE;
  const page = predictions.slice(0, PAGE_SIZE);
  return (
    <div className="mt-5 grid gap-3">
      {page.length ? (
        page.map((prediction) => {
          // Doc: "not active private choice before lock" -- an unlocked
          // pick stays concealed from anyone but its owner.
          const locked = prediction.locksAt <= new Date();
          const revealSelection = isOwner || locked;
          return (
            <Card key={prediction.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="font-bold">
                  {prediction.game.league.abbreviation} ·{" "}
                  {prediction.game.awayTeam.abbreviation} @{" "}
                  {prediction.game.homeTeam.abbreviation}
                </p>
                <p className="text-text-secondary text-sm">
                  {revealSelection
                    ? `Picked ${prediction.selection}`
                    : "Pick locked until game time"}
                </p>
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
          description="Predictions made in game rooms appear here."
        />
      )}
      {hasMore && <LoadMore handle={handle} tab={tab} cursor={page[page.length - 1]!.id} />}
    </div>
  );
}

async function DebatesTab({
  userId,
  paged,
  tab,
  handle,
}: {
  userId: string;
  paged: { take: number; cursor?: { id: string }; skip?: number };
  tab: string;
  handle: string;
}) {
  const debates = await db.debate.findMany({
    where: { creatorId: userId },
    orderBy: { createdAt: "desc" },
    ...paged,
    include: {
      options: { include: { _count: { select: { votes: true } } } },
      _count: { select: { takes: true } },
    },
  });
  const hasMore = debates.length > PAGE_SIZE;
  const page = debates.slice(0, PAGE_SIZE);
  return (
    <div className="mt-5 grid gap-4">
      {page.length ? (
        page.map((debate) => (
          <DebateCard
            key={debate.id}
            id={debate.id}
            title={debate.title}
            category={debate.status}
            options={debate.options.map((option) => ({
              label: option.label,
              votes: option._count.votes,
            }))}
            replyCount={debate._count.takes}
            closesAt={debate.closesAt?.toLocaleDateString()}
          />
        ))
      ) : (
        <EmptyState title="No debates started yet" description="Debates this person creates appear here." />
      )}
      {hasMore && <LoadMore handle={handle} tab={tab} cursor={page[page.length - 1]!.id} />}
    </div>
  );
}

async function CommunitiesTab({
  userId,
  viewerId,
  paged,
  tab,
  handle,
}: {
  userId: string;
  viewerId: string | undefined;
  paged: { take: number; cursor?: { id: string }; skip?: number };
  tab: string;
  handle: string;
}) {
  const memberships = await db.communityMember.findMany({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    ...paged,
    include: { community: { include: { _count: { select: { members: true } } } } },
  });
  const hasMore = memberships.length > PAGE_SIZE;
  const page = memberships.slice(0, PAGE_SIZE);
  const viewerMemberships = viewerId
    ? new Set(
        (
          await db.communityMember.findMany({
            where: {
              userId: viewerId,
              status: "ACTIVE",
              communityId: { in: page.map((m) => m.communityId) },
            },
            select: { communityId: true },
          })
        ).map((m) => m.communityId),
      )
    : new Set<string>();
  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      {page.length ? (
        page.map((member) => (
          <CommunityCard
            key={member.id}
            id={member.community.id}
            slug={member.community.slug}
            name={member.community.name}
            description={member.community.description}
            members={member.community._count.members}
            joined={viewerMemberships.has(member.community.id)}
          />
        ))
      ) : (
        <EmptyState title="No communities yet" description="Communities this person joins appear here." />
      )}
      {hasMore && <LoadMore handle={handle} tab={tab} cursor={page[page.length - 1]!.id} />}
    </div>
  );
}

function AboutTab({
  user,
  favoriteTeams,
}: {
  user: ProfileUser;
  favoriteTeams: { id: string; name: string; abbreviation: string }[];
}) {
  return (
    <div className="mt-5 grid gap-4">
      <Card>
        <h2 className="font-bold">Bio</h2>
        <p className="text-text-secondary mt-2">
          {user.profile?.bio || "No bio yet."}
        </p>
      </Card>
      {user.profile?.location && (
        <Card>
          <h2 className="font-bold">Location</h2>
          <p className="text-text-secondary mt-2">{user.profile.location}</p>
        </Card>
      )}
      <Card>
        <h2 className="font-bold">Favorite teams</h2>
        {favoriteTeams.length ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {favoriteTeams.map((team) => (
              <li key={team.id}>
                <Badge>{team.name}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-secondary mt-2">No favorite teams yet.</p>
        )}
      </Card>
      <Card>
        <h2 className="font-bold">Joined</h2>
        <p className="text-text-secondary mt-2">
          <time dateTime={user.createdAt.toISOString()}>
            {user.createdAt.toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </time>
        </p>
      </Card>
    </div>
  );
}
