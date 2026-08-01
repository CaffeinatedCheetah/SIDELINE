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
  description: "A verified scoring play changed the lead.",
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
        initialActivity={[
          {
            id: "thread:thread-1",
            kind: "thread",
            title: moment.title,
            detail: "0 takes · 0 reactions · 0 replies",
            timestamp: "2026-07-30T00:21:00.000Z",
            importance: 90,
            featured: true,
            score: { away: 1, home: 2 },
            status: "ACTIVE",
          },
          {
            id: "moment:moment-1",
            kind: "moment",
            title: moment.title,
            detail: moment.description,
            timestamp: moment.occurredAt,
            importance: 90,
            score: { away: 1, home: 2 },
            status: moment.type,
          },
        ]}
      />,
    );
    expect(screen.getAllByRole("heading", { name: moment.title })).toHaveLength(
      2,
    );
    expect(screen.getAllByText("Bottom 5th")).toHaveLength(2);
    expect(screen.getByLabelText("Add your take")).toBeInTheDocument();
    expect(screen.getByText("Takes")).toBeInTheDocument();
    expect(screen.getAllByText("1–2")).toHaveLength(2);
    expect(
      screen.getAllByText("A verified scoring play changed the lead."),
    ).toHaveLength(2);
    expect(
      document.querySelector(
        '[data-moment-type="LEAD_CHANGE"][data-moment-importance="major"]',
      ),
    ).toBeInTheDocument();
    expect(
      document.querySelector("[data-featured-flash-thread]"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Moments, takes, predictions, and milestones" }),
    ).toBeInTheDocument();
    expect(document.querySelector("[data-live-activity]")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-live-activity-item]")).toHaveLength(
      1,
    );
    expect(
      document.querySelector('[data-activity-kind="moment"]'),
    ).toBeInTheDocument();
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
        "Major game moments and the conversation around them will appear here as the action unfolds.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No one has started the conversation yet."),
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
    expect(screen.getAllByRole("heading", { name: moment.title })).toHaveLength(
      2,
    );
    expect(
      screen.getByText(
        "This Flash Thread is preserved as a read-only game archive.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Add your take")).not.toBeInTheDocument();
  });

  it("uses archive-specific empty-state copy for a final game", () => {
    render(
      <GameMomentsPanel
        gameId="game-1"
        phase="FINAL"
        initialMoments={[]}
        initialThreads={[]}
      />,
    );
    expect(
      screen.getByText(
        "This game’s verified moments will remain here as a permanent archive.",
      ),
    ).toBeInTheDocument();
  });

  it("uses a sport-aware shared label for normalized moments", () => {
    render(
      <GameMomentsPanel
        gameId="game-1"
        phase="LIVE"
        sportKey="soccer"
        initialMoments={[{ ...moment, id: "goal-1", type: "SCORE" }]}
        initialThreads={[]}
      />,
    );
    expect(screen.getByText("goal")).toBeInTheDocument();
  });
});
