"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";

type Value = "HELPFUL" | "NOT_HELPFUL";

export function RecapFeedback({
  artifactId,
  signedIn,
  initialValue,
}: {
  artifactId: string;
  signedIn: boolean;
  initialValue?: Value;
}) {
  const [value, setValue] = useState<Value | undefined>(initialValue);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(next: Value) {
    if (!signedIn) {
      window.location.href = `/auth/sign-in?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    const previous = value;
    setValue(next);
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/ai/artifacts/${artifactId}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: next }),
      });
      if (!response.ok) throw new Error("Feedback failed");
      setMessage("Thanks for the feedback.");
    } catch {
      setValue(previous);
      setMessage("Feedback could not be saved. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border-border-subtle mt-5 border-t pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">Was this recap helpful?</span>
        <button
          type="button"
          aria-pressed={value === "HELPFUL"}
          disabled={pending}
          onClick={() => submit("HELPFUL")}
          className="focus-ring border-border-subtle hover:border-brand-primary inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm transition disabled:opacity-60"
        >
          <ThumbsUp aria-hidden className="h-4 w-4" /> Helpful
        </button>
        <button
          type="button"
          aria-pressed={value === "NOT_HELPFUL"}
          disabled={pending}
          onClick={() => submit("NOT_HELPFUL")}
          className="focus-ring border-border-subtle hover:border-brand-primary inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm transition disabled:opacity-60"
        >
          <ThumbsDown aria-hidden className="h-4 w-4" /> Not helpful
        </button>
      </div>
      <p aria-live="polite" className="text-text-muted mt-2 text-xs">
        {pending ? "Saving feedback…" : message}
      </p>
    </div>
  );
}
