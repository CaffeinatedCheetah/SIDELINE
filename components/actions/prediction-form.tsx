"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Radio } from "@/components/ui/form-controls";
import { apiAction } from "./api-action";
export function PredictionForm({
  gameId,
  homeTeam,
  awayTeam,
  locked,
}: {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  locked: boolean;
}) {
  const [selection, setSelection] = useState("");
  const [status, setStatus] = useState("");
  async function submit() {
    try {
      await apiAction("predictions", {
        gameId,
        selection,
        idempotencyKey: `prediction:${gameId}:${Date.now()}`,
      });
      setStatus("Prediction saved.");
    } catch (error) {
      if (error instanceof Error && error.message !== "AUTH_REQUIRED")
        setStatus(error.message);
    }
  }
  return (
    <fieldset
      disabled={locked}
      className="border-border-subtle bg-surface-1 rounded-md border p-5"
    >
      <legend className="font-display text-xl font-black">
        Pick the winner
      </legend>
      <Radio
        name="winner"
        value="away"
        label={awayTeam}
        checked={selection === "away"}
        onChange={() => setSelection("away")}
      />
      <Radio
        name="winner"
        value="home"
        label={homeTeam}
        checked={selection === "home"}
        onChange={() => setSelection("home")}
      />
      <Button disabled={!selection || locked} type="button" onClick={submit}>
        {locked ? "Predictions locked" : "Save prediction"}
      </Button>
      {status && (
        <p role="status" className="mt-2 text-sm">
          {status}
        </p>
      )}
    </fieldset>
  );
}
