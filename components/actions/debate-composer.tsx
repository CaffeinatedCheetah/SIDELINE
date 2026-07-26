"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";

import { apiAction } from "./api-action";

const MIN_POSITIONS = 2;
const MAX_POSITIONS = 4;

export function DebateComposer() {
  const router = useRouter();
  const [positions, setPositions] = useState(["", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updatePosition(index: number, value: string) {
    setPositions((current) =>
      current.map((position, i) => (i === index ? value : position)),
    );
  }
  function addPosition() {
    if (positions.length < MAX_POSITIONS) setPositions((c) => [...c, ""]);
  }
  function removePosition(index: number) {
    if (positions.length > MIN_POSITIONS)
      setPositions((current) => current.filter((_, i) => i !== index));
  }

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    const title = String(formData.get("title") ?? "").trim();
    const prompt = String(formData.get("prompt") ?? "").trim();
    const options = positions.map((position) => position.trim());
    const slug = `${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")}-${crypto.randomUUID().slice(0, 8)}`;

    try {
      const debate = await apiAction<{ id: string }>("debates", {
        title,
        prompt,
        options,
        slug,
      });
      router.push(`/debates/${debate.id}`);
      router.refresh();
    } catch (value) {
      if (value instanceof Error && value.message !== "AUTH_REQUIRED")
        setError(value.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={submit} className="grid gap-4">
      <Field label="Question" htmlFor="title">
        <Input
          id="title"
          name="title"
          minLength={10}
          maxLength={140}
          required
        />
      </Field>
      <Field label="Context" htmlFor="prompt">
        <Textarea
          id="prompt"
          name="prompt"
          minLength={20}
          maxLength={2000}
          required
        />
      </Field>
      <fieldset className="grid gap-3">
        <legend className="font-bold">
          Positions ({MIN_POSITIONS}–{MAX_POSITIONS})
        </legend>
        {positions.map((position, index) => (
          <div key={index} className="flex items-end gap-2">
            <div className="flex-1">
              <Field
                label={`Option ${index + 1}`}
                htmlFor={`option${index + 1}`}
              >
                <Input
                  id={`option${index + 1}`}
                  value={position}
                  onChange={(event) =>
                    updatePosition(index, event.target.value)
                  }
                  maxLength={80}
                  required
                />
              </Field>
            </div>
            {positions.length > MIN_POSITIONS && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => removePosition(index)}
                aria-label={`Remove option ${index + 1}`}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
        {positions.length < MAX_POSITIONS && (
          <Button type="button" variant="secondary" onClick={addPosition}>
            Add another position
          </Button>
        )}
      </fieldset>
      <Button loading={loading} type="submit">
        Publish debate
      </Button>
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
