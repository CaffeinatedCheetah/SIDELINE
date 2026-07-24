"use client";

import {
  Bell,
  Flame,
  Home,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Trophy,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TakeComposer } from "@/components/actions/take-composer";
import { buttonStyles } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

const links = [
  { href: "/games", label: "Games", icon: Trophy },
  { href: "/debates", label: "Debates", icon: MessageSquare },
  { href: "/communities", label: "Communities", icon: Users },
  { href: "/hall-of-flame", label: "Hall of Flame", icon: Flame },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar({
  authenticated = false,
  unread = 0,
}: {
  authenticated?: boolean;
  unread?: number;
}) {
  const pathname = usePathname() ?? "";

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="border-border-subtle bg-surface-1/95 sticky top-0 z-40 border-b backdrop-blur">
        <div className="page-container flex h-16 items-center gap-6">
          <Link
            href="/"
            aria-label="FanTakes home"
            className="display text-2xl"
          >
            <span className="text-brand">FAN</span>TAKES
          </Link>
          <nav
            aria-label="Primary"
            className="hidden items-center gap-1 lg:flex"
          >
            {links.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-sm px-3 text-sm font-bold transition",
                    active
                      ? "bg-brand-surface text-brand-light"
                      : "text-text-secondary hover:bg-surface-3 hover:text-text-primary",
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/search"
              aria-label="Search"
              className="hover:bg-surface-3 grid size-11 place-items-center rounded-sm"
            >
              <Search aria-hidden className="size-5" />
            </Link>
            {authenticated && (
              <Modal
                title="Create a take"
                description="Make a clear claim and explain why."
                trigger={
                  <button
                    aria-label="Create a take"
                    className={cn(buttonStyles({ variant: "secondary" }))}
                  >
                    <Plus aria-hidden className="size-4" />
                    Take
                  </button>
                }
              >
                <TakeComposer />
              </Modal>
            )}
            {authenticated ? (
              <>
                <Link
                  href="/notifications"
                  aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
                  className="hover:bg-surface-3 relative grid size-11 place-items-center rounded-sm"
                >
                  <Bell aria-hidden className="size-5" />
                  {unread > 0 && (
                    <span className="bg-brand absolute top-1 right-1 rounded-full px-1 text-[10px] font-bold">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </Link>
                <Link
                  href="/arena"
                  className={cn(buttonStyles({ variant: "secondary" }))}
                >
                  My Arena
                </Link>
              </>
            ) : (
              // Hidden below 360px: at that width there isn't room for
              // search + Sign in + the mobile menu button to coexist
              // (the true cause of the 320px horizontal-overflow defect).
              // The mobile bottom nav's own "Sign in" entry remains the
              // access point at those widths, so nothing is lost.
              <Link
                href="/auth/sign-in"
                className={cn(buttonStyles(), "max-[359px]:hidden")}
              >
                Sign in
              </Link>
            )}
            <button
              aria-label="Open menu"
              className="hover:bg-surface-3 grid size-11 place-items-center rounded-sm lg:hidden"
            >
              <Menu aria-hidden className="size-5" />
            </button>
          </div>
        </div>
      </header>
      <nav
        aria-label="Mobile"
        className="border-border-subtle bg-surface-1 safe-bottom fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t lg:hidden"
      >
        <Link
          href="/"
          aria-current={pathname === "/" ? "page" : undefined}
          className={cn(
            "grid min-h-11 place-items-center content-center gap-1 text-[11px]",
            pathname === "/"
              ? "text-brand-light font-bold"
              : "text-text-secondary",
          )}
        >
          <Home aria-hidden className="size-5" />
          Home
        </Link>
        <Link
          href="/games"
          aria-current={isActive(pathname, "/games") ? "page" : undefined}
          className={cn(
            "grid min-h-11 place-items-center content-center gap-1 text-[11px]",
            isActive(pathname, "/games")
              ? "text-brand-light font-bold"
              : "text-text-secondary",
          )}
        >
          <Trophy aria-hidden className="size-5" />
          Games
        </Link>
        {authenticated ? (
          <Modal
            title="Create a take"
            description="Make a clear claim and explain why."
            trigger={
              <button
                aria-label="Create a take"
                className="text-text-secondary grid min-h-11 place-items-center content-center gap-1 text-[11px]"
              >
                <span className="bg-brand grid size-9 place-items-center rounded-full text-white">
                  <Plus aria-hidden className="size-5" />
                </span>
                Take
              </button>
            }
          >
            <TakeComposer />
          </Modal>
        ) : (
          <Link
            href="/auth/sign-in"
            className="text-text-secondary grid min-h-11 place-items-center content-center gap-1 text-[11px]"
          >
            <span className="bg-brand grid size-9 place-items-center rounded-full text-white">
              <Plus aria-hidden className="size-5" />
            </span>
            Take
          </Link>
        )}
        <Link
          href={authenticated ? "/notifications" : "/auth/sign-in"}
          aria-current={
            isActive(pathname, "/notifications") ? "page" : undefined
          }
          className={cn(
            "grid min-h-11 place-items-center content-center gap-1 text-[11px]",
            isActive(pathname, "/notifications")
              ? "text-brand-light font-bold"
              : "text-text-secondary",
          )}
        >
          <Bell aria-hidden className="size-5" />
          {authenticated ? "Alerts" : "Sign in"}
        </Link>
        <Link
          href={authenticated ? "/arena" : "/auth/sign-in"}
          aria-current={isActive(pathname, "/arena") ? "page" : undefined}
          className={cn(
            "grid min-h-11 place-items-center content-center gap-1 text-[11px]",
            isActive(pathname, "/arena")
              ? "text-brand-light font-bold"
              : "text-text-secondary",
          )}
        >
          <User aria-hidden className="size-5" />
          Profile
        </Link>
      </nav>
    </>
  );
}
