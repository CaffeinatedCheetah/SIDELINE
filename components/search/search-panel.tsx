"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/form-controls";
import { Skeleton } from "@/components/ui/foundations";
type Results = {
  users: Array<{ handle: string; displayName: string }>;
  teams: Array<{ id: string; name: string }>;
  communities: Array<{ slug: string; name: string }>;
  debates: Array<{ slug: string; title: string }>;
  takes: Array<{ id: string; body: string }>;
};
const empty: Results = {
  users: [],
  teams: [],
  communities: [],
  debates: [],
  takes: [],
};
export function SearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(empty);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (query.trim().length < 2) {
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/v1/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        const body = (await response.json()) as { data: Results };
        setResults(body.data ?? empty);
        const recent = JSON.parse(
          localStorage.getItem("fantakes:recent-searches") ?? "[]",
        ) as string[];
        localStorage.setItem(
          "fantakes:recent-searches",
          JSON.stringify(
            [query, ...recent.filter((value) => value !== query)].slice(0, 5),
          ),
        );
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);
  return (
    <div>
      <Input
        autoFocus
        aria-label="Search FanTakes"
        placeholder="Search fans, teams, games, communities, debates, and takes"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {loading ? (
        <div className="mt-6 grid gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : (
        <div className="mt-6 grid gap-6">
          {Object.entries(query.trim().length < 2 ? empty : results).map(
            ([type, items]) =>
              items.length ? (
                <section key={type}>
                  <h2 className="font-display mb-2 text-xl font-black capitalize">
                    {type}
                  </h2>
                  <ul className="grid gap-2">
                    {items.map((item) => (
                      <li
                        key={String(
                          ("id" in item && item.id) ||
                            ("slug" in item && item.slug) ||
                            ("handle" in item && item.handle),
                        )}
                      >
                        <Link
                          className="border-border-subtle bg-surface-1 hover:border-border-strong block rounded-sm border p-3"
                          href={href(type, item)}
                        >
                          {label(item)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null,
          )}
        </div>
      )}
    </div>
  );
}
function label(value: Record<string, unknown>) {
  return String(value.displayName ?? value.name ?? value.title ?? value.body);
}
function href(type: string, value: Record<string, unknown>) {
  if (type === "users") return `/users/${value.handle}`;
  if (type === "communities") return `/communities/${value.slug}`;
  if (type === "debates") return `/debates/${value.slug}`;
  if (type === "takes") return `/takes/${value.id}`;
  return "/games";
}
