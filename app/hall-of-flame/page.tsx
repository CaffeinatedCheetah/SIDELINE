import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/layout/page-heading";
import { Select } from "@/components/ui/form-controls";
import {
  Avatar,
  Card,
  EmptyState,
  ErrorState,
} from "@/components/ui/foundations";
import { db } from "@/lib/db/client";
import { withTimeout } from "@/lib/db/with-timeout";
import {
  HALL_SORTS,
  sortHallEntries,
  type HallSort,
} from "@/lib/hall-of-flame/presentation";
import type { HallPeriod, Prisma } from "@prisma/client";

type HallListItem = Prisma.HallOfFlameEntryGetPayload<{
  include: {
    take: {
      select: {
        body: true;
        createdAt: true;
        author: { select: { handle: true; displayName: true; image: true } };
        _count: { select: { reactions: true; comments: true; replies: true } };
      };
    };
    league: { select: { key: true; name: true; abbreviation: true } };
  };
}>;

const PERIODS: { key: HallPeriod; label: string }[] = [
  { key: "DAILY", label: "Trending Today" },
  { key: "WEEKLY", label: "Trending This Week" },
  { key: "MONTHLY", label: "Month" },
  { key: "ALL_TIME", label: "All time" },
];

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; league?: string; sort?: string }>;
}): Promise<Metadata> {
  const { period } = await searchParams;
  const active = PERIODS.find((p) => p.key === period) ?? PERIODS[1]!;
  return {
    title: "Hall of Flame",
    description:
      "The strongest fan contributions, ranked by quality, conversation, and trusted participation.",
    alternates: {
      canonical:
        active.key === "WEEKLY"
          ? "/hall-of-flame"
          : `/hall-of-flame?period=${active.key}`,
    },
  };
}

