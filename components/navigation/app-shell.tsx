import {
  Flame,
  Home,
  MessageSquare,
  Search,
  Settings,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";

const destinations = [
  ["My Arena", "/arena", Home],
  ["Games", "/games", Trophy],
  ["Communities", "/communities", Users],
  ["Debates", "/debates", MessageSquare],
  ["Hall of Flame", "/hall-of-flame", Flame],
  ["Search", "/search", Search],
  ["Settings", "/settings", Settings],
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-container grid flex-1 gap-6 py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <nav aria-label="Application" className="sticky top-22 grid gap-1">
          {destinations.map(([label, href, Icon]) => (
            <Link
              key={href}
              href={href}
              className="text-text-secondary hover:bg-surface-3 hover:text-text-primary flex min-h-11 items-center gap-3 rounded-sm px-3 font-bold"
            >
              <Icon aria-hidden className="size-5" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
