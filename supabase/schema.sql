-- =====================================================================
-- CompeteSync — Supabase PostgreSQL schema (Phase 1)
-- Run in the Supabase SQL editor or as a migration.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Enums ----------
create type member_role as enum ('leader', 'member', 'advisor');
create type task_priority as enum ('low', 'medium', 'high', 'critical');
create type competition_status as enum ('planning', 'active', 'submitted', 'archived');
create type report_status as enum ('draft', 'queued', 'sent', 'failed');

-- ---------- 1. users (profile mirror of auth.users) ----------
create table public.users (
  id                   uuid primary key references auth.users(id) on delete cascade,
  full_name            text not null,
  email_google         text unique,
  email_microsoft      text unique,
  avatar_url           text,
  google_refresh_token text,   -- encrypt at rest (Supabase Vault) in production
  ms_refresh_token     text,   -- encrypt at rest (Supabase Vault) in production
  created_at           timestamptz not null default now(),
  constraint users_has_email check (email_google is not null or email_microsoft is not null)
);

-- ---------- 2. competitions ----------
create table public.competitions (
  id                   uuid primary key default gen_random_uuid(),
  title                text not null,
  category             text not null,                 -- Hackathon, CTF, UI/UX, Business Case, ...
  theme                text,
  start_date           date not null default current_date,
  submission_deadline  timestamptz not null,
  readiness_score      numeric(5,2) not null default 0 check (readiness_score between 0 and 100),
  advisor_name         text,
  advisor_email        text,
  onedrive_folder_url  text,
  gdrive_folder_url    text,
  status               competition_status not null default 'active',
  created_by           uuid not null references public.users(id),
  created_at           timestamptz not null default now(),
  constraint deadline_after_start check (submission_deadline::date >= start_date)
);
create index competitions_created_by_idx on public.competitions(created_by);
create index competitions_deadline_idx on public.competitions(submission_deadline);

