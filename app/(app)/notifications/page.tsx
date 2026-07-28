import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/foundations";
import { LocalDateTime } from "@/components/ui/local-date-time";
import { db } from "@/lib/db/client";
export const dynamic = "force-dynamic";
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in?callbackUrl=/notifications");
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const items = await db.notification.findMany({
    where: { recipientId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 26,
    skip: (page - 1) * 25,
  });
  const hasNext = items.length > 25;
  const visibleItems = items.slice(0, 25);
  async function readAll() {
    "use server";
    const current = await auth();
    if (current?.user?.id)
      await db.notification.updateMany({
        where: { recipientId: current.user.id, readAt: null },
        data: { readAt: new Date() },
      });
  }
  async function openNotification(formData: FormData) {
    "use server";
    const current = await auth();
    if (!current?.user?.id)
      redirect("/auth/sign-in?callbackUrl=/notifications");
    const notificationId = String(formData.get("notificationId") ?? "");
    const notification = await db.notification.findFirst({
      where: { id: notificationId, recipientId: current.user.id },
      select: { href: true },
    });
    if (!notification) redirect("/notifications");
    await db.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
    redirect(notification.href);
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
      {visibleItems.length ? (
        <div className="grid gap-2">
          {visibleItems.map((item) => (
            <form action={openNotification} key={item.id}>
              <input type="hidden" name="notificationId" value={item.id} />
              <button className="w-full text-left" type="submit">
                <Card
                  className={item.readAt ? "opacity-70" : "border-brand/50"}
                >
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
              </button>
            </form>
          ))}
          <nav
            aria-label="Notification pages"
            className="mt-4 flex justify-between"
          >
            {page > 1 ? (
              <Link
                className="text-brand font-bold"
                href={`/notifications?page=${page - 1}`}
              >
                Newer
              </Link>
            ) : (
              <span />
            )}
            {hasNext ? (
              <Link
                className="text-brand font-bold"
                href={`/notifications?page=${page + 1}`}
              >
                Older
              </Link>
            ) : null}
          </nav>
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
