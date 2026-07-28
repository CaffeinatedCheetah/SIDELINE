import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/foundations";
import { LocalDateTime } from "@/components/ui/local-date-time";
import { db } from "@/lib/db/client";
export const dynamic = "force-dynamic";
export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in?callbackUrl=/notifications");
  const items = await db.notification.findMany({
    where: { recipientId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  async function readAll() {
    "use server";
    const current = await auth();
    if (current?.user?.id)
      await db.notification.updateMany({
        where: { recipientId: current.user.id, readAt: null },
        data: { readAt: new Date() },
      });
  }
  return (
    <>
      <PageHeading
        eyebrow="Stay in the conversation"
        title="Notifications"
        description="Replies, reactions, follows, predictions, and moderation updates."
        action={
          <form action={readAll}>
            <Button variant="secondary" type="submit">
              Mark all read
            </Button>
          </form>
        }
      />
      {items.length ? (
        <div className="grid gap-2">
          {items.map((item) => (
            <a href={item.href} key={item.id}>
              <Card className={item.readAt ? "opacity-70" : "border-brand/50"}>
                <div className="flex justify-between gap-4">
                  <div>
                    <strong>{item.type.replaceAll("_", " ")}</strong>
                    <p className="text-text-secondary text-sm">
                      Open the related activity
                    </p>
                  </div>
                  <LocalDateTime
                    className="text-text-muted text-xs"
                    value={item.createdAt.toISOString()}
                    calendar
                  />
                </div>
              </Card>
            </a>
          ))}
        </div>
      ) : (
        <EmptyState
          title="You are all caught up"
          description="New replies, follows, badges, and game updates appear here."
        />
      )}
    </>
  );
}
