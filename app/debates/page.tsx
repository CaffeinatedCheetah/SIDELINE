import type { Metadata } from "next";
import Link from "next/link";
import { DebateCard } from "@/components/debates/debate-card";
import { PageHeading } from "@/components/layout/page-heading";
import { Select } from "@/components/ui/form-controls";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/foundations";
import { db } from "@/lib/db/client";
import { withTimeout } from "@/lib/db/with-timeout";
import type { Prisma } from "@prisma/client";

type DebateListItem = Prisma.DebateGetPayload<{
  include: {
    options: { include: { _count: { select: { votes: true } } } };
    _count: { select: { comments: true } };
    game: { include: { league: true } };
  };
}>;
type CommunityOption = Prisma.CommunityGetPayload<{
  select: { slug: true; name: true };
}>;

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Debate Center",
  description: "Clear questions, accountable votes, and room to change minds.",
};

// Tab set below deliberately does NOT match docs/pages/DEBATE_CENTER.md,
// which specifies Active/Closing soon/Resolved (implemented that way in
// this project's own Phase 9 launch-readiness audit, with this exact
// Popular/Latest/Trending/Unanswered set flagged there as a doc conflict
// at the time). This is a deliberate re-request against a visual reference
// the doc doesn't reflect -- flagging the reversal explicitly rather than
// silently re-implementing without noting it, per this project's own
// standing pattern for doc/brief conflicts.
type Tab = "popular" | "latest" | "trending" | "unanswered";
const TABS: { key: Tab; label: string }[] = [
  { key: "popular", label: "Popular" },
  { key: "latest", label: "Latest" },
  { key: "trending", label: "Trending" },
  { key: "unanswered", label: "Unanswered" },
];
const TRENDING_WINDOW_MS = 48 * 60 * 60 * 1000;

function debateTotal(debate: DebateListItem) {
  return debate.options.reduce((sum, option) => sum + option._count.votes, 0);
}

