import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManagedUserList } from "@/components/settings/managed-user-list";
import { SectionSelect } from "@/components/settings/section-select";

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

describe("settings interactions", () => {
  it("navigates to the selected section on mobile", async () => {
    routerPush.mockClear();
    render(
      <SectionSelect
        sections={[
          { key: "profile", label: "Profile" },
          { key: "privacy", label: "Privacy & safety" },
        ]}
        active="profile"
      />,
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Settings section"),
      screen.getByRole("option", { name: "Privacy & safety" }),
    );
    expect(routerPush).toHaveBeenCalledWith("/settings?section=privacy");
  });

  it("removes a blocked account through the real API", async () => {
    routerRefresh.mockClear();
    const fetch = vi.fn(() => response({ blocked: false }));
    vi.stubGlobal("fetch", fetch);
    render(
      <ManagedUserList
        resource="blocks"
        users={[{ id: "user-1", handle: "rival", displayName: "Rival Fan" }]}
        emptyTitle="No blocked accounts"
        emptyDescription="Nothing here."
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/blocks",
      expect.objectContaining({
        body: JSON.stringify({ userId: "user-1", block: false }),
      }),
    );
    expect(routerRefresh).toHaveBeenCalledOnce();
  });

  it("shows a neutral empty state with no managed users", () => {
    render(
      <ManagedUserList
        resource="mutes"
        users={[]}
        emptyTitle="No muted accounts"
        emptyDescription="Nothing here."
      />,
    );
    expect(screen.getByText("No muted accounts")).toBeInTheDocument();
  });
});
