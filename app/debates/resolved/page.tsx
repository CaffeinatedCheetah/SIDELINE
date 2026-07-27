import type { Metadata } from "next";
import Link from "next/link";
import { DebateCard } from "@/components/debates/debate-card";
import { PageHeading } from "@/components/layout/page-heading";
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

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Resolved debates",
  description: "Closed and archived debates with their final results.",
};

export default async function ResolvedDebatesPage() {
  let debates: DebateListItem[] = [];
  let failed = false;
  try {
    debates = await withTimeout(
      db.debate.findMany({
        where: { status: { in: ["LOCKED", "ARCHIVED"] } },
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
      "ResolvedDebatesPage.findMany",
    );
  } catch (error) {
    failed = true;
    console.error(
      "[ResolvedDebatesPage] query failed:",
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
  }

  return (
    <div className="page-container py-10">
      <PageHeading
        eyebrow="Take a side"
        title="Resolved debates"
        description="Closed and archived debates with their final results."
        action={
          <Link href="/debates" className="text-brand font-bold hover:underline">
            Back to open debates
          </Link>
        }
      />
      {failed ? (
        <ErrorState
          title="Resolved debates are unavailable"
          description="We couldn't load these right now. Try again shortly."
        />
      ) : debates.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {debates.map((debate) => (
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
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No resolved debates yet"
          description="Closed and archived debates will show up here."
        />
      )}
    </div>
  );
}
