"use client";

import { useEffect, useId, useState } from "react";

import { Avatar } from "@/components/ui/foundations";
import { Textarea } from "@/components/ui/form-controls";

type Person = { handle: string; displayName: string; image?: string | null };

export function MentionTextarea({
  value,
  onChange,
  ...props
}: Omit<React.ComponentProps<typeof Textarea>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  const listId = useId();
  const [people, setPeople] = useState<Person[]>([]);
  const query = value.match(/(?:^|\s)@([a-z0-9-]{2,30})$/i)?.[1] ?? "";

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const response = await fetch(
        `/api/v1/search?q=${encodeURIComponent(query)}&type=people`,
        { signal: controller.signal },
      );
      if (!response.ok) return;
      const payload = (await response.json()) as {
        data?: { users?: Person[] };
      };
      setPeople(payload.data?.users ?? []);
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function choose(handle: string) {
    onChange(value.replace(/@([a-z0-9-]{2,30})$/i, `@${handle} `));
    setPeople([]);
  }

  return (
    <div className="relative">
      <Textarea
        {...props}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-autocomplete="list"
        aria-controls={people.length ? listId : undefined}
      />
      {query && people.length ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Mention a fan"
          className="border-border-strong bg-surface-2 absolute z-20 mt-1 grid w-full gap-1 rounded-xl border p-1 shadow-xl"
        >
          {people.map((person) => (
            <button
              key={person.handle}
              type="button"
              role="option"
              aria-selected="false"
              onClick={() => choose(person.handle)}
              className="hover:bg-surface-3 focus-visible:ring-focus flex min-h-11 items-center gap-2 rounded-lg px-3 text-left focus-visible:ring-2 focus-visible:outline-none"
            >
              <Avatar name={person.displayName} src={person.image} size="sm" />
              <span>
                <strong className="block text-sm">{person.displayName}</strong>
                <span className="text-text-muted text-xs">
                  @{person.handle}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
