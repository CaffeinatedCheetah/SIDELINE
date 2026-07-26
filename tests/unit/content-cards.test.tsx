import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DebateCard } from "@/components/debates/debate-card";
import { PollCard } from "@/components/games/poll-card";
import { TakeCard } from "@/components/takes/take-card";

describe("content cards", () => {
  it("renders a take with accessible actions", () => {
    render(
      <TakeCard
        id="t1"
        author={{ handle: "jordan", displayName: "Jordan" }}
        body="Defense wins this."
        createdAt="Now"
        reactions={12}
        replies={3}
      />,
    );
    expect(screen.getByRole("article")).toHaveTextContent("Defense wins this.");
    expect(
      screen.getByRole("button", { name: "Give flame, 12 total" }),
    ).toBeEnabled();
  });

  it("calculates debate percentages from votes", () => {
    render(
      <DebateCard
        id="d1"
        title="Who wins?"
        category="NFL"
        options={[
          { label: "Detroit", votes: 3 },
          { label: "Chicago", votes: 1 },
        ]}
        replyCount={4}
      />,
    );
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Who wins?" })).toHaveAttribute(
      "href",
      "/debates/d1",
    );
  });

  it("keeps poll submission disabled until an option is selected", () => {
    render(
      <PollCard
        question="Pick the winner"
        options={[{ id: "a", label: "Home", votes: 0 }]}
      />,
    );
    expect(screen.getByRole("button", { name: "Vote" })).toBeDisabled();
  });
});
