import type { Metadata } from "next";
import Link from "next/link";

import { CommunityCard } from "@/components/communities/community-card";
import { DebateCard } from "@/components/debates/debate-card";
import { GameCard } from "@/components/games/game-card";
import { ProfileCard } from "@/components/profile/profile-card";
import { TakeCard } from "@/components/takes/take-card";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/foundations";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your game. Your take.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "FanTakes — Your game. Your take.",
    description: "Live sports, real conversation, and fan identity.",
  },
};

async function discovery() {
  try {
    const [games, takes, debates, communities, leader] = await Promise.all([
      db.game.findMany({
        take: 3,
        orderBy: [{ status: "asc" }, { scheduledAt: "asc" }],
        include: {
          league: true,
          homeTeam: true,
          awayTeam: true,
          _count: { select: { takes: true } },
        },
      }),
      db.take.findMany({
        take: 3,
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        include: {
          author: true,
          _count: { select: { reactions: true, replies: true } },
        },
      }),
      db.debate.findMany({
        take: 3,
        where: { status: "OPEN" },
        orderBy: { createdAt: "desc" },
        include: {
          options: {
            include: { _count: { select: { votes: true } } },
            orderBy: { displayOrder: "asc" },
          },
          _count: { select: { comments: true } },
        },
      }),
      db.community.findMany({
        take: 3,
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
        include: { _count: { select: { members: true, takes: true } } },
      }),
      db.user.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { fanScoreEvents: { _count: "desc" } },
        include: { profile: true, _count: { select: { followers: true } } },
      }),
    ]);
    return { games, takes, debates, communities, leader, failed: false };
  } catch {
    return {
      games: [],
      takes: [],
      debates: [],
      communities: [],
      leader: null,
      failed: true,
    };
  }
}

export default async function Home() {
  const data = await discovery();
  return (
    <>
      <section className="hero-grid">
        <div className="page-container grid items-center gap-10 py-16 lg:grid-cols-[1.1fr_.9fr] lg:py-24">
          <div>
            <p className="text-brand text-sm font-bold tracking-[.2em] uppercase">
              Live sports participation
            </p>
            <h1 className="font-display mt-4 max-w-3xl text-6xl leading-[.9] font-black tracking-tight md:text-8xl">
              YOUR GAME.
              <br />
              <span className="text-brand">YOUR TAKE.</span>
            </h1>
            <p className="text-text-secondary mt-6 max-w-xl text-lg">
              Follow the score, enter the conversation, make your prediction,
              and build a fan identity that means something.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/games" className={buttonStyles({ size: "lg" })}>
                Explore live games
              </Link>
              <Link
                href="/auth/sign-up"
                className={buttonStyles({ variant: "secondary", size: "lg" })}
              >
                Join FanTakes
              </Link>
            </div>
          </div>
          {data.games[0] ? (
            <GameCard
              featured
              id={data.games[0].id}
              league={data.games[0].league.abbreviation}
              homeTeam={data.games[0].homeTeam.name}
              awayTeam={data.games[0].awayTeam.name}
              homeScore={data.games[0].homeScore ?? undefined}
              awayScore={data.games[0].awayScore ?? undefined}
              status={data.games[0].status}
              statusText={
                data.games[0].status === "LIVE"
                  ? `${data.games[0].period ?? "Live"} ${data.games[0].clock ?? ""}`
                  : data.games[0].status
              }
              conversationCount={data.games[0]._count.takes}
            />
          ) : (
            <EmptyState
              title={
                data.failed
                  ? "Live data is unavailable"
                  : "No live game right now"
              }
              description={
                data.failed
                  ? "Try Games for the latest schedule."
                  : "See what starts next."
              }
              action={
                <Link
                  className={buttonStyles({ variant: "secondary" })}
                  href="/games"
                >
                  View games
                </Link>
              }
            />
          )}
        </div>
      </section>
      <div className="page-container grid gap-16 py-14">
        <Section title="Live right now" href="/games">
          {data.games.map((game) => (
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
            />
          ))}
        </Section>
        <Section title="Trending takes" href="/games">
          {data.takes.map((take) => (
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
        <Section title="Debates worth entering" href="/debates">
          {data.debates.map((debate) => (
            <DebateCard
              key={debate.id}
              id={debate.slug}
              title={debate.title}
              category="Open debate"
              options={debate.options.map((option) => ({
                label: option.label,
                votes: option._count.votes,
              }))}
              replyCount={debate._count.comments}
            />
          ))}
        </Section>
        <Section title="Find your crowd" href="/communities">
          {data.communities.map((community) => (
            <CommunityCard
              key={community.id}
              slug={community.slug}
              name={community.name}
              description={community.description}
                  members={community._count.members}
            />
          ))}
        </Section>
        <section>
          <h2 className="font-display text-3xl font-black">Fan identity</h2>
          <p className="text-text-secondary mt-2">
            Your best takes, predictions, communities, badges, and
            reputation—together.
          </p>
          <div className="mt-6 max-w-md">
            {data.leader ? (
              <ProfileCard
                handle={data.leader.handle}
                displayName={data.leader.displayName}
                bio={data.leader.profile?.bio ?? "Building a fan identity one take at a time."}
                fanScore={data.leader.profile?.reputation ?? 0}
              />
            ) : (
              <EmptyState
                title="Build your fan identity"
                description="Sign in to start earning reputation."
              />
            )}
          </div>
        </section>
        <section className="border-brand/40 bg-brand/10 rounded-lg border p-8 text-center">
          <h2 className="font-display text-4xl font-black">
            Scores bring fans in.
            <br />
            Conversations keep them.
            <br />
            <span className="text-brand">Identity brings them back.</span>
          </h2>
          <Link
            href="/auth/sign-up"
            className={`${buttonStyles({ size: "lg" })} mt-6`}
          >
            Create your fan profile
          </Link>
        </section>
      </div>
    </>
  );
}

function Section({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex items-end justify-between">
        <h2 className="font-display text-3xl font-black">{title}</h2>
        <Link href={href} className="text-brand font-bold hover:underline">
          View all
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}
