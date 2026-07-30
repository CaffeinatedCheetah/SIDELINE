import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MySidelineSection } from "@/components/home/my-sideline-section";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const team = {
  id: "5da674f6-4b03-4fa5-8644-263b0d64e35c",
  name: "Detroit Testers",
  abbreviation: "DET",
  logoUrl: null,
  primaryColor: "#2563eb",
  league: { key: "nfl", abbreviation: "NFL" },
};

const game = {
  id: "ac348302-8e2d-4bb3-89a2-6ac48e108f5f",
  leagueId: "7d9abfc9-d3af-4b91-856d-135a74c3a8db",
  homeTeamId: team.id,
  awayTeamId: "ac3ef35d-73ca-49bc-8187-51238ac4ad56",
  providerRef: "fixture-game",
  provider: "fixture",
  providerState: "in_progress",
  providerPayloadVersion: "1",
  providerSchemaVersion: "1",
  providerAdapterVersion: "1",
  season: "2026",
  competitionDate: new Date("2026-09-10T00:00:00.000Z"),
  scheduledAt: new Date("2026-09-10T00:00:00.000Z"),
  status: "LIVE" as const,
  homeScore: 14,
  awayScore: 10,
  period: "3rd",
  clock: "08:12",
  statusDetail: "3rd 08:12",
  venue: "Test Field",
  broadcast: "FOX",
  providerUpdatedAt: new Date("2026-09-10T01:00:00.000Z"),
  lastProviderUpdateAt: new Date("2026-09-10T01:00:00.000Z"),
  lastSyncedAt: new Date("2026-09-10T01:00:00.000Z"),
  startedAt: new Date("2026-09-10T00:00:00.000Z"),
  endedAt: null,
  version: 1,
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-10T01:00:00.000Z"),
  league: {
    id: "7d9abfc9-d3af-4b91-856d-135a74c3a8db",
    sportId: "8a9e02ee-af0a-4c68-b47a-012b288b2fbe",
    key: "nfl",
    name: "National Football League",
    abbreviation: "NFL",
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  homeTeam: {
    ...team,
    leagueId: "7d9abfc9-d3af-4b91-856d-135a74c3a8db",
    key: "det",
    city: "Detroit",
    secondaryColor: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  awayTeam: {
    id: "ac3ef35d-73ca-49bc-8187-51238ac4ad56",
    leagueId: "7d9abfc9-d3af-4b91-856d-135a74c3a8db",
    key: "chi",
    name: "Chicago Testers",
    abbreviation: "CHI",
    city: "Chicago",
    logoUrl: null,
    primaryColor: "#ef4444",
    secondaryColor: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  _count: { takes: 4, follows: 0 },
};

const empty = {
  liveGames: [],
  upcomingGames: [],
  recentGames: [],
  flashThreads: [],
};

describe("MySidelineSection", () => {
  it("shows truthful signed-out discovery without fake personalization", () => {
    render(<MySidelineSection signedIn={false} teams={[]} {...empty} />);
    expect(screen.getByText("Make SIDELINE yours")).toBeInTheDocument();
    expect(screen.queryByText("Personalized for you")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/auth/sign-in?callbackUrl=%2F",
    );
  });

  it("shows the signed-in no-follow onboarding state", () => {
    render(<MySidelineSection signedIn teams={[]} {...empty} />);
    expect(screen.getByText("Build your SIDELINE")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Choose teams" })).toHaveAttribute(
      "href",
      "/teams",
    );
  });

  it("renders followed teams and only the supplied personalized games", () => {
    render(
      <MySidelineSection
        signedIn
        teams={[team]}
        liveGames={[game]}
        upcomingGames={[]}
        recentGames={[]}
        flashThreads={[]}
      />,
    );
    expect(screen.getByText("Personalized for you")).toBeInTheDocument();
    expect(screen.getAllByText("Detroit Testers")).toHaveLength(2);
    expect(screen.getByText("Live for You")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Open Chicago Testers at Detroit Testers"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Coming Up")).not.toBeInTheDocument();
  });
});
