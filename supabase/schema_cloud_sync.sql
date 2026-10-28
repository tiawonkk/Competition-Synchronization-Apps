-- CompeteSync — cloud rooms: one competition shared between devices (used by /api/store)
-- Independent of the other schema files: it only adds two tables.
--
-- A "room" is one competition. Devices do not upload whole snapshots; they append small operations
-- ("put this task", "delete that note") to cs_events, and every device replays the ones it has not seen.
-- The invite code is the key to a room (cs_rooms.code_norm = the code without spaces, hyphens or case).
--
-- Only the server touches these tables, with the service-role key. Row Level Security is on and there are no
-- policies on purpose: the anon and authenticated roles can read and write nothing here.

create table if not exists public.cs_rooms (
  id          text primary key,                 -- the competition id created on the leader's device
  code_norm   text not null unique,             -- normalised invite code, e.g. 'STAC68'
  created_at  timestamptz not null default now()
);

create table if not exists public.cs_events (
  seq         bigint generated always as identity primary key,
  room_id     text not null references public.cs_rooms(id) on delete cascade,
  client_id   text not null,                    -- the browser tab that sent it, so it can skip its own events
  ops         jsonb not null,                   -- [{ k: 'task', id: '...', v: {...} }, { k: 'task', id: '...' } (= delete)]
  created_at  timestamptz not null default now()
);

create index if not exists cs_events_room_seq_idx on public.cs_events (room_id, seq);

alter table public.cs_rooms  enable row level security;
alter table public.cs_events enable row level security;
revoke all on public.cs_rooms, public.cs_events from anon, authenticated;
