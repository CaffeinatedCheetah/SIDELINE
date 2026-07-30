"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { apiAction } from "@/components/actions/api-action";
import { Button, buttonStyles } from "@/components/ui/button";

type TeamFollowResult = {
  teamId: string;
  following: boolean;
  followerCount: number;
};

export function TeamFollowButton({
  teamId,
  initialFollowing = false,
  signedIn,
  callbackUrl,
  size = "sm",
}: {
  teamId: string;
  initialFollowing?: boolean;
  signedIn: boolean;
  callbackUrl: string;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  if (!signedIn) {
    return (
      <Link
        href={`/auth/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`}
        className={buttonStyles({ size, variant: "secondary" })}
      >
        Follow
      </Link>
    );
  }

  async function toggle() {
    if (pending) return;
    const previous = following;
    const next = !previous;
    setFollowing(next);
    setPending(true);
    setError("");
    try {
      const result = await apiAction<TeamFollowResult>("team-follows", {
        teamId,
        follow: next,
      });
      setFollowing(result.following);
      router.refresh();
    } catch (value) {
      setFollowing(previous);
      if (value instanceof Error && value.message !== "AUTH_REQUIRED")
        setError(value.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid justify-items-start gap-1">
      <Button
        type="button"
        size={size}
        loading={pending}
        aria-pressed={following}
        onClick={toggle}
        variant={following ? "secondary" : "primary"}
      >
        {pending ? "Saving" : following ? "Following" : "Follow"}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {pending
          ? "Updating team follow"
          : following
            ? "Team followed"
            : "Team not followed"}
      </span>
      {error ? (
        <p role="alert" className="text-danger max-w-48 text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
