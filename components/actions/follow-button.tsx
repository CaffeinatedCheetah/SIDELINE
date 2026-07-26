"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiAction } from "./api-action";
export function FollowButton({
  userId,
  initialFollowing = false,
}: {
  userId: string;
  initialFollowing?: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function toggle() {
    const next = !following;
    setFollowing(next);
    setLoading(true);
    setError("");
    try {
      await apiAction("follows", { userId, follow: next });
      router.refresh();
    } catch (value) {
      setFollowing(!next);
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
        variant={following ? "secondary" : "primary"}
        onClick={toggle}
      >
        {following ? "Following" : "Follow"}
      </Button>
      {error && (
        <p role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
