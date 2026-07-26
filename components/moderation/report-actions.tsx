"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { apiAction } from "@/components/actions/api-action";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/form-controls";

type ActionKind =
  | "REMOVE_CONTENT"
  | "RESTORE_CONTENT"
  | "WARN_USER"
  | "TEMPORARY_MUTE"
  | "BAN_USER"
  | "DISMISS";

const ACTION_LABELS: Record<ActionKind, string> = {
  REMOVE_CONTENT: "Remove content",
  RESTORE_CONTENT: "Restore content",
  WARN_USER: "Warn user",
  TEMPORARY_MUTE: "Mute user",
  BAN_USER: "Ban user",
  DISMISS: "Dismiss report",
};

export function ReportActions({
  reportId,
  targetType,
  targetId,
  contentRemoved,
}: {
  reportId: string;
  targetType: "TAKE" | "COMMENT" | "USER";
  targetId: string;
  contentRemoved?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<ActionKind | null>(null);
  const [reason, setReason] = useState("");
  const [durationHours, setDurationHours] = useState("24");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const availableActions: ActionKind[] =
    targetType === "USER"
      ? ["WARN_USER", "TEMPORARY_MUTE", "BAN_USER", "DISMISS"]
      : [
          contentRemoved ? "RESTORE_CONTENT" : "REMOVE_CONTENT",
          "WARN_USER",
          "TEMPORARY_MUTE",
          "BAN_USER",
          "DISMISS",
        ];

  function openDialog(action: ActionKind) {
    setError("");
    setReason("");
    setPending(action);
  }

  async function confirm() {
    if (!pending) return;
    setLoading(true);
    setError("");
    try {
      if (pending === "DISMISS") {
        await apiAction(`reports/${reportId}/dismiss`, {
          resolution: reason,
        });
      } else {
        await apiAction("moderation-actions", {
          reportId,
          targetType,
          targetId,
          action: pending,
          reason,
          ...(pending === "TEMPORARY_MUTE"
            ? {
                expiresAt: new Date(
                  Date.now() + Number(durationHours) * 3_600_000,
                ).toISOString(),
              }
            : {}),
        });
      }
      setPending(null);
      router.refresh();
    } catch (value) {
      if (value instanceof Error && value.message !== "AUTH_REQUIRED")
        setError(value.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {availableActions.map((action) => (
        <Button
          key={action}
          size="sm"
          variant={
            action === "BAN_USER" || action === "REMOVE_CONTENT"
              ? "danger"
              : "secondary"
          }
          onClick={() => openDialog(action)}
        >
          {ACTION_LABELS[action]}
        </Button>
      ))}
      <Dialog.Root
        open={pending !== null}
        onOpenChange={(next) => !next && setPending(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75" />
          <Dialog.Content className="border-border-strong bg-surface-2 fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 rounded-lg border p-5 shadow-2xl sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2">
            <Dialog.Title className="text-2xl font-bold">
              {pending && ACTION_LABELS[pending]}
            </Dialog.Title>
            <div className="mt-4 grid gap-4">
              <Field
                label={pending === "DISMISS" ? "Resolution note" : "Reason"}
                htmlFor="mod-reason"
                help="At least 5 characters -- this is recorded in the moderation log."
              >
                <Textarea
                  id="mod-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  minLength={5}
                  maxLength={500}
                />
              </Field>
              {pending === "TEMPORARY_MUTE" && (
                <Field label="Duration" htmlFor="mod-duration">
                  <Select
                    id="mod-duration"
                    value={durationHours}
                    onChange={(event) => setDurationHours(event.target.value)}
                  >
                    <option value="1">1 hour</option>
                    <option value="24">24 hours</option>
                    <option value="168">7 days</option>
                  </Select>
                </Field>
              )}
              {error && (
                <p role="alert" className="text-danger text-sm">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-3">
                <Dialog.Close asChild>
                  <Button variant="secondary">Cancel</Button>
                </Dialog.Close>
                <Button
                  variant={
                    pending === "BAN_USER" || pending === "REMOVE_CONTENT"
                      ? "danger"
                      : "primary"
                  }
                  loading={loading}
                  disabled={reason.trim().length < 5}
                  onClick={confirm}
                >
                  Confirm
                </Button>
              </div>
            </div>
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close dialog"
                className="absolute top-2 right-2"
              >
                <X aria-hidden className="size-5" />
              </Button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
