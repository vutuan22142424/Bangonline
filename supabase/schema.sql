-- Run this in the Supabase SQL editor for your project.

create table if not exists rooms (
  id text primary key,               -- short room code, e.g. "ABCD12"
  status text not null default 'lobby', -- lobby | playing | finished
  created_at timestamptz not null default now(),
  max_players int not null default 7
);

create table if not exists room_players (
  room_id text not null references rooms(id) on delete cascade,
  player_id text not null,           -- random id generated client-side & stored in localStorage
  name text not null,
  seat int,
  joined_at timestamptz not null default now(),
  primary key (room_id, player_id)
);

-- Full authoritative game state (includes hidden hands/roles). Only ever
-- written/read by server code using the service role key.
create table if not exists game_states (
  room_id text primary key references rooms(id) on delete cascade,
  state jsonb not null,
  version int not null default 1,
  updated_at timestamptz not null default now()
);

-- Supabase Realtime only delivers postgres_changes events to a client if RLS
-- would let that client SELECT the row. Since game_states must stay fully
-- private (it contains other players' hidden hands/roles), the browser can
-- never subscribe to it directly. Instead we keep a tiny public "version
-- beacon" table: whenever the server mutates game_states, it also bumps this
-- row. Clients subscribe to THIS table for "something changed, go refetch
-- your redacted view via the API" notifications.
create table if not exists room_state_version (
  room_id text primary key references rooms(id) on delete cascade,
  version int not null default 1,
  updated_at timestamptz not null default now()
);

-- Enable Realtime on the public version beacon and room_players so clients
-- know when to refetch their redacted view / see who joined the lobby.
alter publication supabase_realtime add table room_state_version;
alter publication supabase_realtime add table room_players;

-- Row Level Security: lock down direct table access from the browser.
-- The browser (anon key) may only ever read room_players/rooms metadata and
-- the version beacon — and must NEVER read game_states directly (it contains
-- other players' hidden cards). All game reads/writes go through Next.js API
-- routes using the service role key, which bypasses RLS.
alter table rooms enable row level security;
alter table room_players enable row level security;
alter table game_states enable row level security;
alter table room_state_version enable row level security;

create policy "rooms are publicly readable" on rooms
  for select using (true);

create policy "room_players are publicly readable" on room_players
  for select using (true);

create policy "room_state_version is publicly readable" on room_state_version
  for select using (true);

-- No policies on game_states => no anon access at all (service role bypasses RLS).
