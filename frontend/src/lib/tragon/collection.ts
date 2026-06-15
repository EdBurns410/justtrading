// The player's bot collection.
//
// For the public demo this lives in localStorage so it works with zero backend
// and no login. When Supabase is wired (build sequence M4), `save`/`load` move
// to the `bots` table — already scoped per-owner by row-level security — and
// this module becomes the offline fallback for anonymous play.

import type { Genome } from "@/lib/engine";

export interface SavedBot {
  id: string;
  name: string;
  species: string;
  generation: number;
  genome: Genome;
  /** Display names of the two parents, when this bot was bred. */
  parentNames?: [string, string];
  createdAt: number;
}

const KEY = "tragon_collection";
const MAX = 50;

export function loadCollection(): SavedBot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedBot[]) : [];
  } catch {
    return [];
  }
}

function persist(bots: SavedBot[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(bots.slice(0, MAX)));
}

export function saveBot(bot: SavedBot): SavedBot[] {
  const next = [bot, ...loadCollection()].slice(0, MAX);
  persist(next);
  return next;
}

export function removeBot(id: string): SavedBot[] {
  const next = loadCollection().filter((b) => b.id !== id);
  persist(next);
  return next;
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
}
