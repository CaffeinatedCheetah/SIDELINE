"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/form-controls";
import { Skeleton } from "@/components/ui/foundations";

type GameResult = {
  id: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
  league: { abbreviation: string };
};
type Results = {
  users: Array<{ handle: string; displayName: string }>;
  teams: Array<{
    id: string;
    name: string;
    city: string | null;
    abbreviation: string;
    league: { key: string; abbreviation: string };
  }>;
  leagues: Array<{
    key: string;
    name: string;
    abbreviation: string;
    sport: { name: string };
  }>;
  games: GameResult[];
  communities: Array<{ slug: string; name: string }>;
  debates: Array<{ slug: string; title: string }>;
  takes: Array<{
    id: string;
    body: string;
    gameId: string | null;
    debate: { slug: string } | null;
    community: { slug: string } | null;
    author: { handle: string; displayName: string };
  }>;
  flashThreads: Array<{
    id: string;
    gameId: string;
    title: string;
    game: {
      league: { abbreviation: string };
      homeTeam: { abbreviation: string };
      awayTeam: { abbreviation: string };
    };
  }>;
};
const empty: Results = {
  users: [],
  teams: [],
  leagues: [],
  games: [],
  communities: [],
  debates: [],
  takes: [],
  flashThreads: [],
};

const TYPES = [
  { key: "all", label: "All" },
  { key: "games", label: "Games" },
  { key: "teams", label: "Teams" },
  { key: "leagues", label: "Leagues" },
  { key: "debates", label: "Debates" },
  { key: "takes", label: "Takes" },
  { key: "flash-threads", label: "Flash Threads" },
  { key: "communities", label: "Communities" },
  { key: "people", label: "People" },
] as const;
type SearchType = (typeof TYPES)[number]["key"];

