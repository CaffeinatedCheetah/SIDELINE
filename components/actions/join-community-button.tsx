"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/modal";
import { apiAction } from "./api-action";
export function JoinCommunityButton({
  communityId,
  initialJoined = false,
  size,
  /** When provided, joining requires confirming these rules first (matches
   * the design doc's "Join requires auth and rule acceptance"). Omit on
   * compact contexts like directory/homepage cards where rules text isn't
   * already loaded -- joining there stays a direct one-click action. */
  rules,
}: {
  communityId: string;
  initialJoined?: boolean;
  size?: "sm" | "md" | "lg";
  rules?: string;
}) {
  const [joined, setJoined] = useState(initialJoined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function toggle() {
    setLoading(true);
    setError("");
    try {
      await apiAction("community-membership", {
        communityId,
        join: !joined,
        notifications: true,
      });
      setJoined(!joined);
    } catch (value) {
      if (value instanceof Error && value.message !== "AUTH_REQUIRED")
        setError(value.message);
    } finally {
      setLoading(false);
    }
  }
  const button = (
    <Button
      loading={loading}
      variant={joined ? "secondary" : "primary"}
      size={size}
      {...(joined || !rules ? { onClick: toggle } : {})}
    >
      {joined ? "Leave community" : "Join community"}
    </Button>
  );
  return (
    <div>
      {!joined && rules ? (
        <ConfirmationDialog
          trigger={button}
          title="Community rules"
          description={rules}
          onConfirm={toggle}
        />
      ) : (
        button
      )}
      {error && (
        <p role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
