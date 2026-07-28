import { describe, expect, it } from "vitest";

import { formatCalendarDate, formatDateTime, toUtcIso } from "@/lib/date-time";

describe("shared date and time utilities", () => {
  it("keeps source timestamps canonical in UTC", () => {
    expect(toUtcIso("2026-07-27T20:05:00-04:00")).toBe(
      "2026-07-28T00:05:00.000Z",
    );
  });

  it.each([
    ["UTC", "12:05 AM UTC"],
    ["America/New_York", "8:05 PM EDT"],
    ["America/Chicago", "7:05 PM CDT"],
    ["America/Denver", "6:05 PM MDT"],
    ["America/Los_Angeles", "5:05 PM PDT"],
  ])("formats the same instant in %s", (timeZone, expected) => {
    expect(
      formatDateTime("2026-07-28T00:05:00.000Z", {
        display: "time",
        timeZone,
      }),
    ).toBe(expected);
  });

  it("uses the viewer calendar around UTC midnight", () => {
    const instant = "2026-07-28T00:05:00.000Z";
    const now = "2026-07-27T18:00:00.000Z";
    expect(
      formatCalendarDate(instant, { now, timeZone: "America/New_York" }),
    ).toBe("Today");
    expect(formatCalendarDate(instant, { now, timeZone: "UTC" })).toBe(
      "Tomorrow",
    );
  });

  it("handles daylight-saving changes without hardcoded offsets", () => {
    expect(
      formatDateTime("2026-03-08T06:30:00.000Z", {
        display: "time",
        timeZone: "America/New_York",
      }),
    ).toBe("1:30 AM EST");
    expect(
      formatDateTime("2026-03-08T07:30:00.000Z", {
        display: "time",
        timeZone: "America/New_York",
      }),
    ).toBe("3:30 AM EDT");
  });
});
