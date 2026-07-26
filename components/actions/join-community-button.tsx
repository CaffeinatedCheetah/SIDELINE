"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiAction } from "./api-action";
export function JoinCommunityButton({
  communityId,
  initialJoined = false,
  size,
}: {
  communityId: string;
  initialJoined?: boolean;
  size?: "sm" | "md" | "lg";
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
  return (
    <div>
      <Button
        loading={loading}
        variant={joined ? "secondary" : "primary"}
        size={size}
        onClick={toggle}
      >
        {joined ? "Leave community" : "Join community"}
      </Button>
      {error && (
        <p role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
