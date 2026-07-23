import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DebateVote } from "@/components/actions/debate-vote";
import { JoinCommunityButton } from "@/components/actions/join-community-button";
import { TakeComposer } from "@/components/actions/take-composer";

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
  it("posts a take through the authenticated API", async () => {
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
  });
  it("submits a selected debate option", async () => {
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
});
