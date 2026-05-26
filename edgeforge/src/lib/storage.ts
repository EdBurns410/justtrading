import type { IntakeAnswers, RankingResponse } from "./types";

const INTAKE_KEY = "edgeforge.intake.v1";
const RANKING_KEY = "edgeforge.ranking.v1";

export function saveIntake(intake: IntakeAnswers): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(INTAKE_KEY, JSON.stringify(intake));
}

export function loadIntake(): IntakeAnswers | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(INTAKE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as IntakeAnswers;
  } catch {
    return null;
  }
}

export function saveRanking(r: RankingResponse): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RANKING_KEY, JSON.stringify(r));
}

export function loadRanking(): RankingResponse | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(RANKING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RankingResponse;
  } catch {
    return null;
  }
}

export function clearAll(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(INTAKE_KEY);
  window.localStorage.removeItem(RANKING_KEY);
}
