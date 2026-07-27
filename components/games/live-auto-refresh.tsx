"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-runs the server component tree (and therefore re-fetches ESPN) every
 * 30s while at least one game on the page is LIVE. The 60s Next.js Data
 * Cache on the ESPN fetch naturally caps how often that upstream call
 * actually happens, so this can poll faster than the cache window without
 * hammering ESPN.
 */
export function LiveAutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}
