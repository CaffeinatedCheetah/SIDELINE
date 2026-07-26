"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiAction } from "@/components/actions/api-action";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/modal";

// Doc: "Mark all read confirms for large count." No exact number is
// specified -- picked a reasonable threshold and flagging it as inferred.
const CONFIRM_THRESHOLD = 10;

export function MarkAllReadButton({ unreadCount }: { unreadCount: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function markAll() {
    setLoading(true);
    try {
      await apiAction("notifications/read-all", {});
      router.refresh();
    } finally {
      setLoading(false);
    }
  }
  const trigger = (
    <Button variant="secondary" loading={loading} disabled={unreadCount === 0}>
      Mark all read
    </Button>
  );
  if (unreadCount < CONFIRM_THRESHOLD)
    return (
      <Button
        variant="secondary"
        loading={loading}
        disabled={unreadCount === 0}
        onClick={markAll}
      >
        Mark all read
      </Button>
    );
  return (
    <ConfirmationDialog
      trigger={trigger}
      title={`Mark all ${unreadCount} notifications read?`}
      description="This can't be undone individually -- you'd need to reopen each one to mark it unread again."
      onConfirm={markAll}
    />
  );
}