export default async function HallPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; league?: string; sort?: string }>;
}) {
  const {
    period: rawPeriod,
    league: leagueKey,
    sort: rawSort,
  } = await searchParams;
  const activePeriod =
    PERIODS.find((p) => p.key === rawPeriod)?.key ?? "WEEKLY";
  const activeSort: HallSort = HALL_SORTS.some((sort) => sort.key === rawSort)
    ? (rawSort as HallSort)
    : "ranked";

  let entries: HallListItem[] = [];
  let leagueOptions: { key: string; name: string; abbreviation: string }[] = [];
  let failed = false;
  try {
    const selectedLeague = leagueKey
      ? await db.league.findUnique({
          where: { key: leagueKey },
          select: { id: true },
        })
      : null;
    [entries, leagueOptions] = await withTimeout(
      Promise.all([
        db.hallOfFlameEntry.findMany({
          where: {
            period: activePeriod,
            leagueId: selectedLeague?.id ?? null,
            communityId: null,
          },
          take: 50,
          orderBy: [{ periodStart: "desc" }, { rank: "asc" }],
          include: {
            take: {
              select: {
                body: true,
                createdAt: true,
                author: {
                  select: { handle: true, displayName: true, image: true },
                },
                _count: {
                  select: { reactions: true, comments: true, replies: true },
                },
              },
            },
            league: {
              select: { key: true, name: true, abbreviation: true },
            },
          },
        }),
        db.league.findMany({
          where: { hallEntries: { some: { period: activePeriod } } },
          orderBy: { name: "asc" },
          select: { key: true, name: true, abbreviation: true },
        }),
      ]),
      "HallPage.findMany",
    );
  } catch (error) {
    failed = true;
    console.error(
      "[HallPage] query failed:",
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
  }
  entries = sortHallEntries(entries, activeSort);
  const [top3, rest] = [entries.slice(0, 3), entries.slice(3)];
  const updatedAt = entries[0]?.createdAt;

  return (
    <div className="page-container py-10">
      <PageHeading
        eyebrow="Quality over raw likes"
        title="Hall of Flame"
        description="The strongest fan contributions, ranked by quality, conversation, and trusted participation."
      />
      <nav aria-label="Ranking period" className="mb-4 flex flex-wrap gap-1">
        {PERIODS.map(({ key, label }) => (
          <Link
            key={key}
            href={`/hall-of-flame?${new URLSearchParams({
              ...(key !== "WEEKLY" ? { period: key } : {}),
              ...(leagueKey ? { league: leagueKey } : {}),
              ...(activeSort !== "ranked" ? { sort: activeSort } : {}),
            })}`}
            aria-current={activePeriod === key ? "page" : undefined}
            className={`min-h-11 rounded-sm px-4 py-2 text-sm font-bold ${
              activePeriod === key
                ? "bg-brand-surface text-brand-light"
                : "text-text-secondary hover:bg-surface-3"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <form className="border-border-subtle bg-surface-1 mb-4 flex flex-wrap items-end gap-3 rounded-xl border p-3">
        {activePeriod !== "WEEKLY" ? (
          <input type="hidden" name="period" value={activePeriod} />
        ) : null}
        <label className="grid gap-1 text-sm font-bold">
          League
          <Select name="league" defaultValue={leagueKey ?? ""}>
            <option value="">All leagues</option>
            {leagueOptions.map((league) => (
              <option key={league.key} value={league.key}>
                {league.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1 text-sm font-bold">
          View
          <Select name="sort" defaultValue={activeSort}>
            {HALL_SORTS.map((sort) => (
              <option key={sort.key} value={sort.key}>
                {sort.label}
              </option>
            ))}
          </Select>
        </label>
        <button className="bg-brand focus-visible:ring-focus min-h-11 rounded-lg px-4 text-sm font-bold text-white focus-visible:ring-2 focus-visible:outline-none">
          Apply
        </button>
      </form>
      {updatedAt && (
        <p className="text-text-muted mb-8 text-xs">
          Updated{" "}
          <time dateTime={updatedAt.toISOString()}>
            {updatedAt.toLocaleString()}
          </time>
        </p>
      )}
      <details className="border-border-subtle bg-surface-1 mb-8 rounded-md border p-4">
        <summary className="cursor-pointer font-bold">
          How ranking works
        </summary>
        <div className="text-text-secondary mt-3 grid gap-2 text-sm">
          <p>
            Each eligible take gets a score out of 100: 50% quality (based on
            how developed the take is), 30% conversation (reactions and replies
            it drew), 20% trust (the author&rsquo;s account standing).
          </p>
          <p>
            Takes from suspended or deleted accounts, and takes with more than 2
            reports, are excluded entirely -- they never enter the ranking,
            whatever their score would have been.
          </p>
          <p>
            Ties share the same score; when that happens, order is broken by an
            internal ID only, purely to render deterministically -- it
            doesn&rsquo;t imply either take is better.
          </p>
        </div>
      </details>
      {failed ? (
        <ErrorState
          title="Rankings are unavailable"
          description="We couldn't load Hall of Flame right now. Try again shortly."
        />
      ) : entries.length ? (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {top3.map((entry) => (
              <PodiumCard key={entry.id} entry={entry} />
            ))}
          </div>
          {rest.length > 0 && (
            <ol start={4} className="grid gap-3">
              {rest.map((entry) => (
                <li key={entry.id}>
                  <Card className="hover:border-brand/40 grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-4 rounded-xl transition hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transform-none">
                    <strong className="font-display text-brand text-3xl">
                      #{entry.rank}
                    </strong>
                    <div>
                      <p>{entry.take.body}</p>
                      <p className="text-text-muted mt-2 text-xs">
                        {entry.take._count.reactions} reactions ·{" "}
                        {entry.take._count.comments + entry.take._count.replies}{" "}
                        responses
                      </p>
                      <Link
                        className="mt-2 inline-block text-sm font-bold hover:underline"
                        href={`/u/${entry.take.author.handle}`}
                      >
                        {entry.take.author.displayName}
                      </Link>
                    </div>
                    <div className="text-right">
                      <strong>{Number(entry.score).toFixed(1)}</strong>
                      <p className="text-text-muted text-xs">out of 100</p>
                    </div>
                  </Card>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : (
        <EmptyState
          title="Great takes will appear here once fans start posting"
          description={
            leagueKey
              ? "No eligible ranked takes exist for this league and period yet."
              : "Eligible takes appear after fans create quality conversation and the ranking job runs."
          }
        />
      )}
      <p className="text-text-muted mt-10 text-xs">
        Eligible fans are active, in good standing, and not currently
        sanctioned. Rank reflects real participation, not payment -- there is no
        way to buy or vote for placement here.
      </p>
    </div>
  );
}

function PodiumCard({ entry }: { entry: HallListItem }) {
  return (
    <Card className="border-brand/20 bg-[linear-gradient(145deg,var(--surface-1),var(--brand-surface))] text-center shadow-lg">
      <strong className="font-display text-brand block text-4xl">
        #{entry.rank}
      </strong>
      <Avatar
        name={entry.take.author.displayName}
        src={entry.take.author.image}
        size="lg"
      />
      <Link
        href={`/u/${entry.take.author.handle}`}
        className="mt-3 block font-bold hover:underline"
      >
        {entry.take.author.displayName}
      </Link>
      <p className="text-text-secondary mt-2 line-clamp-3 text-sm">
        {entry.take.body}
      </p>
      <p className="text-text-muted mt-3 text-xs">
        Score {Number(entry.score).toFixed(1)} / 100
      </p>
      <p className="text-text-muted mt-1 text-xs">
        {entry.take._count.reactions} reactions ·{" "}
        {entry.take._count.comments + entry.take._count.replies} responses
      </p>
    </Card>
  );
}
