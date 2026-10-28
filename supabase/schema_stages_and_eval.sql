-- CompeteSync — multi-stage pipeline, post-mortem evaluation, large-file metadata
-- Run AFTER schema.sql, schema_phase2.sql and schema_phase3.sql (needs is_member / is_leader and cloud_files).

-- ---------- 0. prerequisites ----------
-- Fails fast with a readable message instead of a half-applied script.
do $$
begin
  if to_regclass('public.competitions') is null or to_regprocedure('public.is_leader(uuid)') is null then
    raise exception 'Jalankan supabase/schema.sql terlebih dahulu.';
  end if;
  if to_regclass('public.cloud_files') is null then
    raise exception 'Tabel cloud_files belum ada. Jalankan supabase/schema_phase3.sql terlebih dahulu (urutan: schema.sql, schema_phase2.sql, schema_phase3.sql, lalu file ini).';
  end if;
end $$;

-- ---------- 1. enums ----------
do $$ begin
  create type stage_status as enum ('upcoming', 'active', 'passed', 'eliminated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type outcome_tier as enum ('juara1', 'juara2', 'juara3', 'harapan', 'finalis', 'gugur_semifinal', 'gugur_kualifikasi');
exception when duplicate_object then null; end $$;

-- ---------- 2. competition_stages ----------
-- One row per elimination round (Penyisihan, Semifinal, Grand Final, or a custom one). Only the active round has
-- real tasks; `plan` keeps the guidebook's dated items for a locked round until the team advances to it.
create table if not exists public.competition_stages (
  id              uuid primary key default gen_random_uuid(),
  competition_id  uuid not null references public.competitions(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 80),
  order_index     int  not null,
  status          stage_status not null default 'upcoming',
  deadline        timestamptz not null,
  plan            jsonb,                      -- { marks: [{name, date}], tasks: [{title, description, dueDate, priority}] }
  decided_at      timestamptz,
  created_at      timestamptz not null default now(),
  -- Inserting a round re-numbers its siblings inside one transaction, so the check is deferred to commit.
  unique (competition_id, order_index) deferrable initially deferred
);
create index if not exists competition_stages_competition_idx on public.competition_stages(competition_id, order_index);

-- At most one active round per competition.
create unique index if not exists competition_stages_one_active
  on public.competition_stages(competition_id) where status = 'active';

alter table public.milestones add column if not exists stage_id uuid references public.competition_stages(id) on delete cascade;
alter table public.tasks      add column if not exists stage_id uuid references public.competition_stages(id) on delete cascade;
create index if not exists milestones_stage_idx on public.milestones(stage_id);
create index if not exists tasks_stage_idx on public.tasks(stage_id);

-- Rubric, deliverable formats and rules read from the guidebook.
alter table public.competitions add column if not exists guide jsonb;  -- { rubric: [{criterion, weight}], deliverables: [], rules: [] }

alter table public.competition_stages enable row level security;
create policy stages_select on public.competition_stages for select using (public.is_member(competition_id));
create policy stages_write  on public.competition_stages for all
  using (public.is_leader(competition_id)) with check (public.is_leader(competition_id));

-- Stage decision in one atomic step: mark the active round passed/eliminated and unlock the next one.
-- The app then inserts the next round's milestones and tasks (generated from stage.plan or the weekly template).
create or replace function public.decide_stage(p_stage uuid, p_result stage_status) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s public.competition_stages%rowtype;
  next_id uuid;
begin
  if p_result not in ('passed', 'eliminated') then
    raise exception 'Hasil babak harus passed atau eliminated';
  end if;
  select * into s from public.competition_stages where id = p_stage;
  if not found then raise exception 'Babak tidak ditemukan'; end if;
  if not public.is_leader(s.competition_id) then raise exception 'Hanya Ketua yang dapat memutuskan hasil babak'; end if;
  if s.status <> 'active' then raise exception 'Hanya babak yang sedang berjalan yang dapat diputuskan'; end if;

  update public.competition_stages set status = p_result, decided_at = now() where id = p_stage;

  if p_result = 'passed' then
    select id into next_id from public.competition_stages
      where competition_id = s.competition_id and order_index > s.order_index
      order by order_index limit 1;
    if next_id is not null then
      update public.competition_stages set status = 'active' where id = next_id;
    end if;
  else
    -- Eliminated: silence every remaining reminder of this competition.
    update public.tasks set alarm_active = false, gcal_event_id = null, outlook_event_id = null
      where competition_id = s.competition_id and not is_completed;
  end if;
  return next_id;
end $$;

revoke all on function public.decide_stage(uuid, stage_status) from public, anon;
grant execute on function public.decide_stage(uuid, stage_status) to authenticated;

-- ---------- 3. competition_evaluations (post-mortem) ----------
create table if not exists public.competition_evaluations (
  id               uuid primary key default gen_random_uuid(),
  competition_id   uuid not null unique references public.competitions(id) on delete cascade,
  outcome          outcome_tier not null,
  rank_text        text,                      -- "Rank 2 dari 150 tim"
  score_text       text,                      -- "92,4"
  certificate_url  text check (certificate_url is null or certificate_url ~* '^https://'),
  archive_url      text check (archive_url is null or archive_url ~* '^https://'),
  went_well        text not null default '',
  went_wrong       text not null default '',
  judge_feedback   text not null default '',
  insights         jsonb,                     -- output of the post-mortem analysis (list of advice strings)
  completed_at     timestamptz not null default now(),
  created_by       uuid references public.users(id) on delete set null default auth.uid()
);

alter table public.competition_evaluations enable row level security;
create policy evaluations_select on public.competition_evaluations for select using (public.is_member(competition_id));
create policy evaluations_write  on public.competition_evaluations for all
  using (public.is_leader(competition_id)) with check (public.is_leader(competition_id));

-- Final report history: the app stores "weekly" | "stage" | "final" next to the existing advisor_reports rows.
alter table public.advisor_reports add column if not exists kind text not null default 'weekly' check (kind in ('weekly', 'stage', 'final'));

-- ---------- 4. chunked cloud file metadata ----------
-- Large files go straight to Supabase Storage (TUS, 6 MB chunks) or OneDrive (Graph upload session, 10 MiB chunks);
-- this table only records them. A row exists while the upload runs, so a dropped connection can resume.
alter table public.cloud_files drop constraint if exists cloud_files_provider_check;
alter table public.cloud_files add  constraint cloud_files_provider_check check (provider in ('onedrive', 'gdrive', 'supabase'));

alter table public.cloud_files drop constraint if exists cloud_files_url_check;
alter table public.cloud_files alter column url drop not null;          -- Supabase objects are addressed by storage_path
alter table public.cloud_files add  constraint cloud_files_url_check check (url is null or url ~* '^https://');

alter table public.cloud_files
  add column if not exists size_bytes     bigint check (size_bytes is null or size_bytes >= 0),
  add column if not exists chunk_size     int,
  add column if not exists chunk_count    int,
  add column if not exists chunks_done    int not null default 0,
  add column if not exists upload_status  text not null default 'complete' check (upload_status in ('pending', 'uploading', 'paused', 'complete', 'failed')),
  add column if not exists storage_path   text,                          -- "<competition_id>/<file_id>/<name>" in the vault bucket
  add column if not exists upload_url     text;                          -- Graph uploadUrl or TUS upload id, only while uploading

-- Private bucket for the vault. Object paths start with the competition id, which the policies below check.
insert into storage.buckets (id, name, public, file_size_limit)
values ('vault', 'vault', false, 5368709120)  -- 5 GB per object
on conflict (id) do nothing;

create policy vault_read on storage.objects for select to authenticated
  using (bucket_id = 'vault' and public.is_member((split_part(name, '/', 1))::uuid));
create policy vault_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'vault' and public.is_member((split_part(name, '/', 1))::uuid));
create policy vault_delete on storage.objects for delete to authenticated
  using (bucket_id = 'vault' and public.is_leader((split_part(name, '/', 1))::uuid));

-- ---------- 5. backfill ----------
-- Existing competitions get one stage and their tasks/milestones join it.
insert into public.competition_stages (competition_id, name, order_index, status, deadline)
select c.id, 'Babak Utama', 0,
       case when c.status = 'archived' then 'passed'::stage_status else 'active'::stage_status end,
       c.submission_deadline
from public.competitions c
where not exists (select 1 from public.competition_stages s where s.competition_id = c.id);

update public.milestones m set stage_id = s.id from public.competition_stages s
  where m.stage_id is null and s.competition_id = m.competition_id and s.order_index = 0;
update public.tasks t set stage_id = s.id from public.competition_stages s
  where t.stage_id is null and s.competition_id = t.competition_id and s.order_index = 0;
