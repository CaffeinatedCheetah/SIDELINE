import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { CommunityCard } from "@/components/communities/community-card";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState, ErrorState } from "@/components/ui/foundations";
import { Input } from "@/components/ui/form-controls";
import { db } from "@/lib/db/client";
import { withTimeout } from "@/lib/db/with-timeout";
import type { Prisma } from "@prisma/client";

type CommunityListItem = Prisma.CommunityGetPayload<{
  include: { _count: { select: { members: true; takes: true } } };
}>;

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Communities",
  description:
    "Public spaces organized around teams, leagues, and the conversations fans care about.",
};

// Design spec (docs/pages/COMMUNITIES.md) calls for tabs Trending/Most
// active/New. "Trending" is approximated as recent take velocity (takes in
// the last 7 days) since there's no dedicated activity-tracking field on
// Community; "Most active" is total take volume; "New" is recency.
const TRENDING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type Tab = "trending" | "active" | "new";
const TABS: { key: Tab; label: string }[] = [
  { key: "trending", label: "Trending" },
  { key: "active", label: "Most active" },
  { key: "new", label: "New" },
];

export default async function CommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab: tabParam } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === tabParam)
    ? (tabParam as Tab)
    : "trending";
  const session = await auth();
  let communities: CommunityListItem[] = [];
  let joinedIds = new Set<string>();
  let failed = false;
  const trendingSince = new Date(new Date().getTime() - TRENDING_WINDOW_MS);
  try {
    communities = (await withTimeout(
      db.community.findMany({
        where: {
          status: "ACTIVE",
          ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
        },
        orderBy:
          tab === "new"
            ? { createdAt: "desc" }
            : tab === "active"
              ? { takes: { _count: "desc" } }
              : undefined,
        include: {
          _count: {
            select: {
              members: true,
              takes:
                tab === "trending" ? { where: { createdAt: { gte: trendingSince } } } : true,
            },
          },
        },
      }),
      "CommunitiesPage.findMany",
    )) as typeof communities;
    if (tab === "trending") {
      communities = [...communities].sort(
        (a, b) => b._count.takes - a._count.takes || a.id.localeCompare(b.id),
      );
    }
    if (session?.user?.id) {
      const memberships = await db.communityMember.findMany({
        where: {
          userId: session.user.id,
          communityId: { in: communities.map((community) => community.id) },
          status: "ACTIVE",
        },
        select: { communityId: true },
      });
      joinedIds = new Set(memberships.map((m) => m.communityId));
    }
  } catch (error) {
    failed = true;
    console.error(
      "[CommunitiesPage] query failed:",
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
  }

  const featured =
    !q && communities.length
      ? [...communities].sort(
          (a, b) =>
            b._count.members - a._count.members || a.id.localeCompare(b.id),
        )[0]
      : null;
  const rest = featured
    ? communities.filter((c) => c.id !== featured.id)
    : communities;

  return (
    <div className="page-container py-10">
      <PageHeading
        eyebrow="Find your crowd"
        title="Communities"
        description="Public spaces organized around teams, leagues, and the conversations fans care about."
      />
      <form className="mb-8 flex gap-3">
        <input type="hidden" name="tab" value={tab === "trending" ? "" : tab} />
        <Input
          aria-label="Search communities"
          name="q"
          defaultValue={q}
          placeholder="Search communities"
        />
        <button className="bg-brand rounded-sm px-5 font-bold">Search</button>
      </form>
      {failed ? (
        <ErrorState
          title="Communities are unavailable"
          description="We couldn't load communities right now. Try again shortly."
        />
      ) : (
        <>
          {featured && (
            <div className="mb-8">
              <p className="text-brand mb-2 text-xs font-bold tracking-wider uppercase">
                Featured community
              </p>
              <div className="max-w-sm">
                <CommunityCard
                  id={featured.id}
                  slug={featured.slug}
                  name={featured.name}
                  description={featured.description}
                  members={featured._count.members}
                  joined={joinedIds.has(featured.id)}
                />
              </div>
            </div>
          )}
          <nav aria-label="Sort communities" className="mb-6 flex gap-1">
            {TABS.map(({ key, label }) => (
              <Link
                key={key}
                href={`/communities?${new URLSearchParams({
                  ...(key !== "trending" ? { tab: key } : {}),
                  ...(q ? { q } : {}),
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
          {rest.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rest.map((community) => (
                <CommunityCard
                  key={community.id}
                  id={community.id}
                  slug={community.slug}
                  name={community.name}
                  description={community.description}
                  members={community._count.members}
                  joined={joinedIds.has(community.id)}
                />
              ))}
            </div>
          ) : featured ? null : (
            <EmptyState
              title="No communities found"
              description="Try a broader search."
            />
          )}
        </>
      )}
    </div>
  );
}
