"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiAction } from "@/components/actions/api-action";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/foundations";

export function ManagedUserList({
  resource,
  users,
  emptyTitle,
  emptyDescription,
}: {
  resource: "blocks" | "mutes";
  users: { id: string; handle: string; displayName: string }[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);
  async function remove(userId: string) {
    setRemovingId(userId);
    try {
      await apiAction(
        resource,
        resource === "blocks"
          ? { userId, block: false }
          : { userId, mute: false },
      );
      router.refresh();
    } finally {
      setRemovingId(null);
    }
  }
  if (!users.length)
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return (
    <ul className="grid gap-2">
      {users.map((user) => (
        <li
          key={user.id}
          className="border-border-subtle flex items-center justify-between gap-3 rounded-md border p-3"
        >
          <Link
            href={`/u/${user.handle}`}
            className="font-bold hover:underline"
          >
            {user.displayName}
          </Link>
          <Button
            variant="secondary"
            size="sm"
            loading={removingId === user.id}
            onClick={() => remove(user.id)}
          >
            Remove
          </Button>
        </li>
      ))}
    </ul>
  );
}
