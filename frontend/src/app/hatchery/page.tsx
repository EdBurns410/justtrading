"use client";

import { useEffect, useMemo, useState } from "react";
import {
  runBacktest,
  computeRobustness,
  genomeFromSpecies,
  crossbreed,
  applyMutation,
  mutationLabel,
  CORE_SPECIES,
  CROSSBREEDS,
  DEFAULT_CONFIG,
  type Genome,
  type Mutation,
} from "@/lib/engine";
import { getChallengeBars } from "@/lib/engine/data/challenge";
import { EquityChart } from "@/components/lab/EquityChart";
import {
  loadCollection,
  saveBot as persistBot,
  removeBot,
  newId,
  type SavedBot,
} from "@/lib/tragon/collection";

const GLYPH: Record<string, string> = {
  fire: "🔥",
  ice: "❄️",
  plant: "🌱",
  storm: "⚡",
  steel: "⚙️",
  shadow: "🌑",
  ocean: "🌊",
  solar: "☀️",
};

const ALL_MUTATIONS: Mutation[] = [
  "precision",
  "patience",
  "adaptability",
  "protection",
  "speed",
];

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** Find the named cross-breed for two base species (order-insensitive). */
function findCrossbreed(a: string, b: string): { id: string; name: string } | null {
  for (const [id, def] of Object.entries(CROSSBREEDS)) {
    const [p, q] = def.parents;
    if ((p === a && q === b) || (p === b && q === a)) return { id, name: def.name };
  }
  return null;
}

function baseSpecies(s: string): string {
  // Bred bots tag a crossbreed id; fall back to the raw species otherwise.
  return s;
}

