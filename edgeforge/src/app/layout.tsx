import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "EdgeForge — Find your first agentic AI bet",
  description:
    "Tell us about your business; we rank the agentic-AI workflows most likely to pay back fastest, with sources and a 14-day pilot plan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-bg-border">
          <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-lg font-semibold tracking-tight">EdgeForge</span>
              <span className="tag tag-blue">v0</span>
            </Link>
            <nav className="flex items-center gap-6 text-sm text-text-secondary">
              <Link href="/intake" className="hover:text-text-primary">
                Start intake
              </Link>
              <Link href="/results" className="hover:text-text-primary">
                Results
              </Link>
              <Link href="/benchmarks" className="hover:text-text-primary">
                Benchmarks
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        <footer className="mx-auto max-w-6xl px-6 py-8 text-xs text-text-muted border-t border-bg-border mt-16">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>EdgeForge v0 — for evaluation only. Every ROI number cites a dated source.</span>
            <span>Not financial advice. Validate benchmarks against your own data before acting.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
