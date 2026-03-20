import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/Navigation";

export const metadata: Metadata = {
  title: "JustTrading — Event-Driven Trading Platform",
  description:
    "Governed event-driven trading platform with strategy sandboxes, full audit trails, and strict promotion from test lab to live.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="flex">
          <Navigation />
          <main className="ml-56 flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
