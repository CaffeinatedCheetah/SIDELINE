import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DebateVote } from "@/components/actions/debate-vote";
import { DebateComposer } from "@/components/actions/debate-composer";
import { JoinCommunityButton } from "@/components/actions/join-community-button";
import { TakeComposer } from "@/components/actions/take-composer";
import { TakeCard } from "@/components/takes/take-card";
import { PollVoteCard } from "@/components/games/poll-vote-card";

const routerPush = vi.fn();
const routerRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
}));

afterEach(() => vi.unstubAllGlobals());
function response(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}
describe("participation actions", () => {
  it("creates a debate through the JSON API", async () => {
    const fetch = vi.fn(() => response({ id: "debate-1" }));
    vi.stubGlobal("fetch", fetch);
    render(<DebateComposer />);
    await userEvent.type(
      screen.getByLabelText("Question"),
      "Who owns the fourth quarter?",
    );
    await userEvent.type(
      screen.getByLabelText("Context"),
      "Compare late-game execution from both teams.",
    );
    await userEvent.type(screen.getByLabelText("Option 1"), "Detroit");
    await userEvent.type(screen.getByLabelText("Option 2"), "Chicago");
    await userEvent.click(
      screen.getByRole("button", { name: "Publish debate" }),
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/debates",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"options":["Detroit","Chicago"]'),
      }),
    );
  });
  it("supports adding a third and fourth debate position, capped at 4", async () => {
    render(<DebateComposer />);
    expect(screen.queryByLabelText("Option 3")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Add another position" }),
    );
    expect(screen.getByLabelText("Option 3")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Add another position" }),
    );
    expect(screen.getByLabelText("Option 4")).toBeInTheDocument();
    // 4 is the documented maximum -- the control to add a 5th must be gone.
    expect(
      screen.queryByRole("button", { name: "Add another position" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Remove option 4" }),
    );
    expect(screen.queryByLabelText("Option 4")).not.toBeInTheDocument();
  });
  it("posts a take through the authenticated API and refreshes the server-rendered feed", async () => {
    routerRefresh.mockClear();
    const fetch = vi.fn(() => response({ id: "take-1" }));
    vi.stubGlobal("fetch", fetch);
    render(<TakeComposer gameId="game-1" />);
    await userEvent.type(
      screen.getByLabelText("Add your take"),
      "Defense is controlling the line.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Post take" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent("Posted.");
    // The take lists this composer feeds (game room, debate detail,
    // community detail, profile) are Server Components -- without a
    // router.refresh() a newly posted take never appears without a manual
    // page reload. Regression coverage for that exact bug.
    expect(routerRefresh).toHaveBeenCalledOnce();
  });
  it("submits a selected debate option and refreshes the server-rendered results", async () => {
    routerRefresh.mockClear();
    const fetch = vi.fn(() => response({ id: "vote-1" }));
    vi.stubGlobal("fetch", fetch);
    render(
      <DebateVote
        debateId="debate-1"
        options={[
          { id: "one", label: "Option one" },
          { id: "two", label: "Option two" },
        ]}
      />,
    );
    fireEvent.click(screen.getByLabelText("Option two"));
    await userEvent.click(screen.getByRole("button", { name: "Cast vote" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(routerRefresh).toHaveBeenCalledOnce();
  });
  it("lets a fan who already voted change their position", async () => {
    const fetch = vi.fn(() => response({ id: "vote-1" }));
    vi.stubGlobal("fetch", fetch);
    render(
      <DebateVote
        debateId="debate-1"
        options={[
          { id: "one", label: "Option one" },
          { id: "two", label: "Option two" },
        ]}
        initialSelected="one"
      />,
    );
    // Already voted -- the legend and button reflect that, and re-clicking
    // the same option submits nothing (it's a no-op, not a duplicate vote).
    expect(screen.getByText("Your position")).toBeInTheDocument();
    const changeButton = screen.getByRole("button", {
      name: "Change position",
    });
    expect(changeButton).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Option two"));
    expect(changeButton).toBeEnabled();
    await userEvent.click(changeButton);
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/votes",
      expect.objectContaining({
        body: JSON.stringify({ debateId: "debate-1", optionId: "two" }),
      }),
    );
  });
  it("toggles community membership", async () => {
    const fetch = vi.fn(() => response({ joined: true }));
    vi.stubGlobal("fetch", fetch);
    render(<JoinCommunityButton communityId="community-1" />);
    await userEvent.click(
      screen.getByRole("button", { name: "Join community" }),
    );
    await screen.findByRole("button", { name: "Leave community" });
  });
  it("requires confirming the rules before joining when rules are provided", async () => {
    const fetch = vi.fn(() => response({ joined: true }));
    vi.stubGlobal("fetch", fetch);
    render(
      <JoinCommunityButton
        communityId="community-1"
        rules="Be specific. Debate the take, not the fan."
      />,
    );
    // Clicking "Join community" opens a confirmation dialog rather than
    // joining immediately -- the request must not fire yet.
    await userEvent.click(
      screen.getByRole("button", { name: "Join community" }),
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Community rules" }),
    ).toHaveTextContent("Be specific. Debate the take, not the fan.");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    await screen.findByRole("button", { name: "Leave community" });
  });
  it("toggles a take reaction optimistically and calls the real API", async () => {
    const fetch = vi.fn(() => response({ active: true }));
    vi.stubGlobal("fetch", fetch);
    render(
      <TakeCard
        id="take-1"
        author={{ handle: "jordan", displayName: "Jordan" }}
        body="Defense wins this."
        createdAt="Now"
        reactions={5}
        replies={0}
      />,
    );
    const flameButton = screen.getByRole("button", {
      name: "Add Fire reaction",
    });
    await userEvent.click(flameButton);
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/reactions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ takeId: "take-1", kind: "FIRE" }),
      }),
    );
    expect(
      screen.getByRole("button", { name: "Remove Fire reaction, 1 Fire" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("6 reactions")).toBeInTheDocument();
  });
  it("casts a real poll vote and updates the local tally", async () => {
    const fetch = vi.fn(() => response({ id: "pollvote-1" }));
    vi.stubGlobal("fetch", fetch);
    render(
      <PollVoteCard
        pollId="poll-1"
        question="Who wins?"
        options={[
          { id: "home", label: "Lions", votes: 3 },
          { id: "away", label: "Bears", votes: 2 },
        ]}
        closed={false}
      />,
    );
    fireEvent.click(screen.getByLabelText("Lions"));
    await userEvent.click(screen.getByRole("button", { name: "Vote" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/poll-votes",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ pollId: "poll-1", optionId: "home" }),
      }),
    );
    // Voting again is now blocked -- the fieldset disables once voted.
    expect(screen.getByRole("button", { name: "Vote" })).toBeDisabled();
  });
});
