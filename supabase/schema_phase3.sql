-- CompeteSync — Phase 3: invite codes, team roles, Cloud Vault, weekly auto-send
-- Run AFTER schema.sql and schema_phase2.sql.

-- ---------- 1. columns ----------
alter table public.competitions
  add column if not exists invite_code       text unique,
  add column if not exists auto_send_weekly  boolean not null default false;

alter table public.competition_members
  add column if not exists team_role text;   -- "Hustler / Lead", "Hacker / AI & Backend", "Hipster / UI-UX", "Researcher"

-- ---------- 2. invite code generator ("Hackathon Nasional AI" -> HACK-88) ----------
create or replace function public.gen_invite_code(p_title text) returns text
language plpgsql as $$
declare
  prefix text := left(regexp_replace(upper(coalesce(p_title, '')), '[^A-Z]', '', 'g'), 4);
  candidate text;
begin
  if prefix = '' then prefix := 'TIM'; end if;
  loop
    candidate := prefix || '-' || lpad((10 + floor(random() * 90))::int::text, 2, '0');
    exit when not exists (select 1 from public.competitions where invite_code = candidate);
  end loop;
  return candidate;
end $$;

create or replace function public.competitions_set_invite_code() returns trigger
language plpgsql as $$
begin
  if new.invite_code is null then
    new.invite_code := public.gen_invite_code(new.title);
  end if;
  return new;
end $$;

drop trigger if exists trg_competitions_invite_code on public.competitions;
create trigger trg_competitions_invite_code
  before insert on public.competitions
  for each row execute function public.competitions_set_invite_code();

-- Backfill competitions that already exist.
update public.competitions set invite_code = public.gen_invite_code(title) where invite_code is null;

-- ---------- 3. join by code ----------
-- A non-member can't read `competitions` (RLS), so joining goes through this security-definer function.
-- It validates the code and role, then inserts the membership; the team-size trigger still enforces max 5.
create or replace function public.join_competition(p_code text, p_team_role text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  comp_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Harus masuk terlebih dahulu';
  end if;

  select id into comp_id from public.competitions where upper(invite_code) = upper(trim(p_code));
  if comp_id is null then
    raise exception 'Kode undangan tidak ditemukan';
  end if;

  if exists (select 1 from public.competition_members where competition_id = comp_id and user_id = auth.uid()) then
    raise exception 'Anda sudah menjadi anggota lomba ini';
  end if;

  insert into public.competition_members (competition_id, user_id, role, team_role)
  values (comp_id, auth.uid(), 'member', p_team_role);
  return comp_id;
end $$;

revoke all on function public.join_competition(text, text) from public, anon;
grant execute on function public.join_competition(text, text) to authenticated;

-- ---------- 4. cloud_files (Cloud Vault) ----------
create table if not exists public.cloud_files (
  id              uuid primary key default gen_random_uuid(),
  competition_id  uuid not null references public.competitions(id) on delete cascade,
  title           text not null,
  kind            text not null default 'other' check (kind in ('guidebook','diagram','deck','zip','other')),
  provider        text not null check (provider in ('onedrive','gdrive')),
  url             text not null check (url ~* '^https://'),
  meta            text,
  added_by        uuid references public.users(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now()
);
create index if not exists cloud_files_competition_idx on public.cloud_files(competition_id);

alter table public.cloud_files enable row level security;
create policy cloud_files_select on public.cloud_files for select using (public.is_member(competition_id));
create policy cloud_files_insert on public.cloud_files for insert with check (public.is_member(competition_id));
create policy cloud_files_delete on public.cloud_files for delete using (public.is_leader(competition_id) or added_by = auth.uid());

-- ---------- 5. weekly auto-send ----------
-- /api/advisor-report (GET, Bearer CRON_SECRET) should only mail competitions that opted in:
--   select id from competitions where status = 'active' and auto_send_weekly and advisor_email is not null;
-- Schedule it for Sunday 19:00 WIB = Sunday 12:00 UTC, i.e. the cron expression "0 12 * * 0".