export default async function DebatesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; community?: string }>;
}) {
  const params = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === params.tab)
    ? (params.tab as Tab)
    : "popular";

  let debates: DebateListItem[] = [];
  let communities: CommunityOption[] = [];
  let recentVoteCounts = new Map<string, number>();
  let failed = false;
  const now = new Date();
  try {
    const communityFilter = params.community
      ? { community: { slug: params.community } }
      : {};
    [debates, communities] = await withTimeout(
      Promise.all([
        db.debate.findMany({
          where: { status: "OPEN", ...communityFilter },
          orderBy: { createdAt: "desc" },
          take: 60,
          include: {
            options: {
              orderBy: { displayOrder: "asc" },
              include: { _count: { select: { votes: true } } },
            },
            _count: { select: { comments: true } },
            game: { include: { league: true } },
          },
        }),
        db.community.findMany({
          where: { status: "ACTIVE" },
          orderBy: { name: "asc" },
          select: { slug: true, name: true },
        }),
      ]),
      "DebatesPage.findMany",
    );
    if (tab === "trending" && debates.length) {
      // Real vote velocity, not a fabricated score -- same approach Phase
      // 10 used for "Trending" communities (7-day take velocity), just a
      // shorter window since debate votes move faster than community posts.
      const grouped = await db.vote.groupBy({
        by: ["debateId"],
        where: {
          debateId: { in: debates.map((d) => d.id) },
          createdAt: { gte: new Date(now.getTime() - TRENDING_WINDOW_MS) },
        },
        _count: { _all: true },
      });
      recentVoteCounts = new Map(
        grouped
          .filter((row): row is typeof row & { debateId: string } =>
            Boolean(row.debateId),
          )
          .map((row) => [row.debateId, row._count._all]),
      );
    }
  } catch (error) {
    failed = true;
    console.error(
      "[DebatesPage] query failed:",
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
  }

  const filtered =
    tab === "unanswered"
      ? debates.filter((d) => debateTotal(d) === 0)
      : debates;
  const sorted = [...filtered].sort((a, b) => {
    if (tab === "popular")
      return debateTotal(b) - debateTotal(a) || a.id.localeCompare(b.id);
    if (tab === "trending")
      return (
        (recentVoteCounts.get(b.id) ?? 0) - (recentVoteCounts.get(a.id) ?? 0) ||
        a.id.localeCompare(b.id)
      );
    // latest and unanswered both keep the query's createdAt-desc order.
    return 0;
  });

  // Featured: the highest-participation debate, deterministic (never
  // auto-rotates). Only on Popular, where it doesn't duplicate the tab's
  // own ordering signal.
  const featured = tab === "popular" && sorted.length ? sorted[0] : null;
  const rest = featured ? sorted.filter((d) => d.id !== featured.id) : sorted;

  return (
    <div className="page-container py-10">
      <PageHeading
        eyebrow="Take a side"
        title="Debate Center"
        description="Clear questions, accountable votes, and room to change minds."
        action={
          <Link className={buttonStyles()} href="/debates/new">
            Start a debate
          </Link>
        }
      />
      {failed ? (
        <ErrorState
          title="Debates are unavailable"
          description="We couldn't load the Debate Center right now. Try again shortly."
        />
      ) : (
        <>
          {featured && (
            <div className="mb-8">
              <p className="text-brand mb-2 text-xs font-bold tracking-wider uppercase">
                Featured debate
              </p>
              <DebateCard
                id={featured.slug}
                title={featured.title}
                category="Featured"
                league={featured.game?.league.abbreviation}
                options={featured.options.map((option) => ({
                  label: option.label,
                  votes: option._count.votes,
                }))}
                replyCount={featured._count.comments}
                closesAt={featured.closesAt?.toLocaleDateString()}
              />
            </div>
          )}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <nav
              aria-label="Debate sort"
              className="flex max-w-full flex-wrap gap-1"
            >
              {TABS.map(({ key, label }) => (
                <Link
                  key={key}
                  href={`/debates?${new URLSearchParams({
                    ...(key !== "popular" ? { tab: key } : {}),
                    ...(params.community
                      ? { community: params.community }
                      : {}),
                  }).toString()}`}
                  aria-current={tab === key ? "page" : undefined}
                  className={`min-h-11 rounded-sm px-3 py-2 text-sm font-bold ${
                    tab === key
                      ? "bg-brand-surface text-brand-light"
                      : "text-text-secondary hover:bg-surface-3"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-4">
              <form className="flex items-center gap-2">
                <input
                  type="hidden"
                  name="tab"
                  value={tab === "popular" ? "" : tab}
                />
                <label className="text-sm font-bold" htmlFor="community-filter">
                  Community
                </label>
                <Select
                  id="community-filter"
                  name="community"
                  defaultValue={params.community ?? ""}
                >
                  <option value="">All communities</option>
                  {communities.map((community) => (
                    <option key={community.slug} value={community.slug}>
                      {community.name}
                    </option>
                  ))}
                </Select>
                <button className="bg-brand min-h-11 rounded-sm px-3 text-sm font-bold">
                  Apply
                </button>
              </form>
              {/* Popular/Latest/Trending/Unanswered only ever cover OPEN
                  debates -- this keeps LOCKED/ARCHIVED debates reachable so
                  this tab change doesn't quietly reopen the exact
                  unreachable-resolved-debates bug Phase 9 fixed. */}
              <Link
                href="/debates/resolved"
                className="text-brand text-sm font-bold hover:underline"
              >
                View resolved
              </Link>
            </div>
          </div>
          {rest.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rest.map((debate) => (
                <DebateCard
                  key={debate.id}
                  id={debate.slug}
                  title={debate.title}
                  category={debate.status}
                  league={debate.game?.league.abbreviation}
                  options={debate.options.map((option) => ({
                    label: option.label,
                    votes: option._count.votes,
                  }))}
                  replyCount={debate._count.comments}
                  closesAt={debate.closesAt?.toLocaleDateString()}
                />
              ))}
            </div>
          ) : featured ? null : (
            <EmptyState
              title={
                tab === "unanswered"
                  ? "No unanswered debates right now"
                  : "No open debates"
              }
              description="Be the first to frame a great sports question."
            />
          )}
        </>
      )}
    </div>
  );
}
