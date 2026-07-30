import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LeagueCard } from "@/components/leagues/league-card";
import { TeamDiscoveryGrid } from "@/components/teams/team-discovery-grid";
import { leagueTheme, sportPhaseLabel } from "@/lib/sports/presentation";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const teams = [
  {
    id: "1",
    name: "Detroit Lions",
    city: "Detroit",
    abbreviation: "DET",
    logoUrl: null,
    primaryColor: "#0076b6",
    league: { key: "nfl", name: "NFL", abbreviation: "NFL" },
  },
  {
    id: "2",
    name: "Boston Celtics",
    city: "Boston",
    abbreviation: "BOS",
    logoUrl: null,
    primaryColor: "#007a33",
    league: { key: "nba", name: "NBA", abbreviation: "NBA" },
  },
];

describe("premium league and team discovery UI", () => {
  it("renders a league identity card with only real supplied counts", () => {
    render(
      <LeagueCard
        league={{
          key: "nfl",
          name: "NFL",
          abbreviation: "NFL",
          sportKey: "football",
          sportName: "Football",
          teamCount: 32,
          liveGameCount: 2,
          followedTeamCount: 1,
        }}
      />,
    );
    const card = screen.getByRole("link", { name: /NFL league mark/i });
    expect(card).toHaveAttribute("href", "/leagues/nfl");
    expect(screen.getByText("32")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1 followed team")).toBeInTheDocument();
  });

  it("searches by city, name, and abbreviation", async () => {
    render(
      <TeamDiscoveryGrid teams={teams} followedTeamIds={[]} signedIn={false} />,
    );
    const search = screen.getByPlaceholderText(
      "Search city, team, or abbreviation",
    );
    await userEvent.type(search, "Detroit");
    expect(screen.getByText("Detroit Lions")).toBeInTheDocument();
    expect(screen.queryByText("Boston Celtics")).not.toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, "BOS");
    expect(screen.getByText("Boston Celtics")).toBeInTheDocument();
  });

  it("supports explicit league and My Teams filters with useful empty states", async () => {
    render(
      <TeamDiscoveryGrid teams={teams} followedTeamIds={["1"]} signedIn />,
    );
    await userEvent.click(screen.getByRole("button", { name: /NBA · NBA/i }));
    expect(screen.queryByText("Detroit Lions")).not.toBeInTheDocument();
    expect(screen.getByText("Boston Celtics")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "My Teams" }));
    expect(screen.getByText("No favorites here yet")).toBeInTheDocument();
  });

  it("formats sport phases without empty placeholders", () => {
    expect(
      sportPhaseLabel({
        sportKey: "football",
        period: "3rd Quarter",
        clock: "08:14",
      }),
    ).toBe("3rd Quarter · 08:14");
    expect(
      sportPhaseLabel({
        sportKey: "soccer",
        period: "First Half",
        clock: "38",
      }),
    ).toBe("38' · First Half");
    expect(sportPhaseLabel({ sportKey: "hockey" })).toBe("");
    expect(leagueTheme("nhl")).toMatchObject({
      "--league-primary": "#0891b2",
    });
  });
});
