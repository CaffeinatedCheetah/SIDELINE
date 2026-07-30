import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  REACTION_OPTIONS,
  ReactionPicker,
} from "@/components/reactions/reaction-picker";

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, refresh: vi.fn() }),
}));

afterEach(() => vi.unstubAllGlobals());

function response(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("Release 2.4 live fan interactions", () => {
  it("offers five accessible reaction choices and updates optimistically", async () => {
    const fetch = vi.fn(() => response({ active: true }));
    vi.stubGlobal("fetch", fetch);
    render(<ReactionPicker takeId="take-1" initialTotal={4} />);

    for (const reaction of REACTION_OPTIONS) {
      expect(
        screen.getByRole("button", {
          name: `Add ${reaction.label} reaction`,
        }),
      ).toHaveAttribute("aria-pressed", "false");
    }

    await userEvent.click(
      screen.getByRole("button", { name: "Add Wow reaction" }),
    );
    expect(screen.getByLabelText("5 reactions")).toBeInTheDocument();
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/v1/reactions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ takeId: "take-1", kind: "WOW" }),
        }),
      ),
    );
  });

  it("rolls an optimistic reaction back when the mutation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => response({}, 500)),
    );
    render(<ReactionPicker takeId="take-1" initialTotal={2} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Add Love reaction" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Add Love reaction" }),
      ).toHaveAttribute("aria-pressed", "false"),
    );
    expect(screen.getByLabelText("2 reactions")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Reaction could not be updated.",
    );
  });
});