export default function HatcheryPage() {
  const [collection, setCollection] = useState<SavedBot[]>([]);
  const [parentA, setParentA] = useState<string | null>(null);
  const [parentB, setParentB] = useState<string | null>(null);
  const [mutations, setMutations] = useState<Mutation[]>([]);
  const [child, setChild] = useState<SavedBot | null>(null);

  const bars = useMemo(() => getChallengeBars(), []);

  useEffect(() => {
    setCollection(loadCollection());
  }, []);

  function hatchEgg(species: string) {
    const preset = CORE_SPECIES[species];
    const bot: SavedBot = {
      id: newId(species),
      name: `${preset.name} Gen-1`,
      species,
      generation: 1,
      genome: genomeFromSpecies(species),
      createdAt: Date.now(),
    };
    setCollection(persistBot(bot));
  }

  function remove(id: string) {
    setCollection(removeBot(id));
    if (parentA === id) setParentA(null);
    if (parentB === id) setParentB(null);
  }

  const a = collection.find((b) => b.id === parentA) ?? null;
  const b = collection.find((x) => x.id === parentB) ?? null;

  const cross = a && b ? findCrossbreed(baseSpecies(a.species), baseSpecies(b.species)) : null;

  // Per-bot quick return so the player can "breed the winners".
  const quickStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const bot of collection) {
      map.set(bot.id, runBacktest(bot.genome, bars, DEFAULT_CONFIG).metrics.totalReturn);
    }
    return map;
  }, [collection, bars]);

  const childGenome: Genome | null = useMemo(() => {
    if (!a || !b) return null;
    const childSpecies = cross ? cross.id : `${a.species}x${b.species}`;
    let g = crossbreed(a.genome, b.genome, childSpecies, [a.id, b.id]);
    for (const m of mutations) g = applyMutation(g, m);
    return g;
  }, [a, b, cross, mutations]);

  const childResult = useMemo(
    () => (childGenome ? runBacktest(childGenome, bars, DEFAULT_CONFIG) : null),
    [childGenome, bars],
  );
  const childRobust = useMemo(
    () => (childGenome ? computeRobustness(childGenome, bars, DEFAULT_CONFIG) : null),
    [childGenome, bars],
  );

  function breed() {
    if (!a || !b || !childGenome) return;
    const name = cross ? cross.name : `${CORE_SPECIES[a.species]?.name ?? a.species} Hybrid`;
    const bot: SavedBot = {
      id: newId("bred"),
      name: `${name} Gen-${childGenome.generation}`,
      species: childGenome.species,
      generation: childGenome.generation,
      genome: childGenome,
      parentNames: [a.name, b.name],
      createdAt: Date.now(),
    };
    setChild(bot);
  }

  function saveChild() {
    if (!child) return;
    setCollection(persistBot(child));
    setChild(null);
    setMutations([]);
  }

  function toggleMutation(m: Mutation) {
    setMutations((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );
  }

  function selectParent(id: string) {
    if (parentA === id) return setParentA(null);
    if (parentB === id) return setParentB(null);
    if (!parentA) return setParentA(id);
    if (!parentB) return setParentB(id);
    // both taken — replace B
    setParentB(id);
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-2xl font-bold">Hatchery</h2>
        <p className="text-sm text-text-muted">
          Hatch eggs, breed your winners into cross-breeds, and mutate them.
          Every offspring is backtested honestly.
        </p>
      </div>

      {/* Eggs */}
      <div className="card mb-6">
        <h3 className="mb-3 font-semibold">Hatch an egg</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.values(CORE_SPECIES).map((p) => (
            <button
              key={p.id}
              onClick={() => hatchEgg(String(p.id))}
              className="rounded-lg border border-gray-700 p-3 text-left transition-colors hover:border-accent-purple"
            >
              <div className="text-lg">{GLYPH[p.id] ?? "🥚"}</div>
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-[11px] text-text-muted">{p.archetype}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Collection -> pick parents */}
        <div className="card">
          <h3 className="mb-3 font-semibold">
            Your bots ({collection.length}) · tap two to breed
          </h3>
          {collection.length === 0 && (
            <p className="text-sm text-text-muted">
              No bots yet — hatch an egg above to begin.
            </p>
          )}
          <div className="space-y-2">
            {collection.map((bot) => {
              const ret = quickStats.get(bot.id) ?? 0;
              const role = parentA === bot.id ? "A" : parentB === bot.id ? "B" : null;
              return (
                <div
                  key={bot.id}
                  className={`flex items-center justify-between rounded-lg border p-2 ${
                    role ? "border-accent-purple bg-accent-purple/10" : "border-gray-800"
                  }`}
                >
                  <button onClick={() => selectParent(bot.id)} className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span>{GLYPH[bot.species] ?? "🧬"}</span>
                      <span className="text-sm font-medium">{bot.name}</span>
                      {role && <span className="badge-purple">Parent {role}</span>}
                    </div>
                    <div className="text-xs text-text-muted">
                      gen {bot.generation} ·{" "}
                      <span className={ret >= 0 ? "text-accent-green" : "text-accent-red"}>
                        {pct(ret)}
                      </span>
                      {bot.parentNames && ` · ${bot.parentNames[0]} × ${bot.parentNames[1]}`}
                    </div>
                  </button>
                  <button
                    onClick={() => remove(bot.id)}
                    className="ml-2 text-xs text-text-muted hover:text-accent-red"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Breeding pen */}
        <div className="card">
          <h3 className="mb-3 font-semibold">Breeding pen</h3>
          <div className="mb-3 flex items-center justify-center gap-3 text-sm">
            <ParentChip bot={a} role="A" />
            <span className="text-text-muted">×</span>
            <ParentChip bot={b} role="B" />
            <span className="text-text-muted">=</span>
            <span className="rounded-lg border border-accent-purple/50 bg-accent-purple/10 px-3 py-2 font-semibold text-accent-purple">
              {a && b ? (cross ? cross.name : "Hybrid") : "?"}
            </span>
          </div>

          <div className="mb-3">
            <div className="mb-1 text-xs text-text-secondary">Mutation perks</div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_MUTATIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => toggleMutation(m)}
                  title={mutationLabel(m)}
                  className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                    mutations.includes(m)
                      ? "bg-accent-purple/20 text-accent-purple border border-accent-purple/50"
                      : "border border-gray-700 text-text-muted hover:border-gray-500"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={breed}
            disabled={!a || !b}
            className="w-full rounded-lg bg-accent-purple px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-purple/80 disabled:opacity-40"
          >
            Breed & backtest
          </button>

          {childGenome && childResult && childRobust && (
            <div className="mt-4 rounded-lg border border-gray-800 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">
                  {cross ? cross.name : "Hybrid"} · gen {childGenome.generation}
                </span>
                <span className={childResult.metrics.totalReturn >= 0 ? "badge-green" : "badge-red"}>
                  {pct(childResult.metrics.totalReturn)}
                </span>
              </div>
              <EquityChart
                curve={childResult.equityCurve}
                initialCapital={DEFAULT_CONFIG.initialCapital}
                height={120}
              />
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-text-muted">
                  {childResult.metrics.trades} trades · win{" "}
                  {pct(childResult.metrics.winRate)} · Sharpe{" "}
                  {childResult.metrics.sharpe.toFixed(2)}
                </span>
                <span
                  className={
                    childRobust.verdict === "robust"
                      ? "badge-green"
                      : childRobust.verdict === "mixed"
                        ? "badge-yellow"
                        : "badge-red"
                  }
                >
                  {childRobust.verdict}
                </span>
              </div>
              <button
                onClick={saveChild}
                className="mt-3 w-full rounded-lg border border-accent-green/50 bg-accent-green/10 px-4 py-2 text-sm font-medium text-accent-green hover:bg-accent-green/20"
              >
                Save offspring to collection
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ParentChip({ bot, role }: { bot: SavedBot | null; role: string }) {
  return (
    <span
      className={`rounded-lg border px-3 py-2 ${
        bot ? "border-gray-700" : "border-dashed border-gray-700 text-text-muted"
      }`}
    >
      {bot ? `${GLYPH[bot.species] ?? "🧬"} ${bot.name}` : `Parent ${role}`}
    </span>
  );
}
