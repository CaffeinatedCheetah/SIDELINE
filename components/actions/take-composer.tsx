"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form-controls";
import { apiAction } from "./api-action";
export function TakeComposer({
  gameId,
  debateId,
  communityId,
  parentId,
  flashThreadId,
  onPosted,
}: {
  gameId?: string;
  debateId?: string;
  communityId?: string;
  parentId?: string;
  flashThreadId?: string;
  onPosted?: () => void;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await apiAction("takes", {
        body,
        gameId,
        debateId,
        communityId,
        parentId,
        flashThreadId,
      });
      setBody("");
      setMessage("Posted.");
      // The take lists on every page that renders this composer (game room,
      // debate detail, community detail, profile) are Server Components --
      // a successful client fetch alone never causes them to refetch. Without
      // this, a newly posted take is invisible until a manual page reload.
      router.refresh();
      onPosted?.();
    } catch (error) {
      if (error instanceof Error && error.message !== "AUTH_REQUIRED")
        setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="border-border-subtle bg-surface-1 rounded-md border p-4"
    >
      <label htmlFor="take-body" className="font-bold">
        Add your take
      </label>
      <Textarea
        id="take-body"
        className="mt-2"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={1000}
        required
        placeholder="Make a clear claim and explain why."
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-text-muted text-xs">{body.length}/1000</span>
        <Button loading={loading} disabled={!body.trim()} type="submit">
          Post take
        </Button>
      </div>
      {message && (
        <p role="status" className="text-text-secondary mt-2 text-sm">
          {message}
        </p>
      )}
    </form>
  );
}
