-- ═══════════════════════════════════════════════════════════════
-- PuzzleChain — Supabase schema
-- Run this once in your Supabase project's SQL editor.
-- Dashboard → SQL Editor → New query → paste → Run
-- ═══════════════════════════════════════════════════════════════

-- 1. Community puzzles (user-uploaded, globally visible to everyone)
create table if not exists community_puzzles (
  id           bigint primary key,
  url          text not null,
  title        text not null,
  description  text default '',
  tags         text[] default '{}',
  author       text default '',       -- wallet address
  author_name  text default '',
  created_at   bigint not null,
  is_hidden    boolean default false
);

-- 2. Solve history — every completed puzzle per user (minted or not)
--    Associated by wallet address so it follows the user across devices.
create table if not exists solve_history (
  id           uuid primary key default gen_random_uuid(),
  address      text not null,         -- solver's wallet address (lowercase)
  puzzle_id    bigint not null,
  puzzle_title text default '',
  pieces       int not null,
  secs         int not null,
  on_chain     boolean default false,
  tx_hash      text,
  token_id     text,
  token_uri    text,
  minted_at    bigint,
  ts           bigint not null        -- unix ms timestamp of the solve
);
create index if not exists solve_history_address on solve_history(address);

-- 3. Leaderboard — only on-chain verified entries
--    Best per wallet per (puzzle_id, pieces) combination is ranked client-side.
create table if not exists leaderboard (
  id           uuid primary key default gen_random_uuid(),
  puzzle_id    bigint not null,
  puzzle_title text default '',
  pieces       int not null,
  secs         int not null,
  username     text default 'Guest',  -- display name at mint time (snapshot)
  address      text,                  -- solver wallet address (lowercase)
  tx_hash      text,
  token_id     text,
  token_uri    text,
  minted_at    bigint,
  ts           bigint                 -- original solve timestamp
);
create index if not exists leaderboard_puzzle on leaderboard(puzzle_id, pieces);

-- ═══════════════════════════════════════════════════════════════
-- Row Level Security
-- We use the service key server-side only, so RLS can be set to
-- allow everything (the service key bypasses RLS anyway).
-- If you later add Supabase Auth, tighten these policies.
-- ═══════════════════════════════════════════════════════════════
alter table community_puzzles  enable row level security;
alter table solve_history      enable row level security;
alter table leaderboard        enable row level security;

-- Allow all operations via the service key (server-side only).
-- These policies make no difference when using the service key, but
-- they document intent: the anon role never reaches this DB directly.
create policy "service_all" on community_puzzles  for all using (true);
create policy "service_all" on solve_history      for all using (true);
create policy "service_all" on leaderboard        for all using (true);
