# EdgeForge PRD v1.1

**Status:** Draft for MVP scoping
**Last updated:** May 2026
**Owner:** TBD (product)

This is a tightened rewrite of v1.0. The v1.0 PRD tried to ship three
verticals (agentic AI, RWA/stablecoins, longevity) in a 4–6 week MVP,
across four personas, with a chat interface, custom agent deployment,
alerts, simulations, and reports. That is not an MVP. v1.1 cuts hard so
something real can ship and be tested.

---

## 1. One-line pitch

EdgeForge helps a solo SMB operator decide where to deploy agentic AI in
their business by simulating the ROI against fresh benchmarks and giving
them a concrete next step. That is the whole product.

## 2. What we cut from v1.0 and why

| Cut | Reason |
| --- | --- |
| RWA / stablecoins vertical | Different buyer, different regulatory surface (securities, KYC), different data plumbing. Belongs in a separate product, not an MVP tab. |
| Longevity vertical | "Real-time" longevity data is largely fiction — PubMed and ClinicalTrials.gov update on weeks-to-months cadence. Tracking wearables is a full product. Belongs in v3+ or never. |
| Autonomous agent deployment | "One-click deploy a custom agent" is months of work (auth, tool sandboxing, eval, error handling, billing for inference). Out of MVP. |
| Open-ended chat interface | Hallucination risk on financial/ROI advice is high. MVP uses bounded structured inputs; chat is v1.1. |
| Four personas | Replaced with one. Vague ICPs produce vague products. |
| "Real-time" framing for slow data | Benchmarks update quarterly. Honest cadence builds trust. |
| Custom alerts/Slack/Discord | One channel in MVP: a weekly email digest. |
| Wallet connect / portfolio tracking | Out — that's a different product (portfolio tracker). |

## 3. Problem statement

A solo operator running a $250k–$5M revenue SMB hears constantly that
"AI agents" will change their business. They have two failure modes:

1. **Frozen** — they don't know which workflow to automate first, what
   it would cost, or what the realistic payoff is. They read newsletters
   and do nothing.
2. **Wasted spend** — they buy an "AI" tool that doesn't move a metric,
   or hire a consultant for $15–40k who delivers a slide deck.

The MIT NANDA "State of AI in Business 2025" finding that 95% of GenAI
pilots produce no measurable P&L impact captures the second failure.
The first failure shows up as "79% adoption, 11% in production" in the
same class of surveys.

What this user actually does today:
- Reads LinkedIn / X / newsletters (no synthesis, no ROI math)
- Asks ChatGPT for ideas (generic, no grounding in their numbers)
- Hires a consultant (expensive, slow, often wrong)
- Buys point tools and hopes (low conversion to durable use)

The wedge: a tool that takes their actual business inputs (revenue,
team size, hours spent on which workflows) and outputs a *ranked*
shortlist of agentic-AI bets with simulated ROI grounded in current
public benchmarks, plus a concrete week-one action for the top pick.

## 4. ICP (one persona, no others)

**Solo operator, SMB, $250k–$5M annual revenue, 1–25 employees,
service-heavy business** (agencies, professional services, ecommerce
ops, B2B SaaS founders pre-Series A). They have:

- Personal P&L visibility
- Authority to buy a $50–500/mo tool without committee
- 5–15 hours/week stuck in repetitive ops (CS, sales ops, content,
  bookkeeping, recruiting screening)
- Read business/tech content daily; not engineers but tech-comfortable

Out of ICP (for now): enterprise buyers, pure consumers, pure investors,
non-English markets.

## 5. MVP scope (4–6 weeks, 1 PM + 1 full-stack eng + 1 designer part-time)

### In

1. **Onboarding intake** — 12 structured questions: revenue band, team
   size, hours per week on each of ~8 named workflows, current tool
   stack, budget for new tools, risk tolerance (low/med/high).
