-- CompeteSync — joining by invite code that actually works
-- Run AFTER schema_phase3.sql (replaces its join_competition function).
--
-- What this fixes
--   1. Matching: "stack-88", "STACK 88" and "STACK88" are the same code (case, spaces and hyphens are ignored).
--   2. RLS: a non-member cannot SELECT from competitions, so the lookup happens inside a SECURITY DEFINER function.
--   3. Already a member: no error, the caller is simply told so (and their team role is updated if they sent one).
--   4. Team of 5: the existing enforce_team_size trigger still applies; its message is returned instead of a raw error.
--
-- The function identifies the caller with auth.uid(). It deliberately does NOT take a user id parameter:
-- a client-supplied id would let anyone add any user to any team.

-- ---------- 1. normalised code ----------
create or replace function public.normalize_invite_code(p text) returns text
language sql immutable as $$
  select regexp_replace(upper(coalesce(p, '')), '[^A-Z0-9]', '', 'g')
$$;

-- Two codes that differ only by punctuation or case must never coexist.
create unique index if not exists competitions_invite_code_norm_idx
  on public.competitions (public.normalize_invite_code(invite_code))
  where invite_code is not null;

-- ---------- 2. join ----------
drop function if exists public.join_competition(text, text);

create or replace function public.join_competition(p_code text, p_team_role text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  comp record;
  existing uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Harus masuk terlebih dahulu.');
  end if;
  if public.normalize_invite_code(p_code) = '' then
    return jsonb_build_object('success', false, 'error', 'Masukkan kode undangan.');
  end if;

  select id, title into comp
  from public.competitions
  where public.normalize_invite_code(invite_code) = public.normalize_invite_code(p_code)
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Kode undangan tidak ditemukan.');
  end if;

  select id into existing from public.competition_members where competition_id = comp.id and user_id = auth.uid();
  if existing is not null then
    update public.competition_members set team_role = coalesce(p_team_role, team_role) where id = existing;
    return jsonb_build_object('success', true, 'already_member', true, 'competition_id', comp.id, 'title', comp.title);
  end if;

  insert into public.competition_members (competition_id, user_id, role, team_role)
  values (comp.id, auth.uid(), 'member', p_team_role);

  return jsonb_build_object('success', true, 'already_member', false, 'competition_id', comp.id, 'title', comp.title);
exception
  when raise_exception then
    -- e.g. the team-size trigger ("maksimal 5 anggota")
    return jsonb_build_object('success', false, 'error', sqlerrm);
end $$;

revoke all on function public.join_competition(text, text) from public, anon;
grant execute on function public.join_competition(text, text) to authenticated;
