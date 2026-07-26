"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Share2 } from "lucide-react";
import { apiAction } from "@/components/actions/api-action";
import { Button } from "@/components/ui/button";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { ConfirmationDialog } from "@/components/ui/modal";
export function ProfileActionsMenu({
  userId,
  initialBlocked = false,
  initialMuted = false,
}: {
  userId: string;
  initialBlocked?: boolean;
  initialMuted?: boolean;
}) {
  const router = useRouter();
  const [shared, setShared] = useState(false);
  const [blocked, setBlocked] = useState(initialBlocked);
  const [muted, setMuted] = useState(initialMuted);
  const [error, setError] = useState("");

  async function share() {
    await navigator.clipboard.writeText(window.location.href);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  }
  async function toggleBlock() {
    const next = !blocked;
    setError("");
    try {
      await apiAction("blocks", { userId, block: next });
      setBlocked(next);
      router.refresh();
    } catch (value) {
      if (value instanceof Error && value.message !== "AUTH_REQUIRED")
        setError(value.message);
    }
  }
  async function toggleMute() {
    const next = !muted;
    setError("");
    try {
      await apiAction("mutes", { userId, mute: next });
      setMuted(next);
    } catch (value) {
      if (value instanceof Error && value.message !== "AUTH_REQUIRED")
        setError(value.message);
    }
  }
  async function report() {
    setError("");
    try {
      await apiAction("reports", {
        targetType: "USER",
        targetId: userId,
        reason: "Reported from profile",
      });
    } catch (value) {
      if (value instanceof Error && value.message !== "AUTH_REQUIRED")
        setError(value.message);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        aria-label={shared ? "Link copied" : "Copy link to this profile"}
        onClick={share}
      >
        <Share2 aria-hidden className="size-5" />
      </Button>
      <Dropdown>
        <DropdownTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="More actions">
            <MoreHorizontal aria-hidden className="size-5" />
          </Button>
        </DropdownTrigger>
        <DropdownContent>
          <DropdownItem onSelect={report}>Report</DropdownItem>
          <DropdownItem onSelect={toggleMute}>
            {muted ? "Unmute" : "Mute"}
          </DropdownItem>
          {blocked ? (
            <DropdownItem onSelect={toggleBlock}>Unblock</DropdownItem>
          ) : (
            <ConfirmationDialog
              trigger={
                <DropdownItem onSelect={(event) => event.preventDefault()}>
                  Block
                </DropdownItem>
              }
              title="Block this account?"
              description="They won't be able to follow you and any existing follow between you is removed. You can unblock them anytime."
              danger
              onConfirm={toggleBlock}
            />
          )}
        </DropdownContent>
      </Dropdown>
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
