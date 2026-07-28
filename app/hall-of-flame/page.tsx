import { PageHeading } from "@/components/layout/page-heading";
import { Card, EmptyState } from "@/components/ui/foundations";
import { Select } from "@/components/ui/form-controls";
import { LocalDateTime } from "@/components/ui/local-date-time";
import { db } from "@/lib/db/client";
import { HallPeriod, type Prisma } from "@prisma/client";

type HallListItem = Prisma.HallOfFlameEntryGetPayload<{
  include: {
    take: {
      select: {
        body: true;
        author: { select: { handle: true; displayName: true } };
      };
    };
    league: { select: { abbreviation: true } };
  };
}>;
export const dynamic = "force-dynamic";
export default async function HallPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period = Object.values(HallPeriod).includes(params.period as HallPeriod)
    ? (params.period as HallPeriod)
    : HallPeriod.WEEKLY;
  let entries: HallListItem[] = [];
  let latestRun: {
    status: string;
    finishedAt: Date | null;
    eligibleCount: number;
    errorMessage: string | null;
  } | null = null;
  try {
    [entries, latestRun] = await Promise.all([
      db.hallOfFlameEntry.findMany({
        where: { period },
        take: 50,
        orderBy: [{ periodStart: "desc" }, { rank: "asc" }],
        include: {
          take: {
            select: {
              body: true,
              author: { select: { handle: true, displayName: true } },
            },
          },
          league: { select: { abbreviation: true } },
        },
      }),
      db.operationalJobRun.findFirst({
        where: { jobKey: "hall-of-flame", period },
        orderBy: { startedAt: "desc" },
        select: {
          status: true,
          finishedAt: true,
          eligibleCount: true,
          errorMessage: true,
        },
      }),
    ]);
  } catch {}
  return (
    <div className="page-container py-10">
      <PageHeading
        eyebrow="Quality over raw likes"
        title="Hall of Flame"
        description="The strongest fan contributions, ranked by quality, conversation, and trusted participation."
      />
      <form className="mb-8 grid gap-3 sm:grid-cols-3">
        <Select aria-label="Period" name="period" defaultValue={period}>
          <option value="WEEKLY">Weekly</option>
          <option value="DAILY">Daily</option>
          <option value="MONTHLY">Monthly</option>
          <option value="ALL_TIME">All time</option>
        </Select>
        <Select aria-label="Sport" name="sport">
          <option>All sports</option>
          <option>Football</option>
          <option>Basketball</option>
        </Select>
        <button className="bg-brand rounded-sm px-4 font-bold">Apply</button>
      </form>
      {latestRun?.finishedAt ? (
        <p className="text-text-secondary mb-5 text-sm">
          Last calculated{" "}
          <LocalDateTime value={latestRun.finishedAt.toISOString()} calendar />
        </p>
      ) : null}
      {entries.length ? (
        <ol className="grid gap-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Card className="grid grid-cols-[48px_1fr_auto] items-center gap-4">
                <strong className="font-display text-brand text-3xl">
                  #{entry.rank}
                </strong>
                <div>
                  <p>{entry.take.body}</p>
                  <a
                    className="mt-2 inline-block text-sm font-bold hover:underline"
                    href={`/users/${entry.take.author.handle}`}
                  >
                    {entry.take.author.displayName}
                  </a>
                </div>
                <div className="text-right">
                  <strong>{Number(entry.score).toFixed(1)}</strong>
                  <p className="text-text-muted text-xs">
                    {entry.league?.abbreviation ?? "All"}
                  </p>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title={
            !latestRun
              ? "Rankings have not been calculated"
              : latestRun.status === "FAILED"
                ? "Ranking calculation failed"
                : latestRun.status === "RUNNING"
                  ? "Rankings are being calculated"
                  : "No eligible takes yet"
          }
          description={
            !latestRun
              ? "The first scheduled ranking run has not completed."
              : latestRun.status === "FAILED"
                ? "The previous rankings remain unchanged while the job is retried."
                : latestRun.status === "RUNNING"
                  ? "This period is currently being processed."
                  : "No active, eligible contributions qualified for this period."
          }
        />
      )}
    </div>
  );
}
