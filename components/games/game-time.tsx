import { LocalDateTime } from "@/components/ui/local-date-time";

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
  return (
    <LocalDateTime
      value={scheduledAt}
      className="text-text-secondary text-sm"
    />
  );
}
