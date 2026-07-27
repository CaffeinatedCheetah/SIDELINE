import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { JoinCommunityButton } from "@/components/actions/join-community-button";
import { TakeComposer } from "@/components/actions/take-composer";
import { PageHeading } from "@/components/layout/page-heading";
import { DebateCard } from "@/components/debates/debate-card";
import { TakeCard } from "@/components/takes/take-card";
import { Avatar, Card, EmptyState } from "@/components/ui/foundations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/lib/db/client";
export const dynamic = "force-dynamic";
export default async function CommunityDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [session, community] = await Promise.all([
    auth(),
    db.community.findUnique({
      where: { slug },
      include: {
        takes: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
          include: {
            // See app/games/[gameId]/page.tsx for why this is a scoped
            // select, not `author: true`.
            author: { select: { handle: true, displayName: true, image: true } },
            _count: { select: { reactions: true, replies: true } },
          },
        },
        debates: {
          orderBy: { createdAt: "desc" },
          include: {
            options: { include: { _count: { select: { votes: true } } } },
            _count: { select: { comments: true } },
          },
        },
        members: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "asc" },
          take: 100,
          include: {
            user: { select: { handle: true, displayName: true, image: true } },
          },
        },
        _count: { select: { members: true } },
      },
    }),
  ]);
  if (!community) notFound();

  const myMembership = session?.user?.id
    ? community.members.find((m) => m.userId === session.user!.id)
    : undefined;

  return (
    <div className="page-container py-10">
      <PageHeading
        eyebrow={`${community._count.members} members`}
        title={community.name}
        description={community.description}
        action={
          <JoinCommunityButton
            communityId={community.id}
            initialJoined={Boolean(myMembership)}
            rules={community.rules}
          />
        }
      />
      <div className="mb-6 flex items-center gap-3">
        <Avatar name={community.name} src={community.avatarUrl} size="lg" />
        <div>
          <p className="text-text-secondary text-sm font-bold">
            Community rules
          </p>
          <p className="text-text-muted line-clamp-2 max-w-2xl text-sm whitespace-pre-wrap">
            {community.rules}
          </p>
        </div>
      </div>
      <Tabs defaultValue="feed">
        <TabsList>
          {["feed", "debates", "members", "about"].map((tab) => (
            <TabsTrigger value={tab} key={tab}>
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="feed">
          <div className="mt-5 grid gap-4">
            <TakeComposer communityId={community.id} />
            {community.takes.length ? (
              community.takes.map((take) => (
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
              ))
            ) : (
              <EmptyState
                title="This feed is ready for its first take"
                description="Join to start the conversation."
              />
            )}
          </div>
        </TabsContent>
        <TabsContent value="debates">
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {community.debates.length ? (
              community.debates.map((debate) => (
                <DebateCard
                  key={debate.id}
                  id={debate.slug}
                  title={debate.title}
                  category={debate.status}
                  options={debate.options.map((option) => ({
                    label: option.label,
                    votes: option._count.votes,
                  }))}
                  replyCount={debate._count.comments}
                  closesAt={debate.closesAt?.toLocaleDateString()}
                />
              ))
            ) : (
              <EmptyState
                title="No debates yet"
                description="Start one from the Debate Center and attach it to this community."
              />
            )}
          </div>
        </TabsContent>
        <TabsContent value="members">
          <div className="mt-5 grid gap-2">
            {community.members.length ? (
              community.members.map((member) => (
                <Card
                  key={member.id}
                  className="flex items-center gap-3 py-3"
                >
                  <Avatar
                    name={member.user.displayName}
                    src={member.user.image}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">
                      {member.user.displayName}
                    </p>
                    <p className="text-text-muted text-xs">
                      @{member.user.handle}
                    </p>
                  </div>
                  {member.role !== "MEMBER" && (
                    <span className="text-text-secondary text-xs font-bold uppercase">
                      {member.role}
                    </span>
                  )}
                </Card>
              ))
            ) : (
              <EmptyState
                title="No members yet"
                description="Be the first to join."
              />
            )}
          </div>
        </TabsContent>
        <TabsContent value="about">
          <div className="border-border-subtle bg-surface-1 mt-5 rounded-md border p-6 whitespace-pre-wrap">
            <h2 className="font-display text-xl font-black">Community rules</h2>
            <p className="text-text-secondary mt-3">{community.rules}</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
