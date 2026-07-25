import { PageHeading } from "@/components/layout/page-heading";
import { Card, EmptyState, ErrorState } from "@/components/ui/foundations";
import { Select } from "@/components/ui/form-controls";
import { db } from "@/lib/db/client";
import { withTimeout } from "@/lib/db/with-timeout";
import type { Prisma } from "@prisma/client";

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
export default async function HallPage() {
  let entries: HallListItem[] = [];
  let failed = false;
  try {
    entries = (await withTimeout(
      db.hallOfFlameEntry.findMany({
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
      "HallPage.findMany",
    )) as typeof entries;
  } catch (error) {
    failed = true;
    console.error(
      "[HallPage] query failed:",
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
  }
  return (
    <div className="page-container py-10">
      <PageHeading
        eyebrow="Quality over raw likes"
        title="Hall of Flame"
        description="The strongest fan contributions, ranked by quality, conversation, and trusted participation."
      />
      <form className="mb-8 grid gap-3 sm:grid-cols-3">
        <Select aria-label="Period" name="period">
          <option>Weekly</option>
          <option>Daily</option>
          <option>Monthly</option>
          <option>All time</option>
        </Select>
        <Select aria-label="Sport" name="sport">
          <option>All sports</option>
          <option>Football</option>
          <option>Basketball</option>
        </Select>
        <button className="bg-brand rounded-sm px-4 font-bold">Apply</button>
      </form>
      {failed ? (
        <ErrorState
          title="Rankings are unavailable"
          description="We couldn't load Hall of Flame right now. Try again shortly."
        />
      ) : entries.length ? (
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
          title="Rankings are being calculated"
          description="Eligible takes appear after the scheduled ranking job runs."
        />
      )}
    </div>
  );
}
