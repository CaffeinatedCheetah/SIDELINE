import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/layout/page-heading";
import { Avatar, Card, EmptyState, ErrorState } from "@/components/ui/foundations";
import { db } from "@/lib/db/client";
import { withTimeout } from "@/lib/db/with-timeout";
import type { HallPeriod, Prisma } from "@prisma/client";

type HallListItem = Prisma.HallOfFlameEntryGetPayload<{
  include: {
    take: {
      select: {
        body: true;
        author: { select: { handle: true; displayName: true; image: true } };
      };
    };
    league: { select: { abbreviation: true } };
  };
}>;

const PERIODS: { key: HallPeriod; label: string }[] = [
  { key: "DAILY", label: "Today" },
  { key: "WEEKLY", label: "Week" },
  { key: "MONTHLY", label: "Month" },
  { key: "ALL_TIME", label: "All time" },
];

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}): Promise<Metadata> {
  const { period } = await searchParams;
  const active = PERIODS.find((p) => p.key === period) ?? PERIODS[1]!;
  return {
    title: "Hall of Flame",
    description:
      "The strongest fan contributions, ranked by quality, conversation, and trusted participation.",
    alternates: {
      canonical: active.key === "WEEKLY" ? "/hall-of-flame" : `/hall-of-flame?period=${active.key}`,
    },
  };
}

export default async function HallPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: rawPeriod } = await searchParams;
  const activePeriod = PERIODS.find((p) => p.key === rawPeriod)?.key ?? "WEEKLY";

  let entries: HallListItem[] = [];
  let failed = false;
  try {
    entries = (await withTimeout(
      db.hallOfFlameEntry.findMany({
        where: { period: activePeriod, leagueId: null, communityId: null },
        take: 50,
        orderBy: [{ periodStart: "desc" }, { rank: "asc" }],
        include: {
          take: {
            select: {
              body: true,
              author: { select: { handle: true, displayName: true, image: true } },
            },
          },
          league: { select: { abbreviation: true } },
        },
      }),
      "HallPage.findMany",
    )) as typeof entries;
  } catch (error) {
    failed = true;
    console.error(
      "[HallPage] query failed:",
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
  }
  const [top3, rest] = [entries.slice(0, 3), entries.slice(3)];
  const updatedAt = entries[0]?.createdAt;

  return (
    <div className="page-container py-10">
      <PageHeading
        eyebrow="Quality over raw likes"
        title="Hall of Flame"
        description="The strongest fan contributions, ranked by quality, conversation, and trusted participation."
      />
      <nav aria-label="Ranking period" className="mb-2 flex flex-wrap gap-1">
        {PERIODS.map(({ key, label }) => (
          <Link
            key={key}
            href={key === "WEEKLY" ? "/hall-of-flame" : `/hall-of-flame?period=${key}`}
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
      {updatedAt && (
        <p className="text-text-muted mb-8 text-xs">
          Updated{" "}
          <time dateTime={updatedAt.toISOString()}>{updatedAt.toLocaleString()}</time>
        </p>
      )}
      <details className="border-border-subtle bg-surface-1 mb-8 rounded-md border p-4">
        <summary className="cursor-pointer font-bold">How ranking works</summary>
        <div className="text-text-secondary mt-3 grid gap-2 text-sm">
          <p>
            Each eligible take gets a score out of 100: 50% quality (based on how
            developed the take is), 30% conversation (reactions and replies it
            drew), 20% trust (the author&rsquo;s account standing).
          </p>
          <p>
            Takes from suspended or deleted accounts, and takes with more than 2
            reports, are excluded entirely -- they never enter the ranking, whatever
            their score would have been.
          </p>
          <p>
            Ties share the same score; when that happens, order is broken by an
            internal ID only, purely to render deterministically -- it doesn&rsquo;t
            imply either take is better.
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
                  <Card className="grid grid-cols-[48px_1fr_auto] items-center gap-4">
                    <strong className="font-display text-brand text-3xl">
                      #{entry.rank}
                    </strong>
                    <div>
                      <p>{entry.take.body}</p>
                      <Link
                        className="mt-2 inline-block text-sm font-bold hover:underline"
                        href={`/users/${entry.take.author.handle}`}
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
          title="Rankings are being calculated"
          description="Eligible takes appear after the ranking job runs for this period."
        />
      )}
      <p className="text-text-muted mt-10 text-xs">
        Eligible fans are active, in good standing, and not currently sanctioned.
        Rank reflects real participation, not payment -- there is no way to buy or
        vote for placement here.
      </p>
    </div>
  );
}

function PodiumCard({ entry }: { entry: HallListItem }) {
  return (
    <Card className="text-center">
      <strong className="font-display text-brand block text-4xl">#{entry.rank}</strong>
      <Avatar
        name={entry.take.author.displayName}
        src={entry.take.author.image}
        size="lg"
      />
      <Link
        href={`/users/${entry.take.author.handle}`}
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
    </Card>
  );
}
