"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Radio } from "@/components/ui/form-controls";
import { apiAction } from "./api-action";
export function DebateVote({
  debateId,
  options,
  initialSelected,
  disabled = false,
}: {
  debateId: string;
  options: readonly { id: string; label: string }[];
  initialSelected?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(initialSelected ?? "");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const hasVoted = Boolean(initialSelected);
  async function vote() {
    setLoading(true);
    setStatus("");
    try {
      await apiAction("votes", { debateId, optionId: selected });
      setStatus(hasVoted ? "Position updated." : "Vote counted.");
      // Position totals below are rendered by the Server Component parent
      // from the initial request; without this the new/changed vote is
      // invisible until a manual reload.
      router.refresh();
    } catch (error) {
      if (error instanceof Error && error.message !== "AUTH_REQUIRED")
        setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="font-display mb-2 text-xl font-black">
        {hasVoted ? "Your position" : "Choose your position"}
      </legend>
      {options.map((option) => (
        <Radio
          key={option.id}
          name="debate-option"
          label={option.label}
          value={option.id}
          checked={selected === option.id}
          onChange={() => setSelected(option.id)}
        />
      ))}
      <Button
        loading={loading}
        disabled={!selected || selected === initialSelected}
        type="button"
        onClick={vote}
      >
        {hasVoted ? "Change position" : "Cast vote"}
      </Button>
      {status && (
        <p role="status" className="text-text-secondary text-sm">
          {status}
        </p>
      )}
    </fieldset>
  );
}
