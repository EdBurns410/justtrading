-- Tragon Bots — data model (build plan section 6).
--
-- The genome is kept embedded as jsonb on `bots` rather than normalised into
-- many tables: it changes shape as the game grows, and JSON keeps that cheap.
-- Auth is Supabase's built-in `auth.users`.

-- ---------------------------------------------------------------------------
-- Fixed historical challenge sets and their candles.
-- ---------------------------------------------------------------------------
create table if not exists datasets (
  id          text primary key,                 -- e.g. 'btc-4h-2024h1'
  asset       text not null,
  timeframe   text not null,                     -- '1h' | '4h' | '1d'
  date_range  daterange,
  source      text not null default 'ccxt',      -- 'ccxt' | 'synthetic'
  created_at  timestamptz not null default now()
);

create table if not exists market_bars (
  dataset_id  text not null references datasets(id) on delete cascade,
  asset       text not null,
  timeframe   text not null,
  ts          bigint not null,                   -- unix seconds
  open        double precision not null,
  high        double precision not null,
  low         double precision not null,
  close       double precision not null,
  volume      double precision not null,
  primary key (dataset_id, asset, ts)
);

-- ---------------------------------------------------------------------------
-- Bots (genomes) owned by users.
-- ---------------------------------------------------------------------------
create table if not exists bots (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  species     text not null,
  genome      jsonb not null,                    -- the full strategy genome
  parent_ids  uuid[],                            -- lineage when bred
  generation  int not null default 1,
  cosmetic    jsonb,                             -- skins / visual flair (phase 1)
  created_at  timestamptz not null default now()
);
create index if not exists bots_owner_idx on bots(owner_id);

-- Lineage of breeding (parent_a + parent_b -> child).
create table if not exists breeds (
  id        uuid primary key default gen_random_uuid(),
  parent_a  uuid not null references bots(id) on delete cascade,
  parent_b  uuid not null references bots(id) on delete cascade,
  child_id  uuid not null references bots(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Backtests. `verified = true` rows were produced by the server-side
-- authoritative run against fixed data + fixed params (leaderboard-eligible).
-- ---------------------------------------------------------------------------
create table if not exists backtests (
  id            uuid primary key default gen_random_uuid(),
  bot_id        uuid not null references bots(id) on delete cascade,
  dataset_id    text not null references datasets(id),
  params        jsonb not null,                  -- cost model etc.
  metrics       jsonb not null,
  equity_curve  jsonb,
  robustness    jsonb,
  verified      boolean not null default false,
  run_at        timestamptz not null default now()
);
create index if not exists backtests_bot_idx on backtests(bot_id);

-- ---------------------------------------------------------------------------
-- Seasons + leaderboard.
-- ---------------------------------------------------------------------------
create table if not exists seasons (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  dataset_id  text not null references datasets(id),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null
);

create table if not exists leaderboard_entries (
  id         uuid primary key default gen_random_uuid(),
  bot_id     uuid not null references bots(id) on delete cascade,
  season_id  uuid references seasons(id) on delete cascade,
  score      double precision not null,
  rank       int,
  metrics    jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists leaderboard_score_idx
  on leaderboard_entries(season_id, score desc);

-- ---------------------------------------------------------------------------
-- Row-level security: a user only sees/edits their own bots and backtests.
-- Datasets, market_bars, seasons and the leaderboard are world-readable.
-- ---------------------------------------------------------------------------
alter table bots enable row level security;
alter table backtests enable row level security;
alter table breeds enable row level security;

drop policy if exists bots_owner_rw on bots;
create policy bots_owner_rw on bots
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists backtests_owner_rw on backtests;
create policy backtests_owner_rw on backtests
  for all using (
    exists (select 1 from bots b where b.id = backtests.bot_id and b.owner_id = auth.uid())
  );

drop policy if exists breeds_owner_r on breeds;
create policy breeds_owner_r on breeds
  for select using (
    exists (select 1 from bots b where b.id = breeds.child_id and b.owner_id = auth.uid())
  );

-- Public read for reference + competition data.
alter table datasets enable row level security;
alter table market_bars enable row level security;
alter table seasons enable row level security;
alter table leaderboard_entries enable row level security;

drop policy if exists datasets_public_r on datasets;
create policy datasets_public_r on datasets for select using (true);
drop policy if exists market_bars_public_r on market_bars;
create policy market_bars_public_r on market_bars for select using (true);
drop policy if exists seasons_public_r on seasons;
create policy seasons_public_r on seasons for select using (true);
drop policy if exists leaderboard_public_r on leaderboard_entries;
create policy leaderboard_public_r on leaderboard_entries for select using (true);
