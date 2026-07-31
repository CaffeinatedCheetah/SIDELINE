import type { Metadata } from "next";
import { PageHeading } from "@/components/layout/page-heading";
import { SearchPanel } from "@/components/search/search-panel";
import { fetchScoreboardsForTab } from "@/lib/sports/espn";

export const metadata: Metadata = {
  title: "Search",
  description: "Find teams, leagues, games, debates, takes, and Flash Threads.",
  // Every query variant is thin/personalized; only the bare route is worth
  // indexing (docs/pages/SEARCH.md: "Page and all query variants use
  // noindex; canonical is /search without query").
  robots: { index: false, follow: true },
  alternates: { canonical: "/search" },
};

// No search-query log exists anywhere in this schema, so there is no real
// signal to compute genuine "trending search terms" from -- confirmed via
// a full schema search. Rather than either building that (a real feature:
// a logging table + aggregation) or hardcoding fixed fake terms presented
// as if they reflect real activity, this derives real, verifiable,
// day-to-day-changing terms from today's actual live/upcoming ESPN
// schedule -- team names genuinely playing today, not invented ones.
// Falls back to a small static list only if that fetch comes back empty
// (explicitly authorized as a fallback, not the primary source).
const FALLBACK_TRENDING = ["NBA", "NFL", "MLB", "NHL", "Soccer"];

async function trendingSearchTerms(): Promise<string[]> {
  try {
    const games = await fetchScoreboardsForTab("ALL");
    const live = games.filter((g) => g.status === "LIVE");
    const source = live.length ? live : games;
    const names = source.flatMap((g) => [g.homeTeam.name, g.awayTeam.name]);
    const unique = [...new Set(names.filter(Boolean))].slice(0, 6);
    return unique.length ? unique : FALLBACK_TRENDING;
  } catch {
    return FALLBACK_TRENDING;
  }
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { q, type } = await searchParams;
  const trending = await trendingSearchTerms();
  return (
    <>
      <PageHeading
        eyebrow="Across FanTakes"
        title="Search"
        description="Find teams, leagues, games, debates, takes, and Flash Threads."
      />
      <SearchPanel
        initialQuery={q}
        initialType={type}
        trendingSearches={trending}
      />
    </>
  );
}
