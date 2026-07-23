import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
describe("Modal", () => {
  it("opens, labels itself, and closes with Escape", async () => {
    render(
      <Modal trigger={<Button>Report</Button>} title="Report take">
        <p>Choose a reason</p>
      </Modal>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Report" }));
    expect(
      screen.getByRole("dialog", { name: "Report take" }),
    ).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
