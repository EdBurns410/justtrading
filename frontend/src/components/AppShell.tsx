"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Navigation } from "@/components/Navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { TragonShell } from "@/components/tragon/TragonShell";

// Public Tragon Bots pages — fully client-side, no login required.
const TRAGON_ROUTES = ["/lab", "/hatchery", "/leaderboard"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading } = useAuth();

  // Login page — no nav, no auth guard
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // Tragon Bots — public, mobile-first shell, no auth gate.
  if (TRAGON_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
    return <TragonShell>{children}</TragonShell>;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary">
        <div className="text-text-muted">Loading...</div>
      </div>
    );
  }

  // All other pages — require auth + show nav
  return (
    <AuthGuard>
      <div className="flex">
        <Navigation />
        <main className="ml-56 flex-1 p-6">{children}</main>
      </div>
    </AuthGuard>
  );
}
