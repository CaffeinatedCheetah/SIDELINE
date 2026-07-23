import { notFound } from "next/navigation";
import { PageHeading } from "@/components/layout/page-heading";
import { TakeCard } from "@/components/takes/take-card";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/foundations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/lib/db/client";
export const dynamic = "force-dynamic";
export default async function CommunityDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const community = await db.community.findUnique({
    where: { slug },
    include: {
      takes: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        include: {
          author: true,
          _count: { select: { reactions: true, replies: true } },
        },
      },
      _count: { select: { members: true } },
    },
  });
  if (!community) notFound();
  return (
    <div className="page-container py-10">
      <PageHeading
        eyebrow={`${community._count.members} members`}
        title={community.name}
        description={community.description}
        action={
          <a
            className={buttonStyles()}
            href={`/auth/sign-in?callbackUrl=/communities/${slug}`}
          >
            Join community
          </a>
        }
      />
      <Tabs defaultValue="feed">
        <TabsList>
          {["feed", "chat", "polls", "members", "events", "media", "about"].map(
            (tab) => (
              <TabsTrigger value={tab} key={tab}>
                {tab}
              </TabsTrigger>
            ),
          )}
        </TabsList>
        <TabsContent value="feed">
          <div className="mt-5 grid gap-4">
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
        <TabsContent value="about">
          <div className="border-border-subtle bg-surface-1 mt-5 rounded-md border p-6 whitespace-pre-wrap">
            <h2 className="font-display text-xl font-black">Community rules</h2>
            <p className="text-text-secondary mt-3">{community.rules}</p>
          </div>
        </TabsContent>
        {["chat", "polls", "members", "events", "media"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <div className="mt-5">
              <EmptyState
                title={`${tab} will appear here`}
                description="This section fills as members participate."
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
