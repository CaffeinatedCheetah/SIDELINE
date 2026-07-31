import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { startOfDay, startOfWeek } from "date-fns";
import type { Notification, NotificationType } from "@prisma/client";
import { auth } from "@/auth";
import { PageHeading } from "@/components/layout/page-heading";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";
import { NotificationRow } from "@/components/notifications/notification-row";
import { EmptyState } from "@/components/ui/foundations";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 20;

const TABS = [
  { key: "all", label: "All", types: null },
  { key: "replies", label: "Replies", types: ["REPLY", "REACTION", "MENTION"] },
  { key: "predictions", label: "Predictions", types: ["PREDICTION"] },
  { key: "games", label: "Games", types: ["GAME"] },
  { key: "communities", label: "Communities", types: ["COMMUNITY", "DEBATE"] },
  { key: "safety", label: "Safety", types: ["MODERATION"] },
] as const satisfies readonly {
  key: string;
  label: string;
  types: readonly NotificationType[] | null;
}[];

const MODERATION_LABELS: Record<string, string> = {
  REMOVE_CONTENT: "Your content was removed",
  WARN_USER: "You received a warning",
  TEMPORARY_MUTE: "Your account was temporarily muted",
  BAN_USER: "Your account was suspended",
  RESTORE_CONTENT: "Your content was restored",
};

type NotificationRowData = Notification & {
  actor: { displayName: string } | null;
};

function describe(n: NotificationRowData): {
  message: string;
  detail?: string;
} {
  const actorName = n.actor?.displayName ?? "Someone";
  switch (n.type) {
    case "FOLLOW":
      return { message: `${actorName} followed you` };
    case "REPLY":
      return { message: `${actorName} replied to your take` };
    case "REACTION":
      return { message: `${actorName} reacted to your take` };
    case "MENTION":
      return { message: `${actorName} mentioned you` };
    case "DEBATE":
      return { message: `${actorName} started a debate` };
    case "COMMUNITY":
      return { message: "New activity in a community you follow" };
    case "GAME":
      return { message: "A game you follow has an update" };
    case "PREDICTION":
      return { message: "Your prediction was resolved" };
    case "BADGE":
      return { message: "You earned a badge" };
    case "MODERATION": {
      const payload = n.payload as { action?: string; reason?: string };
      return {
        message:
          (payload.action && MODERATION_LABELS[payload.action]) ||
          "Account notice",
        detail: payload.reason,
      };
    }
    default:
      return { message: (n.type as string).replaceAll("_", " ") };
  }
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; cursor?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in?callbackUrl=/notifications");
  const { tab: rawTab, cursor } = await searchParams;
  const tab = TABS.find((t) => t.key === rawTab) ?? TABS[0];

  const [items, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: {
        recipientId: session.user.id,
        ...(tab.types ? { type: { in: [...tab.types] } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: { actor: { select: { displayName: true } } },
    }),
    db.notification.count({
      where: { recipientId: session.user.id, readAt: null },
    }),
  ]);
  const hasMore = items.length > PAGE_SIZE;
  const page = items.slice(0, PAGE_SIZE);

  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const groups: { label: string; items: NotificationRowData[] }[] = [
    { label: "Today", items: [] },
    { label: "Earlier this week", items: [] },
    { label: "Older", items: [] },
  ];
  for (const item of page) {
    const bucket =
      item.createdAt >= todayStart ? 0 : item.createdAt >= weekStart ? 1 : 2;
    groups[bucket]!.items.push(item);
  }

  return (
    <>
      <PageHeading
        eyebrow="Stay in the conversation"
        title="Notifications"
        description={`${unreadCount} unread`}
        action={<MarkAllReadButton unreadCount={unreadCount} />}
      />
      <nav
        aria-label="Notification categories"
        className="mb-6 flex flex-wrap gap-1"
      >
        {TABS.map(({ key, label }) => (
          <Link
            key={key}
            href={
              key === "all" ? "/notifications" : `/notifications?tab=${key}`
            }
            aria-current={tab.key === key ? "page" : undefined}
            className={`min-h-11 rounded-sm px-4 py-2 text-sm font-bold ${
              tab.key === key
                ? "bg-brand-surface text-brand-light"
                : "text-text-secondary hover:bg-surface-3"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {page.length ? (
        <div className="grid gap-6">
          {groups
            .filter((group) => group.items.length)
            .map((group) => (
              <section key={group.label}>
                <h2 className="text-text-secondary mb-2 text-sm font-bold tracking-wide uppercase">
                  {group.label}
                </h2>
                <div className="grid gap-2">
                  {group.items.map((item) => {
                    const { message, detail } = describe(item);
                    return (
                      <NotificationRow
                        key={item.id}
                        id={item.id}
                        href={item.href}
                        message={message}
                        detail={detail}
                        createdAt={item.createdAt.toISOString()}
                        read={Boolean(item.readAt)}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          {hasMore && (
            <Link
              href={`/notifications?tab=${tab.key}&cursor=${page[page.length - 1]!.id}`}
              className="text-brand text-sm font-bold hover:underline"
            >
              Load more
            </Link>
          )}
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
