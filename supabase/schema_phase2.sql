-- =====================================================================
-- CompeteSync — Phase 2 migration: Whiteboard + Realtime + task provenance
-- Run AFTER schema.sql.
-- =====================================================================

create type whiteboard_type as enum ('sticky', 'drawing', 'connector');
create type note_kind as enum ('ide', 'fitur', 'riset', 'kendala');

-- ---------- whiteboard_elements ----------
create table public.whiteboard_elements (
  id              uuid primary key default gen_random_uuid(),
  competition_id  uuid not null references public.competitions(id) on delete cascade,
  type            whiteboard_type not null,
  kind            note_kind,                         -- sticky notes only (Ide Utama, Fitur, Riset, Kendala)
  content         text not null default '',
  color           text not null default '#FEF08A',   -- sticky background, or stroke color for drawings
  position_x      double precision not null default 0,
  position_y      double precision not null default 0,
  points          jsonb,                             -- drawing / connector path: [[x,y], ...]
  votes           uuid[] not null default '{}',      -- voter user ids (one vote per member); count = cardinality(votes)
  created_by      uuid not null references public.users(id),
  task_id         uuid references public.tasks(id) on delete set null,   -- set when converted into a task
  updated_at      timestamptz not null default now(),
  constraint sticky_has_kind check (type <> 'sticky' or kind is not null),
  constraint path_has_points check (type = 'sticky' or points is not null)
);
create index whiteboard_competition_idx on public.whiteboard_elements(competition_id);
create index whiteboard_task_idx on public.whiteboard_elements(task_id);

-- Provenance: which sticky note a task came from (one-click "Jadikan Tugas")
alter table public.tasks add column source_note_id uuid references public.whiteboard_elements(id) on delete set null;

-- ---------- updated_at maintenance ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_whiteboard_touch
  before update on public.whiteboard_elements
  for each row execute function public.touch_updated_at();

-- ---------- Voting guard: members may only add/remove THEIR OWN vote ----------
-- Members can edit/move any note on the board, but the votes array may only change by the caller's own uuid.
create or replace function public.guard_votes() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  added   uuid[];
  removed uuid[];
begin
  if new.votes is distinct from old.votes then
    added   := array(select unnest(new.votes) except select unnest(old.votes));
    removed := array(select unnest(old.votes) except select unnest(new.votes));
    if exists (select 1 from unnest(added || removed) v where v <> auth.uid()) then
      raise exception 'You can only change your own vote';
    end if;
  end if;
  return new;
end $$;

create trigger trg_whiteboard_guard_votes
  before update on public.whiteboard_elements
  for each row execute function public.guard_votes();

-- ---------- Row Level Security ----------
alter table public.whiteboard_elements enable row level security;

create policy wb_select on public.whiteboard_elements for select using (public.is_member(competition_id));
create policy wb_insert on public.whiteboard_elements for insert
  with check (public.is_member(competition_id) and created_by = auth.uid());
create policy wb_update on public.whiteboard_elements for update
  using (public.is_member(competition_id)) with check (public.is_member(competition_id));
create policy wb_delete on public.whiteboard_elements for delete
  using (created_by = auth.uid() or public.is_leader(competition_id));

-- ---------- Realtime ----------
-- Postgres-changes feed (persisted state: notes, strokes, votes). FULL identity so DELETE events carry competition_id
-- and clients can filter `competition_id=eq.<id>`.
alter table public.whiteboard_elements replica identity full;
alter publication supabase_realtime add table public.whiteboard_elements;

-- Cursor positions and in-flight drag movement are NOT persisted: send them over a Realtime Broadcast channel
-- `whiteboard:<competition_id>` (see lib/integrations/whiteboard-realtime.ts) and commit the final position on drop.
-- Presence (who is online) uses the same channel. Restrict channel access with RLS on realtime.messages:
create policy "whiteboard channel members only" on realtime.messages for select
  using (
    realtime.topic() like 'whiteboard:%'
    and public.is_member((split_part(realtime.topic(), ':', 2))::uuid)
  );
create policy "whiteboard channel members send" on realtime.messages for insert
  with check (
    realtime.topic() like 'whiteboard:%'
    and public.is_member((split_part(realtime.topic(), ':', 2))::uuid)
  );

-- ---------- Calendar sync bookkeeping ----------
alter table public.tasks
  add column calendar_sync_status text not null default 'pending'
    check (calendar_sync_status in ('pending', 'synced', 'partial', 'failed', 'silenced')),
  add column calendar_synced_at timestamptz;
