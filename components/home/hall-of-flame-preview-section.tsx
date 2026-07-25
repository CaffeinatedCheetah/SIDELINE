import Link from "next/link";
import { auth } from "@/auth";
import { Card, EmptyState } from "@/components/ui/foundations";
import { getHallOfFlamePreview } from "@/lib/db/hall-of-flame-preview";

export async function HallOfFlamePreviewSection() {
  const session = await auth();
  const { entries, failed } = await getHallOfFlamePreview(
    session?.user?.id,
    5,
  );

  return (
    <section aria-labelledby="hall-of-flame-heading">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h2
          id="hall-of-flame-heading"
          className="font-display min-w-0 text-3xl font-black"
        >
          Hall of Flame
        </h2>
        <Link
          href="/hall-of-flame"
          className="text-brand shrink-0 font-bold hover:underline"
        >
          View Hall of Flame
        </Link>
      </div>
      <p
        id="hall-of-flame-rank-explainer"
        className="text-text-muted mb-5 text-sm"
      >
        Rank reflects the quality of a fan&apos;s single best take, scored by
        the Hall of Flame ranking job. Fan Score is a separate, ongoing
        measure of that fan&apos;s overall reputation — a higher Fan Score
        does not change their rank here.
      </p>
      {failed ? (
        <EmptyState
          title="Rankings are unavailable"
          description="We couldn't load the leaderboard right now."
        />
      ) : entries.length ? (
        <ol
          className="grid gap-3"
          aria-describedby="hall-of-flame-rank-explainer"
        >
          {entries.map((entry) => {
            const author = entry.take.author;
            const badge = author.badges[0]?.badge;
            return (
              <li key={entry.id}>
                <Card className="grid grid-cols-[2rem_auto_1fr_auto] items-center gap-4">
                  <strong
                    className="font-display text-brand text-2xl"
                    aria-label={`Rank ${entry.rank}, by take quality`}
                  >
                    #{entry.rank}
                  </strong>
                  {author.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={author.image}
                      alt=""
                      aria-hidden
                      className="size-10 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden
                      className="bg-surface-3 grid size-10 place-items-center rounded-full font-bold"
                    >
                      {author.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <Link
                      href={`/users/${author.handle}`}
                      className="block truncate font-bold hover:underline"
                    >
                      {author.displayName}
                    </Link>
                    {badge && (
                      <span className="text-text-muted text-xs">
                        {badge.icon} {badge.name}
                      </span>
                    )}
                  </div>
                  <div className="grid gap-1 text-right text-sm">
                    <div>
                      <strong>{Number(entry.score).toFixed(0)}</strong>
                      <span className="text-text-muted ml-1 text-xs">
                        Top Take
                      </span>
                    </div>
                    <div>
                      <strong>{author.profile?.reputation ?? 0}</strong>
                      <span className="text-text-muted ml-1 text-xs">
                        Fan Score
                      </span>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState
          title="Rankings are being calculated"
          description="Eligible takes appear after the scheduled ranking job runs."
        />
      )}
    </section>
  );
}
