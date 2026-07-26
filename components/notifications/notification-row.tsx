"use client";
import Link from "next/link";
import { Card } from "@/components/ui/foundations";

export function NotificationRow({
  id,
  href,
  message,
  detail,
  createdAt,
  read,
}: {
  id: string;
  href: string;
  message: string;
  detail?: string;
  createdAt: string;
  read: boolean;
}) {
  function markRead() {
    // Fire-and-forget: the doc only requires the read state land after a
    // real navigation intent (this click), not that navigation wait on it.
    void fetch("/api/v1/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ notificationId: id }),
    });
  }
  return (
    <Link href={href} onClick={read ? undefined : markRead}>
      <Card className={read ? "opacity-70" : "border-brand/50"}>
        <div className="flex justify-between gap-4">
          <div>
            <p className="font-bold">
              {!read && (
                <span className="sr-only">Unread: </span>
              )}
              {message}
            </p>
            {detail && (
              <p className="text-text-secondary mt-1 text-sm">{detail}</p>
            )}
          </div>
          <time className="text-text-muted shrink-0 text-xs">{createdAt}</time>
        </div>
      </Card>
    </Link>
  );
}
