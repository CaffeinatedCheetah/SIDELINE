import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GameCard } from "@/components/games/game-card";

describe("GameCard", () => {
  it("shows team logos when provided", () => {
    render(
      <GameCard
        id="g1"
        league="NFL"
        homeTeam="Lions"
        awayTeam="Bears"
        homeTeamLogo="/lions.png"
        awayTeamLogo="/bears.png"
        status="SCHEDULED"
        statusText="SCHEDULED"
        scheduledAt="2026-08-01T18:00:00.000Z"
      />,
    );
    // Team crests are decorative (aria-hidden) so they don't belong in the
    // accessible tree -- query the DOM directly instead of by role.
    const images = Array.from(document.querySelectorAll("img"));
    expect(images.map((img) => img.getAttribute("src"))).toEqual([
      "/bears.png",
      "/lions.png",
    ]);
  });

  it("shows a real start time for a game with no score yet, instead of a bare icon", () => {
    render(
      <GameCard
        id="g1"
        league="NFL"
        homeTeam="Lions"
        awayTeam="Bears"
        status="SCHEDULED"
        statusText="SCHEDULED"
        scheduledAt="2026-08-01T18:00:00.000Z"
      />,
    );
    // <time> has no implicit ARIA role, so query it directly.
    const timeEl = document.querySelector("time");
    expect(timeEl).not.toBeNull();
    expect(timeEl).toHaveAttribute("datetime", "2026-08-01T18:00:00.000Z");
    expect(timeEl?.textContent?.trim()).not.toBe("");
  });

  it("routes a real Prisma id straight to /games/[id]", () => {
    render(
      <GameCard
        id="real-uuid-123"
        league="NFL"
        homeTeam="Lions"
        awayTeam="Bears"
        status="SCHEDULED"
        statusText="SCHEDULED"
      />,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/games/real-uuid-123",
    );
  });

  it("routes an ESPN team-sport id through the materialization resolver", () => {
    render(
      <GameCard
        id="espn-nba-401898716"
        league="NBA"
        homeTeam="Lakers"
        awayTeam="Kings"
        status="SCHEDULED"
        statusText="SCHEDULED"
        scheduledAt="2026-07-28T23:00:00.000Z"
      />,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/games/from-espn/nba/401898716?date=2026-07-28",
    );
  });

  it("renders no link at all for an ESPN fighter-sport id (UFC has nothing to materialize into)", () => {
    render(
      <GameCard
        id="espn-ufc-600054321"
        league="UFC"
        homeTeam="Fighter A"
        awayTeam="Fighter B"
        status="FINAL"
        statusText="Final"
      />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
