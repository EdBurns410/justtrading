import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-16">
      <section className="space-y-6 max-w-3xl">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-tight">
          Pick your first agentic-AI bet with real ROI math.
        </h1>
        <p className="text-lg text-text-secondary leading-relaxed">
          Tell us how your time is actually spent. EdgeForge ranks where agentic AI
          is most likely to pay back fastest in your business — using benchmarks
          with sources and dates, not vibes — and gives you a 2-week pilot plan
          for the top pick.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/intake" className="btn-primary">
            Start the 5-minute intake
          </Link>
          <Link href="/benchmarks" className="btn-secondary">
            See the benchmark library
          </Link>
        </div>
        <p className="text-sm text-text-muted">
          No signup required for v0. Your answers stay in your browser.
        </p>
      </section>

      <section className="grid sm:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-3xl font-semibold text-accent-blue">1</div>
          <h3 className="font-semibold mt-2">12 structured questions</h3>
          <p className="text-sm text-text-secondary mt-2">
            Hours/week on 8 named workflows, fully-loaded labor cost, risk
            tolerance, budget. No open-ended fluff.
          </p>
        </div>
        <div className="card">
          <div className="text-3xl font-semibold text-accent-blue">2</div>
          <h3 className="font-semibold mt-2">Ranked opportunities</h3>
          <p className="text-sm text-text-secondary mt-2">
            Each workflow gets a low/expected/high annual ROI range, year-1 cost,
            payback months, and the benchmarks used (with sources).
          </p>
        </div>
        <div className="card">
          <div className="text-3xl font-semibold text-accent-blue">3</div>
          <h3 className="font-semibold mt-2">2-week pilot plan</h3>
          <p className="text-sm text-text-secondary mt-2">
            For your top pick: vendor shortlist, go/no-go criteria, weekly
            tasks, and the specific risks for that workflow.
          </p>
        </div>
      </section>

      <section className="card max-w-3xl">
        <h2 className="text-xl font-semibold mb-3">What this isn&apos;t</h2>
        <ul className="text-sm text-text-secondary space-y-2 list-disc list-inside">
          <li>It isn&apos;t a chat box. We picked 12 structured inputs because open chat hallucinates ROI.</li>
          <li>It isn&apos;t real-time market data. Benchmarks update quarterly and every card shows its last-verified date.</li>
          <li>It isn&apos;t financial advice. The 95% of GenAI pilots that produce no measurable P&amp;L impact (MIT NANDA 2025) are the warning, not the exception.</li>
          <li>It isn&apos;t an agent platform. v0 helps you choose; you build (or buy) the pilot.</li>
        </ul>
      </section>
    </div>
  );
}
