# EdgeForge v0

Decide where to deploy agentic AI in an SMB by simulating ROI against
fresh, dated public benchmarks. Companion to
`docs/edgeforge-prd-v1.1.md`.

## Run locally

```bash
cd edgeforge
npm install
npm run dev
# http://localhost:3001
```

## What's in v0

- 12-question intake (`/intake`)
- Deterministic ROI ranking across 8 SMB workflows (`/results`)
- Templated 2-week pilot plan with vendor shortlist (`/action-plan/[workflowId]`)
- Browsable benchmark library with source + last-verified date (`/benchmarks`)
- All state in `localStorage` — no signup, no backend, no DB

## What's not in v0 (deferred per PRD v1.1)

- Auth, billing, multi-user
- LLM chat or LLM-generated action plans
- Weekly digest email pipeline
- Pilot outcome tracking
- Vendor directory with affiliate logic
- Stablecoins/RWA and longevity verticals (cut from v1.0)

## Layout

```
edgeforge/
  src/
    app/
      page.tsx                      landing
      intake/page.tsx               12 questions
      results/page.tsx              ranked opportunities
      action-plan/[workflowId]/     2-week pilot plan
      benchmarks/page.tsx           browsable library
      api/rank/route.ts             ranking endpoint
    components/
      Citation.tsx                  dated source cards
      OpportunityCard.tsx           ranking card with ROI range bar
    lib/
      ranking.ts                    deterministic algorithm
      action-plan.ts                templated pilot plans
      data.ts                       loads JSON, flags staleness
      storage.ts                    localStorage helpers
      types.ts
      format.ts
    data/
      workflows.json                8 SMB workflow classes
      benchmarks.json               ~18 dated benchmark cards
```

## How the ranking math works

For each workflow with hours/week > 0:

1. Look up the canonical automation-rate benchmark for that workflow.
2. Coerce benchmark units (%, minutes, hours) into a fractional rate.
3. Apply a risk-tolerance haircut (low: ×0.5, med: ×0.75, high: ×1.0).
4. `annual hours saved = hours/week × 52 × rate`
5. `labor savings = hours saved × fully-loaded hourly cost`
6. `year-1 cost = implementation × cost-risk-multiplier + 12 × monthly tool cost`
7. `net annual ROI = labor savings − year-1 cost`, computed for low/expected/high.
8. Sort by expected net.

Confidence drops to `low` if any benchmark used is stale (>180 days),
or hours/week < 2. Workflows with noisy public benchmarks (sales, content,
recruiting) cap at `medium`.

## Editing benchmarks

`src/data/benchmarks.json` is the source of truth. Every card needs
`source`, `sourceUrl`, and an ISO `lastVerified`. The UI auto-flags
anything older than 180 days as stale.

## Build / typecheck

```bash
npm run typecheck
npm run build
```