const RECENT_KEY = "fantakes:recent-searches";

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}
function writeRecent(next: string[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export function SearchPanel({
  initialQuery = "",
  initialType = "all",
  trendingSearches = [],
}: {
  initialQuery?: string;
  initialType?: string;
  trendingSearches?: string[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialQuery);
  const [committedQuery, setCommittedQuery] = useState(initialQuery);
  const type: SearchType = TYPES.some((t) => t.key === initialType)
    ? (initialType as SearchType)
    : "all";
  const [results, setResults] = useState(empty);
  const [loading, setLoading] = useState(false);
  // Server has no localStorage, so this starts empty and hydrates
  // client-side (deferred a microtask so it isn't a same-tick setState
  // call inside the effect body, same reasoning as runSearch below).
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    void Promise.resolve().then(() => setRecent(readRecent()));
  }, []);

  async function runSearch(value: string, signal?: AbortSignal) {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/v1/search?q=${encodeURIComponent(value)}&type=${type}`,
        { signal },
      );
      const body = (await response.json()) as { data: Results };
      setResults(body.data ?? empty);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setResults(empty);
      }
    } finally {
      setLoading(false);
    }
  }

  // Debounced live preview as the user types -- does not touch the URL.
  // Submitting (Enter, the Search button, or picking a recent search) is
  // what commits a query to the URL, per the design doc's two-tier model:
  // "Submit or 300ms debounced suggestions ... full results require
  // submission and URL update." Results simply aren't rendered below the
  // doc-specified 2-char minimum (see showEmptyQuery), so there's nothing
  // to clear here.
  useEffect(() => {
    if (draft.trim().length < 2) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      void runSearch(draft, controller.signal);
    }, 300);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // Re-run whenever the committed URL state changes (including on initial
  // load with a query already in the URL, and on browser back/forward).
  useEffect(() => {
    if (committedQuery.trim().length < 2) return;
    const controller = new AbortController();
    // Deferred a tick so runSearch's setState calls aren't synchronous
    // within the effect body itself (same reasoning as the debounce effect
    // above, which defers via setTimeout for an unrelated UX reason).
    void Promise.resolve().then(() =>
      runSearch(committedQuery, controller.signal),
    );
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committedQuery, type]);

  function commit(value: string) {
    const trimmed = value.trim();
    setCommittedQuery(trimmed);
    setDraft(trimmed);
    const params = new URLSearchParams();
    if (trimmed) params.set("q", trimmed);
    if (type !== "all") params.set("type", type);
    router.push(`/search${params.toString() ? `?${params}` : ""}`);
    if (trimmed.length >= 2) {
      const next = [
        trimmed,
        ...readRecent().filter((v) => v !== trimmed),
      ].slice(0, 5);
      writeRecent(next);
      setRecent(next);
    }
  }

  function changeType(nextType: SearchType) {
    const params = new URLSearchParams();
    if (committedQuery) params.set("q", committedQuery);
    if (nextType !== "all") params.set("type", nextType);
    router.push(`/search${params.toString() ? `?${params}` : ""}`);
  }

  function clearRecent() {
    localStorage.removeItem(RECENT_KEY);
    setRecent([]);
  }

  const showEmptyQuery = committedQuery.trim().length < 2;

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          commit(draft);
        }}
        className="flex gap-2"
      >
        <Input
          autoFocus
          aria-label="Search FanTakes"
          placeholder="Search teams, games, debates, takes, and leagues"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="submit"
          className="bg-brand min-h-11 shrink-0 rounded-sm px-4 font-bold"
        >
          Search
        </button>
      </form>
      <nav aria-label="Result type" className="mt-4 flex flex-wrap gap-1">
        {TYPES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={type === key}
            onClick={() => changeType(key)}
            className={`min-h-9 rounded-sm px-3 text-sm font-bold ${
              type === key
                ? "bg-brand-surface text-brand-light"
                : "text-text-secondary hover:bg-surface-3"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
      {showEmptyQuery && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">Recent searches</h2>
            {recent.length > 0 && (
              <button
                type="button"
                onClick={clearRecent}
                className="text-brand text-sm font-bold hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          {recent.length ? (
            <ul className="flex flex-wrap gap-2">
              {recent.map((value) => (
                <li key={value}>
                  <button
                    type="button"
                    onClick={() => commit(value)}
                    className="border-border-subtle bg-surface-1 hover:border-border-strong rounded-full border px-3 py-1.5 text-sm"
                  >
                    {value}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-muted text-sm">
              Search for teams, games, debates, takes, Flash Threads, or
              leagues.
            </p>
          )}
          {trendingSearches.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 font-bold">Trending searches</h2>
              <ul className="flex flex-wrap gap-2">
                {trendingSearches.map((value) => (
                  <li key={value}>
                    <button
                      type="button"
                      onClick={() => commit(value)}
                      className="border-border-subtle bg-surface-1 hover:border-border-strong rounded-full border px-3 py-1.5 text-sm"
                    >
                      {value}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {loading ? (
        <div className="mt-6 grid gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : (
        !showEmptyQuery && (
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="mt-6 grid gap-6"
          >
            {resultCount(results) === 0 ? (
              <p className="text-text-secondary">
                No results for &ldquo;{committedQuery}&rdquo;.
              </p>
            ) : (
              <>
                <p className="text-text-muted text-sm">
                  {resultCount(results)} result
                  {resultCount(results) === 1 ? "" : "s"} for &ldquo;
                  {committedQuery}&rdquo;
                </p>
                {results.users.length > 0 && (
                  <ResultSection title="People">
                    {results.users.map((user) => (
                      <ResultLink
                        key={user.handle}
                        href={`/users/${user.handle}`}
                        label={user.displayName}
                      />
                    ))}
                  </ResultSection>
                )}
                {results.games.length > 0 && (
                  <ResultSection title="Games">
                    {results.games.map((game) => (
                      <ResultLink
                        key={game.id}
                        href={`/games/${game.id}`}
                        label={`${game.league.abbreviation} · ${game.awayTeam.name} at ${game.homeTeam.name}`}
                      />
                    ))}
                  </ResultSection>
                )}
                {results.teams.length > 0 && (
                  <ResultSection title="Teams">
                    {results.teams.map((team) => (
                      <ResultLink
                        key={team.id}
                        href={`/games?league=${team.league.key}&team=${team.id}`}
                        label={`${team.name} · ${team.league.abbreviation}`}
                      />
                    ))}
                  </ResultSection>
                )}
                {results.leagues.length > 0 && (
                  <ResultSection title="Leagues">
                    {results.leagues.map((league) => (
                      <ResultLink
                        key={league.key}
                        href={`/leagues/${league.key}`}
                        label={`${league.name} · ${league.sport.name}`}
                      />
                    ))}
                  </ResultSection>
                )}
                {results.debates.length > 0 && (
                  <ResultSection title="Debates">
                    {results.debates.map((debate) => (
                      <ResultLink
                        key={debate.slug}
                        href={`/debates/${debate.slug}`}
                        label={debate.title}
                      />
                    ))}
                  </ResultSection>
                )}
                {results.communities.length > 0 && (
                  <ResultSection title="Communities">
                    {results.communities.map((community) => (
                      <ResultLink
                        key={community.slug}
                        href={`/communities/${community.slug}`}
                        label={community.name}
                      />
                    ))}
                  </ResultSection>
                )}
                {results.flashThreads.length > 0 && (
                  <ResultSection title="Flash Threads">
                    {results.flashThreads.map((thread) => (
                      <ResultLink
                        key={thread.id}
                        href={`/games/${thread.gameId}`}
                        label={`${thread.title} · ${thread.game.league.abbreviation}`}
                      />
                    ))}
                  </ResultSection>
                )}
                {results.takes.length > 0 && (
                  <ResultSection title="Takes">
                    {results.takes.map((take) => (
                      <ResultLink
                        key={take.id}
                        href={
                          take.gameId
                            ? `/games/${take.gameId}`
                            : take.debate
                              ? `/debates/${take.debate.slug}`
                              : take.community
                                ? `/communities/${take.community.slug}`
                                : `/users/${take.author.handle}`
                        }
                        label={`${take.body.slice(0, 120)} · ${take.author.displayName}`}
                      />
                    ))}
                  </ResultSection>
                )}
              </>
            )}
          </div>
        )
      )}
    </div>
  );
}

function resultCount(results: Results) {
  return (
    results.users.length +
    results.teams.length +
    results.leagues.length +
    results.games.length +
    results.communities.length +
    results.debates.length +
    results.takes.length +
    results.flashThreads.length
  );
}

function ResultSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display mb-2 text-xl font-black">{title}</h2>
      <ul className="grid gap-2">{children}</ul>
    </section>
  );
}

function ResultLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        className="border-border-subtle bg-surface-1 hover:border-border-strong block rounded-sm border p-3"
        href={href}
      >
        {label}
      </Link>
    </li>
  );
}
