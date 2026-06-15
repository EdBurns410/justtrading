"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { href: "/", label: "Dashboard", icon: "grid" },
  { href: "/lab", label: "Strategy Lab", icon: "beaker" },
  { href: "/events", label: "Event Feed", icon: "zap" },
  { href: "/bots", label: "Strategy Bots", icon: "cpu" },
  { href: "/trades", label: "Trades", icon: "trending-up" },
  { href: "/risk", label: "Risk Monitor", icon: "shield" },
  { href: "/promotions", label: "Promotion Pipeline", icon: "git-merge" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

const icons: Record<string, string> = {
  grid: "M4 4h7v7H4V4zm9 0h7v7h-7V4zm-9 9h7v7H4v-7zm9 0h7v7h-7v-7z",
  beaker: "M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3M7 14h10",
  zap: "M13 2L3 14h9l-1 10 10-12h-9l1-10z",
  cpu: "M6 4h12v12H6V4zm-2 3H2v6h2m18-6h-2v6h2M9 2v2m6-2v2m-6 16v2m6-2v2",
  "trending-up": "M23 6l-9.5 9.5-5-5L1 18",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  "git-merge": "M18 21a3 3 0 100-6 3 3 0 000 6zM6 9a3 3 0 100-6 3 3 0 000 6zm0 0v12",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
};

export function Navigation() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <nav className="fixed left-0 top-0 flex h-screen w-56 flex-col border-r border-gray-800 bg-bg-secondary">
      <div className="border-b border-gray-800 p-4">
        <h1 className="text-lg font-bold text-text-primary">JustTrading</h1>
        <p className="text-xs text-text-muted">Event-Driven Platform</p>
      </div>

      <div className="flex-1 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                isActive
                  ? "border-r-2 border-accent-blue bg-accent-blue/10 text-accent-blue"
                  : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              )}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={icons[item.icon]} />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="border-t border-gray-800 p-4">
        {user && (
          <div className="mb-3">
            <p className="truncate text-xs text-text-secondary">{user.email}</p>
            <button
              onClick={signOut}
              className="mt-1 text-xs text-text-muted hover:text-red-400"
            >
              Sign out
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-accent-green" />
          <span className="text-xs text-text-muted">System Online</span>
        </div>
      </div>
    </nav>
  );
}
