export type DateTimeDisplay = "date" | "time" | "date-time";

function asDate(value: Date | string | number) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid date value");
  return date;
}

export function toUtcIso(value: Date | string | number) {
  return asDate(value).toISOString();
}

export function formatDateTime(
  value: Date | string | number,
  {
    display = "date-time",
    locale = "en-US",
    timeZone,
    timeZoneName = display !== "date",
  }: {
    display?: DateTimeDisplay;
    locale?: string;
    timeZone: string;
    timeZoneName?: boolean;
  },
) {
  return new Intl.DateTimeFormat(locale, {
    ...(display === "time"
      ? {}
      : { month: "short", day: "numeric", year: "numeric" }),
    ...(display === "date"
      ? {}
      : {
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: timeZoneName ? ("short" as const) : undefined,
        }),
    timeZone,
  }).format(asDate(value));
}

function calendarKey(value: Date | string | number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(asDate(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function formatCalendarDate(
  value: Date | string | number,
  {
    now = new Date(),
    locale = "en-US",
    timeZone,
  }: {
    now?: Date | string | number;
    locale?: string;
    timeZone: string;
  },
) {
  const target = calendarKey(value, timeZone);
  const today = calendarKey(now, timeZone);
  const dayDifference = Math.round(
    (new Date(`${target}T12:00:00.000Z`).getTime() -
      new Date(`${today}T12:00:00.000Z`).getTime()) /
      86_400_000,
  );
  if (dayDifference === -1) return "Yesterday";
  if (dayDifference === 0) return "Today";
  if (dayDifference === 1) return "Tomorrow";
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone,
  }).format(asDate(value));
}

export function viewerTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
