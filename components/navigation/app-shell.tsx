"use client";

import {
  Flame,
  Home,
  LayoutGrid,
  MessageSquare,
  Search,
  Settings,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RailSlot } from "@/components/navigation/rail-context";
import { cn } from "@/lib/utils";

const destinations = [
  ["My Arena", "/arena", Home],
  ["Leagues", "/leagues", LayoutGrid],
  ["Games", "/games", Trophy],
  ["Communities", "/communities", Users],
  ["Debates", "/debates", MessageSquare],
  ["Hall of Flame", "/hall-of-flame", Flame],
  ["Search", "/search", Search],
  ["Settings", "/settings", Settings],
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    // No horizontal padding or max-width on this wrapper: each page
    // already constrains and centers its own content via .page-container.
    // Adding inset here would compound with that and shrink content
    // below the viewport's true width, which is what caused the
    // 320px horizontal-overflow defect.
    <div className="flex flex-1 items-start gap-6">
      <aside className="hidden shrink-0 py-6 pl-4 sm:pl-6 lg:block lg:w-[var(--sidebar-width)] lg:pl-8">
        <nav aria-label="Application" className="sticky top-22 grid gap-1">
          {destinations.map(([label, href, Icon]) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-sm border px-3 font-bold transition",
                  active
                    ? "bg-brand-surface border-brand-border text-brand-light"
                    : "text-text-secondary hover:bg-surface-3 hover:text-text-primary border-transparent",
                )}
              >
                <Icon aria-hidden className="size-5" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
      <RailSlot />
    </div>
  );
}
