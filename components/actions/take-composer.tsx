"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form-controls";
import { apiAction } from "./api-action";
export function TakeComposer({
  gameId,
  debateId,
  communityId,
  parentId,
  onPosted,
}: {
  gameId?: string;
  debateId?: string;
  communityId?: string;
  parentId?: string;
  onPosted?: () => void;
}) {
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
      });
      setBody("");
      setMessage("Posted.");
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
