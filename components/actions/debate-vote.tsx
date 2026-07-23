"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Radio } from "@/components/ui/form-controls";
import { apiAction } from "./api-action";
export function DebateVote({
  debateId,
  options,
}: {
  debateId: string;
  options: readonly { id: string; label: string }[];
}) {
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  async function vote() {
    setLoading(true);
    setStatus("");
    try {
      await apiAction("votes", { debateId, optionId: selected });
      setStatus("Vote counted.");
    } catch (error) {
      if (error instanceof Error && error.message !== "AUTH_REQUIRED")
        setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <fieldset className="grid gap-2">
      <legend className="font-display mb-2 text-xl font-black">
        Choose your position
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
        disabled={!selected}
        type="button"
        onClick={vote}
      >
        Cast vote
      </Button>
      {status && (
        <p role="status" className="text-text-secondary text-sm">
          {status}
        </p>
      )}
    </fieldset>
  );
}
