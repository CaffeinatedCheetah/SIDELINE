"use client";

import { useSyncExternalStore } from "react";

import {
  formatCalendarDate,
  formatDateTime,
  type DateTimeDisplay,
  viewerTimeZone,
} from "@/lib/date-time";

const subscribe = () => () => {};

export function LocalDateTime({
  value,
  display = "date-time",
  calendar = false,
  className,
}: {
  value: string;
  display?: DateTimeDisplay;
  calendar?: boolean;
  className?: string;
}) {
  const timeZone = useSyncExternalStore(
    subscribe,
    viewerTimeZone,
    () => null,
  );

  const label = timeZone
    ? calendar
      ? `${formatCalendarDate(value, { timeZone })}, ${formatDateTime(value, {
          display: "time",
          timeZone,
        })}`
      : formatDateTime(value, { display, timeZone })
    : "Local time";

  return (
    <time
      className={className}
      dateTime={value}
      data-timezone={timeZone ?? "pending"}
      suppressHydrationWarning
    >
      {label}
    </time>
  );
}
