"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const links = [
  { href: "/lab", label: "Lab" },
  { href: "/hatchery", label: "Hatchery" },
  { href: "/leaderboard", label: "Leaderboard" },
];

/**
 * Lightweight, mobile-first shell for the public Tragon Bots pages. No fixed
 * sidebar and no auth gate — tap a link and play. The full platform's sidebar
 * (AppShell) is for the authenticated trading product.
 */
export function TragonShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-bg-secondary/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/lab" className="flex items-center gap-2">
            <span className="text-xl">🐉</span>
            <span className="font-bold tracking-tight">Tragon Bots</span>
          </Link>
          <nav className="flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  pathname === l.href
                    ? "bg-accent-purple/15 text-accent-purple"
                    : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
      <footer className="mx-auto max-w-5xl px-4 py-6 text-center text-xs text-text-muted">
        Simulation only — not financial advice. Past performance does not predict
        future results.
      </footer>
    </div>
  );
}
