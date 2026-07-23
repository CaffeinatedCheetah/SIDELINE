"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";

import { apiAction } from "./api-action";

export function DebateComposer() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    const title = String(formData.get("title") ?? "").trim();
    const prompt = String(formData.get("prompt") ?? "").trim();
    const options = [
      String(formData.get("option1") ?? "").trim(),
      String(formData.get("option2") ?? "").trim(),
    ];
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
      <Field label="Option one" htmlFor="option1">
        <Input id="option1" name="option1" maxLength={80} required />
      </Field>
      <Field label="Option two" htmlFor="option2">
        <Input id="option2" name="option2" maxLength={80} required />
      </Field>
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
