"use client";
import { useSyncExternalStore } from "react";

function noopSubscribe() {
  return () => {};
}

function formatLocal(scheduledAt: string) {
  return new Date(scheduledAt).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Renders a game's scheduled start time in the viewer's own local timezone.
 * Server-rendered date formatting (Date#toLocaleString with no explicit
 * timeZone) resolves against the server's runtime timezone, not the
 * visitor's -- correct for nobody but whoever happens to be in that zone.
 * useSyncExternalStore's server/client snapshot split is the React-blessed
 * way to render a value that's genuinely different pre- and post-hydration
 * without a synchronous setState-in-effect (a hard lint error here) or a
 * visible layout flash: the server snapshot renders a stable placeholder,
 * and the real snapshot is used from the very first client render.
 */
export function GameTime({ scheduledAt }: { scheduledAt: string }) {
  const label = useSyncExternalStore(
    noopSubscribe,
    () => formatLocal(scheduledAt),
    () => null,
  );

  return (
    <time dateTime={scheduledAt} className="text-text-secondary text-sm">
      {label ?? " "}
    </time>
  );
}
