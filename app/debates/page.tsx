import Link from "next/link";
import { DebateCard } from "@/components/debates/debate-card";
import { PageHeading } from "@/components/layout/page-heading";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/foundations";
import { db } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";

type DebateListItem = Prisma.DebateGetPayload<{
  include: {
    options: { include: { _count: { select: { votes: true } } } };
    _count: { select: { comments: true } };
  };
}>;
export const dynamic = "force-dynamic";
export default async function DebatesPage() {
  let debates: DebateListItem[] = [];
  try {
    debates = (await db.debate.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      include: {
        options: {
          orderBy: { displayOrder: "asc" },
          include: { _count: { select: { votes: true } } },
        },
        _count: { select: { comments: true } },
      },
    })) as typeof debates;
  } catch {}
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
      {debates.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {debates.map((debate) => (
            <DebateCard
              key={debate.id}
              id={debate.slug}
              title={debate.title}
              category="Open"
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
          title="No open debates"
          description="Be the first to frame a great sports question."
        />
      )}
    </div>
  );
}
