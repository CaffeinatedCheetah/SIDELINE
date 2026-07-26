import type { Metadata } from "next";
import { PageHeading } from "@/components/layout/page-heading";
import { SearchPanel } from "@/components/search/search-panel";
export const metadata: Metadata = {
  title: "Search",
  description: "Find fans, games, communities, and debates.",
  // Every query variant is thin/personalized; only the bare route is worth
  // indexing (docs/pages/SEARCH.md: "Page and all query variants use
  // noindex; canonical is /search without query").
  robots: { index: false, follow: true },
  alternates: { canonical: "/search" },
};
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { q, type } = await searchParams;
  return (
    <>
      <PageHeading
        eyebrow="Across FanTakes"
        title="Search"
        description="Find fans, games, communities, and debates."
      />
      <SearchPanel initialQuery={q} initialType={type} />
    </>
  );
}
