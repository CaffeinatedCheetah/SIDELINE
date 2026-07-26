import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportActions } from "@/components/moderation/report-actions";

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

describe("moderation report actions", () => {
  it("requires a reason before a content action can be confirmed, then calls the real API", async () => {
    routerRefresh.mockClear();
    const fetch = vi.fn(() => response({ id: "action-1" }));
    vi.stubGlobal("fetch", fetch);
    render(
      <ReportActions
        reportId="report-1"
        targetType="TAKE"
        targetId="take-1"
        contentRemoved={false}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Remove content" }),
    );
    const confirm = screen.getByRole("button", { name: "Confirm" });
    expect(confirm).toBeDisabled();
    await userEvent.type(
      screen.getByLabelText("Reason"),
      "Spam content, clearly promotional.",
    );
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/moderation-actions",
      expect.objectContaining({
        body: JSON.stringify({
          reportId: "report-1",
          targetType: "TAKE",
          targetId: "take-1",
          action: "REMOVE_CONTENT",
          reason: "Spam content, clearly promotional.",
        }),
      }),
    );
    expect(routerRefresh).toHaveBeenCalledOnce();
  });

  it("offers Restore instead of Remove once content is already removed", async () => {
    render(
      <ReportActions
        reportId="report-1"
        targetType="TAKE"
        targetId="take-1"
        contentRemoved
      />,
    );
    expect(
      screen.getByRole("button", { name: "Restore content" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove content" }),
    ).not.toBeInTheDocument();
  });

  it("dismisses a report through the real dismiss endpoint", async () => {
    const fetch = vi.fn(() => response({ dismissed: true }));
    vi.stubGlobal("fetch", fetch);
    render(
      <ReportActions
        reportId="report-2"
        targetType="USER"
        targetId="user-1"
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Dismiss report" }),
    );
    await userEvent.type(
      screen.getByLabelText("Resolution note"),
      "No violation found after review.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/reports/report-2/dismiss",
      expect.objectContaining({
        body: JSON.stringify({
          resolution: "No violation found after review.",
        }),
      }),
    );
  });

  it("shows a duration picker only for a temporary mute", async () => {
    render(
      <ReportActions reportId="report-3" targetType="USER" targetId="user-2" />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Mute user" }));
    expect(screen.getByLabelText("Duration")).toBeInTheDocument();
  });
});
