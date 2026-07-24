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
    <section>
      <div className="mb-5 flex items-end justify-between">
        <h2 className="font-display text-3xl font-black">Hall of Flame</h2>
        <Link
          href="/hall-of-flame"
          className="text-brand font-bold hover:underline"
        >
          View Hall of Flame
        </Link>
      </div>
      {failed ? (
        <EmptyState
          title="Rankings are unavailable"
          description="We couldn't load the leaderboard right now."
        />
      ) : entries.length ? (
        <ol className="grid gap-3">
          {entries.map((entry) => {
            const author = entry.take.author;
            const badge = author.badges[0]?.badge;
            return (
              <li key={entry.id}>
                <Card className="grid grid-cols-[2rem_auto_1fr_auto] items-center gap-4">
                  <strong className="font-display text-brand text-2xl">
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
                  <div className="text-right">
                    <strong>{author.profile?.reputation ?? 0}</strong>
                    <p className="text-text-muted text-xs">Fan Score</p>
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
