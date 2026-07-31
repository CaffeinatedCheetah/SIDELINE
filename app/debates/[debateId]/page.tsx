import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { DebateVote } from "@/components/actions/debate-vote";
import { TakeComposer } from "@/components/actions/take-composer";
import { TakeCard } from "@/components/takes/take-card";
import { PageHeading } from "@/components/layout/page-heading";
import { Card, EmptyState } from "@/components/ui/foundations";
import { db } from "@/lib/db/client";
export const dynamic = "force-dynamic";
export default async function DebateDetail({
  params,
}: {
  params: Promise<{ debateId: string }>;
}) {
  const { debateId } = await params;
  // Debate.id is a native Postgres `uuid` column, so passing a non-UUID
  // slug into an `{ id: debateId }` OR branch fails at the query level
  // (Postgres can't cast "nfc-north-standings" to uuid) before the slug
  // branch is ever evaluated -- confirmed via production error logs:
  // "column User.isOfficial does not exist" was a red herring here, the
  // real error was `Error creating UUID, invalid character`. Nearly every
  // DebateCard in the app links by slug (see app/page.tsx, app/debates/
  // page.tsx, app/debates/resolved/page.tsx, app/communities/[slug]/
  // page.tsx), so this broke the majority of real debate navigation.
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const [session, debate] = await Promise.all([
    auth(),
    db.debate.findFirst({
      where: UUID_RE.test(debateId)
        ? { OR: [{ id: debateId }, { slug: debateId }] }
        : { slug: debateId },
      include: {
        // See app/games/[gameId]/page.tsx for why these are scoped
        // selects, not `creator: true` / `author: true`.
        creator: { select: { displayName: true } },
        options: {
          orderBy: { displayOrder: "asc" },
          include: { _count: { select: { votes: true } } },
        },
        takes: {
          where: { status: "ACTIVE" },
          orderBy: [{ reactions: { _count: "desc" } }, { createdAt: "desc" }],
          take: 12,
          include: {
            author: {
              select: {
                handle: true,
                displayName: true,
                image: true,
              },
            },
            _count: { select: { reactions: true, replies: true } },
          },
        },
      },
    }),
  ]);
  if (!debate) notFound();

  const myVote = session?.user?.id
    ? await db.vote.findUnique({
        where: {
          userId_debateId: { userId: session.user.id, debateId: debate.id },
        },
        select: { debateOptionId: true },
      })
    : null;

  const total = debate.options.reduce(
    (sum, option) => sum + option._count.votes,
    0,
  );
  return (
    <div className="page-container py-10">
      <PageHeading
        eyebrow={`${debate.status} debate`}
        title={debate.title}
        description={debate.prompt}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="grid gap-3" aria-labelledby="positions">
          <h2 id="positions" className="font-display text-2xl font-black">
            Positions
          </h2>
          <DebateVote
            debateId={debate.id}
            options={debate.options}
            initialSelected={myVote?.debateOptionId ?? undefined}
            disabled={debate.status !== "OPEN"}
          />
          {debate.options.map((option) => {
            const percentage = total
              ? Math.round((option._count.votes / total) * 100)
              : 0;
            const leading =
              total > 0 &&
              option._count.votes ===
                Math.max(...debate.options.map((item) => item._count.votes));
            return (
              <Card
                key={option.id}
                className={`overflow-hidden rounded-xl ${leading ? "border-success/45 bg-success/8" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold">
                      {option.label}
                      {leading ? (
                        <span className="text-success ml-2 text-xs uppercase">
                          Leading
                        </span>
                      ) : null}
                    </h3>
                    <p className="text-text-secondary text-sm">
                      {option.description}
                    </p>
                  </div>
                  <strong className="font-display text-2xl">
                    {percentage}%
                  </strong>
                </div>
                <div
                  className="bg-surface-3 mt-3 h-2 overflow-hidden rounded-full"
                  aria-label={`${option.label}: ${option._count.votes} votes`}
                >
                  <span
                    className={`block h-full rounded-full ${leading ? "bg-success" : "bg-brand"}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </Card>
            );
          })}
          <h2 className="font-display mt-6 text-2xl font-black">
            Counter-takes
          </h2>
          <TakeComposer debateId={debate.id} />
          {debate.takes.length ? (
            debate.takes.map((take) => (
              <TakeCard
                key={take.id}
                id={take.id}
                author={{
                  handle: take.author.handle,
                  displayName: take.author.displayName,
                  avatarUrl: take.author.image,
                }}
                body={take.body}
                createdAt=""
                createdAtIso={take.createdAt.toISOString()}
                reactions={take._count.reactions}
                replies={take._count.replies}
              />
            ))
          ) : (
            <EmptyState
              title="No counter-takes yet"
              description="Be the first fan to spark this debate with a clear argument."
            />
          )}
        </section>
        <aside>
          <Card>
            <p className="text-text-secondary text-sm">Created by</p>
            <p className="font-bold">{debate.creator.displayName}</p>
            <p className="text-text-secondary mt-4 text-sm">{total} votes</p>
            {debate.closesAt && (
              <p className="text-text-muted mt-1 text-xs">
                Closes{" "}
                <time dateTime={debate.closesAt.toISOString()}>
                  {debate.closesAt.toLocaleDateString()}
                </time>
              </p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
