import type { Metadata } from "next";
import { PageHeading } from "@/components/layout/page-heading";
import { SearchPanel } from "@/components/search/search-panel";
export const metadata: Metadata = {
  title: "Search",
  description: "Find fans, teams, games, communities, debates, and takes.",
};
export default function SearchPage() {
  return (
    <>
      <PageHeading
        eyebrow="Across FanTakes"
        title="Search"
        description="Find fans, teams, games, communities, debates, and takes."
      />
      <SearchPanel />
    </>
  );
}
