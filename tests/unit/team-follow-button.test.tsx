import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TeamFollowButton } from "@/components/teams/team-follow-button";

const routerRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefresh }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  routerRefresh.mockClear();
});

function success(following: boolean) {
  return Promise.resolve(
    new Response(
      JSON.stringify({
        data: {
          teamId: "5da674f6-4b03-4fa5-8644-263b0d64e35c",
          following,
          followerCount: following ? 1 : 0,
        },
      }),
      { status: following ? 201 : 200 },
    ),
  );
}

const defaults = {
  teamId: "5da674f6-4b03-4fa5-8644-263b0d64e35c",
  signedIn: true,
  callbackUrl: "/teams",
};

describe("TeamFollowButton", () => {
  it("renders signed-in Follow and Following states accessibly", () => {
    const { unmount } = render(<TeamFollowButton {...defaults} />);
    expect(screen.getByRole("button", { name: "Follow" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    unmount();
    render(<TeamFollowButton {...defaults} initialFollowing />);
    expect(screen.getByRole("button", { name: "Following" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("follows, prevents duplicate clicks while pending, and refreshes", async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetch);
    render(<TeamFollowButton {...defaults} />);

    await userEvent.click(screen.getByRole("button", { name: "Follow" }));
    expect(screen.getByRole("button", { name: "Saving" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Saving" }));
    expect(fetch).toHaveBeenCalledOnce();
    resolveResponse?.(
      new Response(
        JSON.stringify({
          data: {
            teamId: defaults.teamId,
            following: true,
            followerCount: 1,
          },
        }),
        { status: 201 },
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Following" }),
      ).toBeInTheDocument(),
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/team-follows",
      expect.objectContaining({
        body: JSON.stringify({ teamId: defaults.teamId, follow: true }),
      }),
    );
    expect(routerRefresh).toHaveBeenCalledOnce();
  });

  it("unfollows successfully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => success(false)),
    );
    render(<TeamFollowButton {...defaults} initialFollowing />);
    await userEvent.click(screen.getByRole("button", { name: "Following" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Follow" }),
      ).toBeInTheDocument(),
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/team-follows",
      expect.objectContaining({
        body: JSON.stringify({ teamId: defaults.teamId, follow: false }),
      }),
    );
  });

  it("rolls back the optimistic state after failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: { code: "FAILED", message: "Could not save team" },
            }),
            { status: 500 },
          ),
        ),
      ),
    );
    render(<TeamFollowButton {...defaults} />);
    await userEvent.click(screen.getByRole("button", { name: "Follow" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not save team",
      ),
    );
    expect(screen.getByRole("button", { name: "Follow" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("returns signed-out fans to the current route", () => {
    render(
      <TeamFollowButton
        {...defaults}
        signedIn={false}
        callbackUrl="/teams?league=mlb"
      />,
    );
    expect(screen.getByRole("link", { name: "Follow" })).toHaveAttribute(
      "href",
      "/auth/sign-in?callbackUrl=%2Fteams%3Fleague%3Dmlb",
    );
  });
});
