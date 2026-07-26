import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveGameRoom } from "@/components/games/live-game-room";

afterEach(() => vi.unstubAllGlobals());

describe("LiveGameRoom", () => {
  it("shows the real score, period, and clock for a live game, not just a status label", () => {
    render(
      <LiveGameRoom
        gameId="game-1"
        initialStatus="LIVE"
        initialHomeScore={17}
        initialAwayScore={14}
        initialPeriod="3rd"
        initialClock="08:42"
      />,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("14–17");
    expect(status).toHaveTextContent("3rd 08:42");
  });

  it("renders nothing for a game that isn't live", () => {
    const { container } = render(
      <LiveGameRoom
        gameId="game-1"
        initialStatus="SCHEDULED"
        initialHomeScore={null}
        initialAwayScore={null}
        initialPeriod={null}
        initialClock={null}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
