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

// Design spec (docs/pages/DEBATE_CENTER.md) calls for tabs Active/Closing
// soon/Resolved with sport/community filters. "Closing soon" is anything
// OPEN with a closesAt inside this window.
const CLOSING_SOON_WINDOW_MS = 24 * 60 * 60 * 1000;

type Tab = "active" | "closing" | "resolved";
const TABS: { key: Tab; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "closing", label: "Closing soon" },
  { key: "resolved", label: "Resolved" },
];

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
    : "active";

  let debates: DebateListItem[] = [];
  let communities: CommunityOption[] = [];
  let failed = false;
  const now = new Date();
  const closingSoonAt = new Date(now.getTime() + CLOSING_SOON_WINDOW_MS);
  try {
    [debates, communities] = await withTimeout(
      Promise.all([
        db.debate.findMany({
          where: {
            ...(tab === "resolved"
              ? { status: { in: ["LOCKED", "ARCHIVED"] } }
              : tab === "closing"
                ? { status: "OPEN", closesAt: { lte: closingSoonAt, gte: now } }
                : {
                    status: "OPEN",
                    OR: [{ closesAt: null }, { closesAt: { gt: closingSoonAt } }],
                  }),
            ...(params.community ? { community: { slug: params.community } } : {}),
          },
          orderBy: { createdAt: "desc" },
          take: 60,
          include: {
            options: {
              orderBy: { displayOrder: "asc" },
              include: { _count: { select: { votes: true } } },
            },
            _count: { select: { comments: true } },
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
  } catch (error) {
    failed = true;
    console.error(
      "[DebatesPage] query failed:",
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
  }

  // Featured: the highest-participation Active debate. Deterministic, not
  // random -- the design doc explicitly says featured content never
  // auto-rotates. Only shown on the Active tab, matching the doc's layout
  // (featured sits above the tabs, ahead of the general list).
  const featured =
    tab === "active" && debates.length
      ? [...debates].sort(
          (a, b) =>
            debateTotal(b) - debateTotal(a) ||
            a.id.localeCompare(b.id),
        )[0]
      : null;
  const rest = featured ? debates.filter((d) => d.id !== featured.id) : debates;

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
            <nav aria-label="Debate status" className="flex gap-1">
              {TABS.map(({ key, label }) => (
                <Link
                  key={key}
                  href={`/debates?${new URLSearchParams({
                    ...(key !== "active" ? { tab: key } : {}),
                    ...(params.community ? { community: params.community } : {}),
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
            <form className="flex items-center gap-2">
              <input type="hidden" name="tab" value={tab === "active" ? "" : tab} />
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
          </div>
          {rest.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rest.map((debate) => (
                <DebateCard
                  key={debate.id}
                  id={debate.slug}
                  title={debate.title}
                  category={debate.status}
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
                tab === "resolved"
                  ? "No resolved debates yet"
                  : tab === "closing"
                    ? "Nothing closing soon"
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
