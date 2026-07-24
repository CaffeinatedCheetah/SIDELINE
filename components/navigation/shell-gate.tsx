"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/navigation/app-shell";

// Pages intentionally excluded from the persistent sidebar shell:
// auth flows, legal docs, and help center render full-bleed, matching
// the reference design's own "Shared Layout" page list.
const SHELL_EXCLUDED_PREFIXES = [
  "/auth",
  "/terms",
  "/privacy",
  "/guidelines",
  "/help",
];

export function ShellGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const excluded = SHELL_EXCLUDED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (excluded) {
    return <div className="page-container flex-1 py-6">{children}</div>;
  }

  return <AppShell>{children}</AppShell>;
}
