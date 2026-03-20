const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Types matching backend responses

export interface DashboardStats {
  total_events: number;
  total_decisions: number;
  total_trades: number;
  total_outcomes: number;
  active_bots: number;
  live_bots: number;
  total_pnl: number;
  win_rate: number;
}

export interface EventRecord {
  id: string;
  source: string;
  title: string;
  event_type: string;
  first_seen_at: string;
  published_at: string | null;
  ingested_at: string;
  sentiment_score: number | null;
  confidence_score: number | null;
  affected_instruments: string[] | null;
}

export interface DecisionRecord {
  id: string;
  bot_id: string;
  action: string;
  instrument: string | null;
  confidence: number | null;
  reason: string | null;
  all_risk_checks_passed: boolean;
  decision_at: string;
}

export interface ExecutionRecord {
  id: string;
  instrument: string;
  direction: string;
  size: number;
  fill_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  slippage: number | null;
  status: string;
  order_submitted_at: string;
}

export interface OutcomeRecord {
  id: string;
  realised_pnl: number;
  realised_pnl_pips: number | null;
  max_adverse_excursion: number | null;
  max_favourable_excursion: number | null;
  time_in_trade_seconds: number | null;
  exit_reason: string;
  reaction_time_seconds: number | null;
  decision_latency_seconds: number | null;
  execution_latency_seconds: number | null;
}

export interface BotRecord {
  id: string;
  bot_id: string;
  name: string;
  strategy_type: string;
  version: string;
  stage: string;
  allowed_instruments: string[];
  kill_switch_active: boolean;
  created_at: string;
}

export interface RecentTrade {
  id: string;
  instrument: string;
  direction: string;
  size: number;
  fill_price: number | null;
  status: string;
  submitted_at: string;
  bot_id: string | null;
  confidence: number | null;
  reason: string | null;
}
