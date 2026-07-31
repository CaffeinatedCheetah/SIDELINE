import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FollowButton } from "@/components/actions/follow-button";
import { UnblockButton } from "@/components/actions/unblock-button";
import { ProfileActionsMenu } from "@/components/profile/profile-actions-menu";

const routerRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: routerRefresh }),
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

describe("profile actions", () => {
  it("follows and unfollows through the real API, refreshing server data", async () => {
    routerRefresh.mockClear();
    const fetch = vi.fn(() => response({ following: true }));
    vi.stubGlobal("fetch", fetch);
    render(<FollowButton userId="user-1" />);
    const follow = screen.getByRole("button", { name: "Follow" });
    expect(follow).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(follow);
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/follows",
      expect.objectContaining({
        body: JSON.stringify({ userId: "user-1", follow: true }),
      }),
    );
    expect(screen.getByRole("button", { name: "Following" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(routerRefresh).toHaveBeenCalledOnce();
  });

  it("shows mutual follow context and updates the real follower count", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => response({ following: true })),
    );
    render(<FollowButton userId="user-1" initialFollowerCount={12} mutual />);
    await userEvent.click(
      screen.getByRole("button", { name: "Follow back · 12" }),
    );
    expect(
      await screen.findByRole("button", { name: "Following · 13" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("rolls back optimistic follow state on a failed request", async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ error: { code: "NOT_FOUND", message: "Gone" } }),
          { status: 404 },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    render(<FollowButton userId="user-1" />);
    await userEvent.click(screen.getByRole("button", { name: "Follow" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Gone"),
    );
    expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument();
  });

  it("requires confirmation before blocking, then calls the real API", async () => {
    const fetch = vi.fn(() => response({ blocked: true }));
    vi.stubGlobal("fetch", fetch);
    render(<ProfileActionsMenu userId="user-1" />);
    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    await userEvent.click(await screen.findByText("Block"));
    // Confirmation dialog opens instead of firing the request immediately --
    // this exercises the Dialog-trigger-nested-in-DropdownMenu.Item pattern,
    // which is easy to get wrong (menu unmounting before the dialog opens).
    expect(fetch).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog", {
      name: "Block this account?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Confirm" }),
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/blocks",
      expect.objectContaining({
        body: JSON.stringify({ userId: "user-1", block: true }),
      }),
    );
  });

  it("copies the profile link when Share is clicked", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ProfileActionsMenu userId="user-1" />);
    await userEvent.click(
      screen.getByRole("button", { name: "Copy link to this profile" }),
    );
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(
      await screen.findByRole("button", { name: "Link copied" }),
    ).toBeInTheDocument();
  });

  it("unblocks through the real API", async () => {
    routerRefresh.mockClear();
    const fetch = vi.fn(() => response({ blocked: false }));
    vi.stubGlobal("fetch", fetch);
    render(<UnblockButton userId="user-1" />);
    await userEvent.click(screen.getByRole("button", { name: "Unblock" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/blocks",
      expect.objectContaining({
        body: JSON.stringify({ userId: "user-1", block: false }),
      }),
    );
    expect(routerRefresh).toHaveBeenCalledOnce();
  });
});