2. **Opportunity ranking** — for each in-scope workflow, compute a
   simulated annual ROI range using:
   - User's reported hours and fully-loaded labor cost (asked once)
   - Public benchmark range for that workflow class (e.g., "customer
     support deflection: 25–55% of L1 tickets, 30–70% latency
     reduction") sourced from a curated, dated benchmark library we
     maintain
   - User's risk tolerance applied as a haircut on the benchmark
   Output: ranked list of 3–5 bets with low/expected/high annual ROI,
   confidence band, and "what could go wrong."
3. **Top-pick action plan** — for the #1 ranked bet, a one-page plan:
   - 3 candidate vendors *or* a build-vs-buy recommendation
   - A 14-day pilot design (metric, sample size, cutoff criteria)
   - Estimated total pilot cost
4. **Weekly email digest** — 1 email/week per user: any benchmark
   changes that move the user's ranking, plus one new playbook.
5. **Benchmark library** — internal CMS of dated benchmark cards
   (workflow, metric, range, source link, last-verified date). Surfaced
   to users as inline citations on every ROI number.

### Out (explicitly)

- Stablecoins, RWA, crypto, tokenization
- Longevity, wearables, health
- Agent deployment, custom agents, agent orchestration
- Open-ended chat / LLM Q&A
- Real-time market data feeds
- Wallet / portfolio integrations
- Slack, Discord, mobile push
- Team accounts / multi-seat
- API / embeddings for enterprises
- PDF reports (HTML email is enough for v1)

## 6. Out-of-MVP roadmap (no commitments, just direction)

- **v1.1** — Bounded Q&A grounded in the user's intake + benchmark
  library only (no open web). Track which benchmarks the user disputes.
- **v1.2** — Pilot tracking: did the user run the pilot, what did they
  measure, did benchmarks hold. This is the data moat.
- **v1.3** — Vendor directory with structured comparisons (not
  affiliate-driven; clearly labelled if monetized).
- **v2** — Agent deploy for 2–3 narrowly scoped use cases (e.g.,
  inbound lead enrichment, content repurposing). Only after we have
  pilot-outcome data.
- **v3+** — Adjacent verticals (RWA treasury, longevity) only if v1
  retention proves the playbook generalizes.

## 7. Competitive positioning

| Tool | What they do | Why we're different |
| --- | --- | --- |
| Newsletters (Ben's Bites, etc.) | Daily news, no ROI math | We rank by user-specific impact |
| ChatGPT / Claude | General advice, no benchmarks | We ground in dated public data with citations |
| AI consultants ($10–40k) | Custom but slow + expensive | We're $/mo and self-serve |
| Vertical AI tools (Intercom Fin, etc.) | Solve one workflow | We help *pick* which workflow |
| Gartner / Forrester reports | Enterprise; static; expensive | SMB-priced; dynamic; opinionated |

We are explicitly **not** a market-data dashboard like Messari,
DefiLlama, or Token Terminal. Those products exist and we don't beat
them at their game.

## 8. Success metrics

Pre-launch (10–20 design-partner interviews):
- ≥7/10 say current alternatives are "bad enough to switch from"
- ≥6/10 commit to paying $X/mo if it works

MVP launch → 90 days:
- **Activation** — % of signups who complete intake within 24h. Target: ≥60%.
- **Aha moment** — % of activated users who view their ranked list and
  click into the top-pick action plan. Target: ≥75%.
- **Retention proxy** — % of weekly digest emails opened in week 4.
  Target: ≥35%.
- **Conversion to paid** (if pricing live) — ≥8% of activated users.
- **Pilot uptake** (the real metric, harder to measure) — % of users
  who self-report running their recommended pilot within 30 days.
  Target: ≥15%. We'll instrument this with a one-question email at day 21.

Killing criteria (when to pivot or shut down):
- <30% activation, OR
- <15% week-4 email open rate, OR
- <5% pilot uptake after 90 days with 200+ activated users.

## 9. Pricing (provisional, validate in interviews)

- **Free** — Intake + top-3 ranking. No action plan detail, no weekly digest.
- **Pro — $39/mo** — Full ranking, action plans, weekly digest.
- **Operator — $149/mo** — Pro + monthly 30-min call with a human
  reviewer (we manually do this until we can replace it). Caps at 20
  seats while it's human-delivered.

Free → Pro conversion target: 8–12%. Pro → Operator: 5%.

Not in pricing: per-seat, usage-based, enterprise contracts.

## 10. Data sources and freshness (be honest)

| Source class | Examples | Cadence | How we use |
| --- | --- | --- | --- |
| Benchmark reports | MIT NANDA, McKinsey State of AI, vendor case studies | Quarterly to annual | Hand-curated benchmark cards with source + date |
| Vendor pricing | Public pricing pages | Weekly scrape, manually verified | Action-plan cost estimates |
| News | Public RSS / curated newsletters | Daily | Editorial input to weekly digest only |

We do **not** claim "real-time." Every number a user sees is stamped
with the source and the last-verified date. If a benchmark is older
than 180 days, we show it as stale and don't use it in ranking unless
the user opts in.

## 11. Non-functional requirements

- **Performance** — Intake-to-ranking < 5s p95. No need for real-time
  streaming.
- **Reliability** — 99% uptime. Daily backup. No on-call beyond
  business hours in v1.
- **Security** — Email/password + Google OAuth via Supabase Auth.
  Encrypt user-reported financials at rest. No PII beyond email and
  intake answers.
- **Accessibility** — WCAG 2.1 AA on intake and dashboard.
- **Browser support** — Latest 2 versions of Chrome/Safari/Firefox/Edge.
  Mobile-responsive but not a mobile app.

## 12. Tech stack (one decision per row)

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js 14 (App Router) + Tailwind + shadcn/ui | Fast to build, good defaults |
| Charts | Recharts | Lighter than Tremor for our needs |
| Backend | Python FastAPI | Same language as benchmark-curation scripts |
| DB / Auth | Supabase (Postgres + Auth + Storage) | One vendor, fewer moving parts |
| LLM (for v1 — only used to draft action plans, not chat) | Anthropic Claude via API with prompt caching | Best instruction-following at our prompt size; we already have the SDK pattern |
| Email | Resend | Simple API, good deliverability |
| Hosting | Vercel (frontend) + Fly.io (backend) | Vercel for Next.js is path of least resistance |
| Analytics | PostHog (self-hosted-eligible) | Product analytics + session replay in one |

Not in v1 stack: LangChain, CrewAI, vector DB, Celery/Redis, web
scraping infrastructure. Benchmark curation is a Notion-or-Airtable +
CSV-import workflow until volume justifies more.

## 13. Risks and how we mitigate

| Risk | Mitigation |
| --- | --- |
| ROI ranges feel made up | Every number cites a dated, linked source. Show the math, not just the answer. |
| User reports wrong inputs (hours, costs) → bad ranking | Sanity-check inputs against industry medians; flag outliers; let user revise. |
| LLM hallucination in action plans | Action plans are templated; LLM only fills in pre-validated slots. Human review every action plan generated for the first 50 users. |
| Benchmark library decays | Each card has a `last_verified` date; CI fails if any card used in production is >180 days unverified. |
| "I tried ChatGPT, this is the same" | Differentiator must be visible in 60s of first use — show the user's *specific* ranked dollars, not generic advice. |
| Low pilot uptake (the killer risk) | Day-21 email asks one question; we follow up by hand for first 100 users to learn why. |

## 14. What we don't know yet

These are the questions design-partner interviews need to answer
*before* a line of production code is written:

1. Is the ranked-ROI output something users would act on, or do they
   need a human in the loop to trust it?
2. Is $39/mo the right price, or is this a $200/mo-or-free product?
3. Do users want vendor recommendations from us, or do they want us to
   stay neutral and they'll choose?
4. Is "weekly digest" the right cadence, or is this a "check it monthly
   when something changes" product?
5. Will pilot uptake actually hit 15%? If not, what's the actual
   product — content? consulting?

## 15. 6-week MVP plan

| Week | Deliverable |
| --- | --- |
| 1 | 10 design-partner interviews booked; intake question set v1 drafted; benchmark library schema + first 20 cards |
| 2 | Intake flow built end-to-end; ranking algorithm v0 (deterministic, no LLM); 5 design-partner interviews done |
| 3 | Action-plan template + LLM slot-filling; weekly digest email pipeline; remaining 5 interviews done; intake revised based on feedback |
| 4 | Auth, billing (Stripe), benchmark library populated to 60 cards covering 8 workflow classes; internal dogfooding |
| 5 | Closed beta with 20 design partners; instrument activation, aha, and day-21 pilot-uptake survey |
| 6 | Iterate on top 3 friction points from beta; public launch to waitlist |

Anything not on this list is out of scope. If a stakeholder asks for
RWA or longevity or agent deployment, point at this PRD.

---

## Appendix A — Open questions for the author

1. Is there an existing relationship between EdgeForge and the
   `justtrading` codebase this PRD lives in? If yes, document it; if
   no, EdgeForge probably belongs in its own repo.
2. Who is the actual author/owner? "Grok built from our conversation"
   is a generation note, not authorship — a human needs to own this.
3. What's the founder's distribution advantage? The PRD doesn't say
   how the first 1,000 users hear about us.
