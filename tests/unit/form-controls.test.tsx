import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field, Input } from "@/components/ui/form-controls";
describe("Field", () => {
  it("associates labels and errors", () => {
    render(
      <Field label="Handle" htmlFor="handle" error="Handle is required">
        <Input id="handle" />
      </Field>,
    );
    expect(screen.getByLabelText("Handle")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByText("Handle is required")).toHaveAttribute(
      "id",
      "handle-error",
    );
  });
});
