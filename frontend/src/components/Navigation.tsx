"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const navItems = [
  { href: "/", label: "Dashboard", icon: "grid" },
  { href: "/events", label: "Event Feed", icon: "zap" },
  { href: "/bots", label: "Strategy Bots", icon: "cpu" },
  { href: "/trades", label: "Trades", icon: "trending-up" },
  { href: "/risk", label: "Risk Monitor", icon: "shield" },
  { href: "/promotions", label: "Promotion Pipeline", icon: "git-merge" },
];

const icons: Record<string, string> = {
  grid: "M4 4h7v7H4V4zm9 0h7v7h-7V4zm-9 9h7v7H4v-7zm9 0h7v7h-7v-7z",
  zap: "M13 2L3 14h9l-1 10 10-12h-9l1-10z",
  cpu: "M6 4h12v12H6V4zm-2 3H2v6h2m18-6h-2v6h2M9 2v2m6-2v2m-6 16v2m6-2v2",
  "trending-up": "M23 6l-9.5 9.5-5-5L1 18",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  "git-merge": "M18 21a3 3 0 100-6 3 3 0 000 6zM6 9a3 3 0 100-6 3 3 0 000 6zm0 0v12",
};

export function Navigation() {
  const pathname = usePathname();

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
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-accent-green" />
          <span className="text-xs text-text-muted">System Online</span>
        </div>
      </div>
    </nav>
  );
}
