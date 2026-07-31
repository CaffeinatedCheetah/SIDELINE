import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MentionText } from "@/components/social/mention-text";
import { extractMentionHandles } from "@/lib/social/mentions";

describe("fan mentions", () => {
  it("extracts normalized unique handles without treating email addresses as mentions", () => {
    expect(
      extractMentionHandles(
        "Great call @SidelineFan. Ask @sidelinefan and @another-fan; ignore a@b.com.",
      ),
    ).toEqual(["sidelinefan", "another-fan"]);
  });

  it("renders mentions as accessible profile links", () => {
    render(<MentionText>Great take, @sidelinefan!</MentionText>);
    expect(screen.getByRole("link", { name: "@sidelinefan" })).toHaveAttribute(
      "href",
      "/u/sidelinefan",
    );
  });
});
