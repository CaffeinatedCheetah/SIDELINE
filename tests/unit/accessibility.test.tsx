import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import { DebateVote } from "@/components/actions/debate-vote";
import { Navbar } from "@/components/navigation/navbar";
import { Field, Input } from "@/components/ui/form-controls";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));

describe("accessibility smoke checks", () => {
  it("has no detectable navigation violations", async () => {
    const { container } = render(<Navbar authenticated unread={3} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("labels form controls and debate choices", async () => {
    const { container } = render(
      <>
        <Field label="Display name" htmlFor="name" error="Required">
          <Input id="name" />
        </Field>
        <DebateVote
          debateId="d1"
          options={[
            { id: "a", label: "Home" },
            { id: "b", label: "Away" },
          ]}
        />
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
