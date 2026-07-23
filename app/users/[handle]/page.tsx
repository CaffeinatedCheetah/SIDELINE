import { notFound } from "next/navigation";
import { PageHeading } from "@/components/layout/page-heading";
import { TakeCard } from "@/components/takes/take-card";
import { Badge, Card, EmptyState } from "@/components/ui/foundations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/lib/db/client";
export const dynamic = "force-dynamic";
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const user = await db.user.findUnique({
    where: { normalizedHandle: handle.toLowerCase() },
    include: {
      profile: true,
      takes: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { reactions: true, replies: true } } },
      },
      badges: { include: { badge: true } },
      fanScoreEvents: true,
      _count: { select: { followers: true, following: true } },
    },
  });
  if (!user) notFound();
  const score = user.fanScoreEvents.reduce(
    (sum, event) => sum + event.points,
    0,
  );
  return (
    <div className="page-container py-10">
      <PageHeading
        eyebrow={`@${user.handle}`}
        title={user.displayName}
        description={
          user.profile?.bio ??
          "A FanTakes fan building their game-day identity."
        }
      />
      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        <Stat label="Fan Score" value={score} />
        <Stat
          label="Prediction accuracy"
          value={
            user.profile?.predictionTotal
              ? `${Math.round((user.profile.predictionCorrect / user.profile.predictionTotal) * 100)}%`
              : "—"
          }
        />
        <Stat label="Followers" value={user._count.followers} />
        <Stat label="Following" value={user._count.following} />
      </div>
      <div className="mb-8 flex flex-wrap gap-2">
        {user.badges.map(({ badge }) => (
          <Badge key={badge.id}>{badge.name}</Badge>
        ))}
      </div>
      <Tabs defaultValue="takes">
        <TabsList>
          {[
            "takes",
            "activity",
            "predictions",
            "badges",
            "communities",
            "following",
            "followers",
          ].map((tab) => (
            <TabsTrigger value={tab} key={tab}>
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="takes">
          <div className="mt-5 grid gap-4">
            {user.takes.length ? (
              user.takes.map((take) => (
                <TakeCard
                  key={take.id}
                  id={take.id}
                  author={{
                    handle: user.handle,
                    displayName: user.displayName,
                    avatarUrl: user.image,
                  }}
                  body={take.body}
                  createdAt={take.createdAt.toLocaleDateString()}
                  reactions={take._count.reactions}
                  replies={take._count.replies}
                />
              ))
            ) : (
              <EmptyState
                title="No public takes yet"
                description="New takes appear here."
              />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <strong className="font-display text-2xl">{value}</strong>
      <p className="text-text-secondary text-sm">{label}</p>
    </Card>
  );
}
