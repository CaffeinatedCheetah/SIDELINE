import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GameMomentsPanel } from "@/components/games/game-moments-panel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const moment = {
  id: "moment-1",
  type: "LEAD_CHANGE",
  title: "Tigers hit a go-ahead two-run home run",
  description: null,
  period: "Bottom 5th",
  clock: null,
  homeScore: 2,
  awayScore: 1,
  importance: 90,
  occurredAt: "2026-07-30T00:22:00.000Z",
};

describe("GameMomentsPanel", () => {
  it("renders a real active Flash Thread, aggregates, composer, and timeline", () => {
    render(
      <GameMomentsPanel
        gameId="game-1"
        phase="LIVE"
        initialMoments={[moment]}
        initialThreads={[
          {
            id: "thread-1",
            title: moment.title,
            status: "ACTIVE",
            moment,
            takes: [],
            takeCount: 0,
            reactionCount: 0,
            replyCount: 0,
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("heading", { name: moment.title }),
    ).toBeInTheDocument();
    expect(screen.getByText("Bottom 5th · 1–2")).toBeInTheDocument();
    expect(screen.getByLabelText("Add your take")).toBeInTheDocument();
    expect(screen.getByText("0 Takes")).toBeInTheDocument();
  });

  it("shows a truthful empty state without fabricated activity", () => {
    render(
      <GameMomentsPanel
        gameId="game-1"
        phase="SCHEDULED"
        initialMoments={[]}
        initialThreads={[]}
      />,
    );
    expect(screen.getByText("No major moments yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Major game moments will appear here as the action unfolds.",
      ),
    ).toBeInTheDocument();
  });

  it("preserves an archived Flash Thread without allowing new Takes", () => {
    render(
      <GameMomentsPanel
        gameId="game-1"
        phase="FINAL"
        initialMoments={[moment]}
        initialThreads={[
          {
            id: "thread-1",
            title: moment.title,
            status: "ARCHIVED",
            moment,
            takes: [],
            takeCount: 0,
            reactionCount: 0,
            replyCount: 0,
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("heading", { name: moment.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This Flash Thread is preserved as a read-only game archive.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Add your take")).not.toBeInTheDocument();
  });
});
