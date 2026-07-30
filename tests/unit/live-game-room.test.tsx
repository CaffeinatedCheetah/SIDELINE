import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LiveGameRoom } from "@/components/games/live-game-room";

const defaults = {
  gameId: "5da674f6-4b03-4fa5-8644-263b0d64e35c",
  startsAt: "2026-07-29T00:10:00.000Z",
  homeTeam: {
    name: "Yankees",
    abbreviation: "NYY",
    logoUrl: null,
    primaryColor: "132448",
  },
  awayTeam: {
    name: "Red Sox",
    abbreviation: "BOS",
    logoUrl: null,
    primaryColor: "#bd3039",
  },
  venue: "Yankee Stadium",
  broadcast: ["ESPN"],
  initialDetail: null,
  initialProviderUpdatedAt: "2026-07-29T00:20:00.000Z",
  initialVersion: 2,
  initialFollowerCount: 12,
  initialFollowing: false,
  signedIn: false,
};

describe("LiveGameRoom", () => {
  it("shows the canonical score, phase, venue, broadcast, and honest following count", () => {
    render(
      <LiveGameRoom
        {...defaults}
        initialPhase="LIVE"
        initialHomeScore={17}
        initialAwayScore={14}
        initialPeriod="3rd"
        initialClock="08:42"
      />,
    );
    expect(screen.getByText("14–17")).toBeInTheDocument();
    expect(screen.getByText("Live · 3rd · 08:42")).toBeInTheDocument();
    expect(screen.getByText("Yankee Stadium")).toBeInTheDocument();
    expect(screen.getByText("ESPN")).toBeInTheDocument();
    expect(screen.getByText("12 fans following")).toBeInTheDocument();
    expect(screen.getByText("Score current")).toHaveAttribute(
      "aria-live",
      "polite",
    );
    expect(
      document.querySelector('[data-game-room-shell][data-game-phase="LIVE"]'),
    ).toBeInTheDocument();
  });

  it("keeps the room header visible before the game and offers sign-in to follow", () => {
    render(
      <LiveGameRoom
        {...defaults}
        initialPhase="SCHEDULED"
        initialHomeScore={null}
        initialAwayScore={null}
        initialPeriod={null}
        initialClock={null}
      />,
    );
    expect(screen.getByText("vs")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /follow game/i })).toHaveAttribute(
      "href",
      `/auth/sign-in?callbackUrl=/games/${defaults.gameId}`,
    );
  });

  it("keeps signed-in Follow behavior available in the redesigned shell", () => {
    render(
      <LiveGameRoom
        {...defaults}
        signedIn
        initialPhase="PREGAME"
        initialHomeScore={null}
        initialAwayScore={null}
        initialPeriod={null}
        initialClock={null}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Follow game" }),
    ).toBeInTheDocument();
  });
});
