import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Navbar } from "@/components/navigation/navbar";

describe("Navbar", () => {
  it("exposes public destinations and a skip link", () => {
    render(<Navbar />);
    expect(
      screen.getByRole("link", { name: "Skip to content" }),
    ).toHaveAttribute("href", "#main-content");
    expect(
      within(screen.getByRole("navigation", { name: "Primary" })).getByRole(
        "link",
        { name: "Games" },
      ),
    ).toHaveAttribute("href", "/games");
    expect(
      screen.getAllByRole("link", { name: "Sign in" }).length,
    ).toBeGreaterThan(0);
  });

  it("announces unread notifications", () => {
    render(<Navbar authenticated unread={12} />);
    expect(
      screen.getByRole("link", { name: "Notifications, 12 unread" }),
    ).toHaveAttribute("href", "/notifications");
  });
});