-- ---------- 3. competition_members ----------
create table public.competition_members (
  id              uuid primary key default gen_random_uuid(),
  competition_id  uuid not null references public.competitions(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  role            member_role not null default 'member',
  joined_at       timestamptz not null default now(),
  unique (competition_id, user_id)
);
create index cm_user_idx on public.competition_members(user_id);
create index cm_competition_idx on public.competition_members(competition_id);

-- Team size guard: max 5 non-advisor members per competition.
create or replace function public.enforce_team_size() returns trigger
language plpgsql as $$
begin
  if new.role <> 'advisor' and (
    select count(*) from public.competition_members
    where competition_id = new.competition_id and role <> 'advisor'
  ) >= 5 then
    raise exception 'Team is limited to 5 members per competition';
  end if;
  return new;
end $$;

create trigger trg_enforce_team_size
  before insert on public.competition_members
  for each row execute function public.enforce_team_size();

-- ---------- 4. milestones ----------
create table public.milestones (
  id              uuid primary key default gen_random_uuid(),
  competition_id  uuid not null references public.competitions(id) on delete cascade,
  title           text not null,
  target_date     date not null,
  order_index     int not null default 0
);
create index milestones_competition_idx on public.milestones(competition_id, order_index);

-- ---------- 5. tasks ----------
create table public.tasks (
  id               uuid primary key default gen_random_uuid(),
  competition_id   uuid not null references public.competitions(id) on delete cascade,
  milestone_id     uuid references public.milestones(id) on delete set null,
  assigned_to      uuid references public.users(id) on delete set null,
  title            text not null,
  description      text,
  due_date         timestamptz not null,
  priority         task_priority not null default 'medium',
  is_completed     boolean not null default false,
  completed_at     timestamptz,
  proof_url        text,
  gcal_event_id    text,
  outlook_event_id text,
  alarm_active     boolean not null default true,
  created_at       timestamptz not null default now(),
  -- Stop-on-Confirm: a task can only be completed together with a proof link
  constraint completed_requires_proof check (not is_completed or proof_url is not null)
);
create index tasks_competition_idx on public.tasks(competition_id);
create index tasks_assignee_due_idx on public.tasks(assigned_to, due_date) where is_completed = false;
create index tasks_milestone_idx on public.tasks(milestone_id);

-- Stop-on-Confirm: completing a task silences its alarm and stamps completion time.
create or replace function public.tasks_before_write() returns trigger
language plpgsql as $$
begin
  if new.is_completed then
    new.alarm_active := false;
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;
  return new;
end $$;

create trigger trg_tasks_before_write
  before insert or update on public.tasks
  for each row execute function public.tasks_before_write();

-- ---------- Readiness score auto-recalculation ----------
-- Score = 70% completed-task ratio + 30% deliverable ratio (completed tasks with proof_url).
-- Critical/high tasks weigh more so that big items move the needle.
create or replace function public.compute_readiness(p_competition uuid) returns numeric
language sql stable as $$
  with w as (
    select
      case priority when 'critical' then 4 when 'high' then 3 when 'medium' then 2 else 1 end as weight,
      is_completed,
      (proof_url is not null) as has_proof
    from public.tasks where competition_id = p_competition
  )
  select coalesce(round(
    100 * (
      0.7 * (sum(case when is_completed then weight else 0 end)::numeric / nullif(sum(weight), 0)) +
      0.3 * (sum(case when is_completed and has_proof then weight else 0 end)::numeric / nullif(sum(weight), 0))
    ), 2), 0)
  from w;
$$;

create or replace function public.recalc_readiness() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  affected uuid;
begin
  affected := coalesce(new.competition_id, old.competition_id);
  update public.competitions
     set readiness_score = public.compute_readiness(affected)
   where id = affected;
  if tg_op = 'UPDATE' and old.competition_id is distinct from new.competition_id then
    update public.competitions
       set readiness_score = public.compute_readiness(old.competition_id)
     where id = old.competition_id;
  end if;
  return null;
end $$;

create trigger trg_tasks_recalc_readiness
  after insert or update or delete on public.tasks
  for each row execute function public.recalc_readiness();

-- ---------- 6. advisor_reports ----------
create table public.advisor_reports (
  id              uuid primary key default gen_random_uuid(),
  competition_id  uuid not null references public.competitions(id) on delete cascade,
  week_number     int not null check (week_number > 0),
  report_html     text not null,
  sent_to_email   text not null,
  sent_at         timestamptz,
  status          report_status not null default 'draft',
  unique (competition_id, week_number)
);
create index advisor_reports_competition_idx on public.advisor_reports(competition_id);

-- ---------- Auth: auto-create profile on sign-up (Google / Azure AD) ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  provider text := new.raw_app_meta_data ->> 'provider';
begin
  insert into public.users (id, full_name, email_google, email_microsoft, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    case when provider = 'google' then new.email end,
    case when provider in ('azure', 'microsoft') then new.email end,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.users               enable row level security;
alter table public.competitions        enable row level security;
alter table public.competition_members enable row level security;
alter table public.milestones          enable row level security;
alter table public.tasks               enable row level security;
alter table public.advisor_reports     enable row level security;

-- Membership helpers (security definer avoids recursive RLS evaluation)
create or replace function public.is_member(p_competition uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.competition_members
    where competition_id = p_competition and user_id = auth.uid()
  );
$$;

create or replace function public.is_leader(p_competition uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.competition_members
    where competition_id = p_competition and user_id = auth.uid() and role = 'leader'
  );
$$;

-- users: read self + teammates; update self only
create policy users_select on public.users for select using (
  id = auth.uid() or exists (
    select 1 from public.competition_members a
    join public.competition_members b on a.competition_id = b.competition_id
    where a.user_id = auth.uid() and b.user_id = public.users.id
  )
);
create policy users_update_self on public.users for update using (id = auth.uid()) with check (id = auth.uid());

-- competitions: members read; creator inserts; leader updates/deletes
create policy competitions_select on public.competitions for select using (public.is_member(id) or created_by = auth.uid());
create policy competitions_insert on public.competitions for insert with check (created_by = auth.uid());
create policy competitions_update on public.competitions for update using (public.is_leader(id)) with check (public.is_leader(id));
create policy competitions_delete on public.competitions for delete using (public.is_leader(id));

-- competition_members: members read roster; leader manages; creator can bootstrap self as leader
create policy cm_select on public.competition_members for select using (public.is_member(competition_id));
create policy cm_insert on public.competition_members for insert with check (
  public.is_leader(competition_id)
  or (
    user_id = auth.uid() and role = 'leader'
    and exists (select 1 from public.competitions c where c.id = competition_id and c.created_by = auth.uid())
  )
);
create policy cm_update on public.competition_members for update using (public.is_leader(competition_id));
create policy cm_delete on public.competition_members for delete using (public.is_leader(competition_id) or user_id = auth.uid());

-- milestones: members read; leader writes
create policy milestones_select on public.milestones for select using (public.is_member(competition_id));
create policy milestones_write  on public.milestones for all using (public.is_leader(competition_id)) with check (public.is_leader(competition_id));

-- tasks: members read; leader writes; assignee may update own task (complete + upload proof)
create policy tasks_select on public.tasks for select using (public.is_member(competition_id));
create policy tasks_insert on public.tasks for insert with check (public.is_leader(competition_id));
create policy tasks_delete on public.tasks for delete using (public.is_leader(competition_id));
create policy tasks_update on public.tasks for update
  using (public.is_leader(competition_id) or assigned_to = auth.uid())
  with check (public.is_leader(competition_id) or assigned_to = auth.uid());

-- advisor_reports: members read; leader writes (sending is done server-side with the service role)
create policy reports_select on public.advisor_reports for select using (public.is_member(competition_id));
create policy reports_write  on public.advisor_reports for all using (public.is_leader(competition_id)) with check (public.is_leader(competition_id));
