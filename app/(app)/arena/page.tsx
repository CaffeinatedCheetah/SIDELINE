import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { GameCard } from "@/components/games/game-card";
import { PageHeading } from "@/components/layout/page-heading";
import { TakeCard } from "@/components/takes/take-card";
import { Card, EmptyState } from "@/components/ui/foundations";
import { db } from "@/lib/db/client";
export const dynamic = "force-dynamic";
export default async function Arena() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in?callbackUrl=/arena");
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      profile: true,
      fanScoreEvents: true,
      communityMemberships: {
        where: { status: "ACTIVE" },
        include: { community: true },
      },
    },
  });
  if (!user?.onboardedAt) redirect("/onboarding");
  const [games, takes, rank] = await Promise.all([
    db.game.findMany({
      take: 3,
      where: { status: { in: ["LIVE", "SCHEDULED"] } },
      orderBy: { scheduledAt: "asc" },
      include: {
        league: true,
        homeTeam: true,
        awayTeam: true,
        _count: { select: { takes: true } },
      },
    }),
    db.take.findMany({
      take: 4,
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      include: {
        author: true,
        _count: { select: { reactions: true, replies: true } },
      },
    }),
    db.user.count({ where: { fanScoreEvents: { some: {} } } }),
  ]);
  const score = user.fanScoreEvents.reduce(
    (sum, event) => sum + event.points,
    0,
  );
  return (
    <>
      <PageHeading
        eyebrow="Your sports world"
        title={`Welcome back, ${user.displayName}`}
        description="Live games, people you follow, and conversations worth entering."
      />
      <section className="grid gap-3 sm:grid-cols-4">
        <Metric label="Fan Score" value={score} />
        <Metric
          label="Prediction accuracy"
          value={
            user.profile?.predictionTotal
              ? `${Math.round((user.profile.predictionCorrect / user.profile.predictionTotal) * 100)}%`
              : "—"
          }
        />
        <Metric label="Current ranking" value={rank ? `#${rank}` : "—"} />
        <Metric label="Communities" value={user.communityMemberships.length} />
      </section>
      <Section title="Live and upcoming games">
        {games.map((game) => (
          <GameCard
            key={game.id}
            id={game.id}
            league={game.league.abbreviation}
            homeTeam={game.homeTeam.name}
            awayTeam={game.awayTeam.name}
            homeScore={game.homeScore ?? undefined}
            awayScore={game.awayScore ?? undefined}
            status={game.status}
            statusText={game.status}
            conversationCount={game._count.takes}
          />
        ))}
      </Section>
      <Section title="Recommended takes">
        {takes.map((take) => (
          <TakeCard
            key={take.id}
            id={take.id}
            author={{
              handle: take.author.handle,
              displayName: take.author.displayName,
              avatarUrl: take.author.image,
            }}
            body={take.body}
            createdAt={take.createdAt.toLocaleDateString()}
            reactions={take._count.reactions}
            replies={take._count.replies}
          />
        ))}
      </Section>
      <Section title="Joined communities">
        {user.communityMemberships.length ? (
          user.communityMemberships.map((member) => (
            <Card key={member.id}>
              <a
                className="font-bold hover:underline"
                href={`/communities/${member.community.slug}`}
              >
                {member.community.name}
              </a>
            </Card>
          ))
        ) : (
          <EmptyState
            title="Find your crowd"
            description="Join public communities to personalize this space."
          />
        )}
      </Section>
    </>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <strong className="font-display text-3xl">{value}</strong>
      <p className="text-text-secondary text-sm">{label}</p>
    </Card>
  );
}
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-display mb-4 text-2xl font-black">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}
