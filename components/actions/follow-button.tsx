"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiAction } from "./api-action";
export function FollowButton({
  userId,
  initialFollowing = false,
  initialFollowerCount,
  mutual = false,
}: {
  userId: string;
  initialFollowing?: boolean;
  initialFollowerCount?: number;
  mutual?: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  async function toggle() {
    const next = !following;
    setFollowing(next);
    setFollowerCount((count) =>
      count === undefined ? count : Math.max(0, count + (next ? 1 : -1)),
    );
    setLoading(true);
    setError("");
    try {
      await apiAction("follows", { userId, follow: next });
      router.refresh();
    } catch (value) {
      setFollowing(!next);
      setFollowerCount(initialFollowerCount);
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
        disabled={loading}
        aria-pressed={following}
        variant={following ? "secondary" : "primary"}
        onClick={toggle}
      >
        {following ? "Following" : mutual ? "Follow back" : "Follow"}
        {followerCount === undefined ? "" : ` · ${followerCount}`}
      </Button>
      {error && (
        <p role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
