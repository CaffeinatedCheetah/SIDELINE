import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GameRecapPanel } from "@/components/ai/game-recap-panel";

describe("GameRecapPanel", () => {
  it("renders a grounded ready recap and disclosure", () => {
    render(
      <GameRecapPanel
        signedIn={false}
        artifact={{
          id: "00000000-0000-4000-8000-000000000001",
          status: "READY",
          generatedAt: new Date("2026-07-01T04:00:00Z"),
          content: {
            schemaVersion: "1",
            headline: "Visitors finish the job",
            dek: "A verified late moment decided the game.",
            summary: "The Visitors won 4–3.",
            keyMoments: [],
            fanConversation: { summary: null, themes: [] },
            caveats: [],
          },
        }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "SIDELINE Recap" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/not official league reporting/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Helpful" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("renders safe insufficient and failed states", () => {
    const { rerender } = render(
      <GameRecapPanel
        signedIn
        artifact={{
          id: "a",
          status: "INSUFFICIENT_DATA",
          content: null,
          generatedAt: null,
        }}
      />,
    );
    expect(
      screen.getByText(/not enough verified game moments/i),
    ).toBeInTheDocument();
    rerender(
      <GameRecapPanel
        signedIn
        artifact={{
          id: "a",
          status: "FAILED",
          content: null,
          generatedAt: null,
        }}
      />,
    );
    expect(
      screen.getByText(/rest of the Game Room is unaffected/i),
    ).toBeInTheDocument();
  });
});
