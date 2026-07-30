-- ─────────────────────────────────────────────────────────────
-- 1. 팀 보유 여부 — 표시용과 규칙용을 분리한다
--
-- 지금까지 크루 목록의 "팀 찾는 중" 은 is_teamed() 를 썼는데,
-- is_teamed 는 프로젝트가 CONFIRMED 일 때만 참입니다.
-- 그런데 confirm_team() 은 "모든 분야 정원이 다 차야" 실행되므로,
-- 정원을 못 채운 팀은 영영 확정되지 않고 그 팀에 수락된 크루도
-- 계속 "팀 찾는 중" 으로 남습니다. 목록이 현실과 어긋나는 원인입니다.
--
-- 그렇다고 is_teamed 자체를 고치면 안 됩니다. 이 함수는 표시용이 아니라
-- applications_insert RLS 의 `not is_teamed(auth.uid())` — 즉 "이미 팀이 있으면
-- 지원 불가" 규칙에도 쓰입니다. 확정 전 수락만으로 지원을 막아 버리면
-- 팀이 끝내 확정되지 않았을 때 그 크루는 어디에도 못 갑니다.
--
-- 그래서 표시용 has_team() 을 따로 둡니다.
-- ─────────────────────────────────────────────────────────────

create or replace function public.has_team(p_crew uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    -- 자기 프로젝트를 실제로 굴리고 있는 오너 (승인 대기·반려는 아직 팀이 아님)
    select 1 from public.projects pr
     where pr.owner_id = p_crew
       and pr.status in ('RECRUITING', 'CLOSED', 'CONFIRMED')
  ) or exists (
    -- 수락된 팀원 — 프로젝트 확정을 기다리지 않습니다
    select 1 from public.applications a
     where a.applicant_id = p_crew
       and a.status = 'ACCEPTED'
  );
$$;

-- teamed 의 의미를 has_team 으로 바꾸고, 확정 팀 여부는 새 컬럼으로 함께 둡니다.
-- (create or replace view 는 뒤에 컬럼 추가만 허용합니다)
create or replace view public.crew_team_status as
select c.id as crew_id,
       public.has_team(c.id)  as teamed,           -- 표시용
       public.is_teamed(c.id) as confirmed_teamed  -- 확정된 팀에 속했는지
  from public.crews c;
grant select on public.crew_team_status to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. 팀원 제안 (역방향 매칭)
--    지원이 "크루 → 프로젝트" 라면, 제안은 "오너 → 크루" 입니다.
--
--    수락하면 별도의 멤버십을 만들지 않고 applications 에 ACCEPTED 로 넣습니다.
--    그래야 project_members / project_slot_status / has_team / confirm_team 이
--    지금 그대로 동작합니다. invitations 는 '제안과 응답'만 기록합니다.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.invitations (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  crew_id      uuid not null references public.crews(id)    on delete cascade,
  field        text not null,
  message      text not null check (char_length(message) between 1 and 200),
  status       text not null default 'PENDING'
               check (status in ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELED')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists invitations_crew_idx    on public.invitations (crew_id, status);
create index if not exists invitations_project_idx on public.invitations (project_id);

-- 같은 프로젝트가 같은 크루에게 answer 대기 중인 제안은 하나만
create unique index if not exists invitations_one_active
  on public.invitations (project_id, crew_id)
  where status = 'PENDING';

alter table public.invitations enable row level security;

-- 받은 사람, 보낸 프로젝트의 오너, 그리고 코치만 볼 수 있습니다.
drop policy if exists invitations_read on public.invitations;
create policy invitations_read on public.invitations for select to authenticated
  using (
    crew_id = auth.uid()
    or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
    or public.is_admin()
  );

-- 쓰기는 전부 아래 RPC 로만 합니다 (정원·1인1팀 검사를 건너뛸 수 없게)
revoke insert, update, delete on public.invitations from authenticated, anon;

-- ── 제안 보내기 ────────────────────────────────────────────
create or replace function public.send_invitation(
  p_project_id uuid,
  p_crew_id    uuid,
  p_field      text,
  p_message    text
) returns public.invitations
language plpgsql security definer set search_path = public as $$
declare
  v_project public.projects;
  v_slot    public.project_slots;
  v_taken   int;
  v_row     public.invitations;
begin
  select * into v_project from public.projects where id = p_project_id;
  if not found then raise exception '프로젝트를 찾을 수 없어요'; end if;
  if v_project.owner_id is distinct from auth.uid() then
    raise exception '오너만 제안할 수 있어요';
  end if;
  if v_project.status <> 'RECRUITING' then
    raise exception '모집 중일 때만 제안할 수 있어요';
  end if;
  if p_crew_id = auth.uid() then
    raise exception '본인에게는 제안할 수 없어요';
  end if;

  -- 이미 팀이 있는 크루에게는 보내지 않습니다 (수락해도 1인 1팀에 걸립니다)
  if public.has_team(p_crew_id) then
    raise exception '이미 팀이 있는 크루예요';
  end if;

  select * into v_slot from public.project_slots
   where project_id = p_project_id and field = p_field;
  if not found then raise exception '모집하지 않는 분야예요'; end if;

  -- 정원이 남아 있는지 (수락된 인원 기준)
  select count(*) into v_taken from public.applications
   where project_id = p_project_id and field = p_field and status = 'ACCEPTED';
  if v_taken >= v_slot.capacity then
    raise exception '% 분야 정원이 이미 찼어요', p_field;
  end if;

  insert into public.invitations (project_id, crew_id, field, message)
  values (p_project_id, p_crew_id, p_field, btrim(p_message))
  returning * into v_row;
  return v_row;
exception
  when unique_violation then
    raise exception '이미 보낸 제안이 있어요';
end $$;

-- ── 제안 응답 (받은 사람) ──────────────────────────────────
create or replace function public.respond_invitation(p_id uuid, p_accept boolean)
returns public.invitations
language plpgsql security definer set search_path = public as $$
declare
  v_inv     public.invitations;
  v_project public.projects;
  v_slot    public.project_slots;
  v_taken   int;
begin
  select * into v_inv from public.invitations where id = p_id for update;
  if not found then raise exception '제안을 찾을 수 없어요'; end if;
  if v_inv.crew_id is distinct from auth.uid() then
    raise exception '받은 사람만 응답할 수 있어요';
  end if;
  if v_inv.status <> 'PENDING' then
    raise exception '이미 처리한 제안이에요';
  end if;

  if not p_accept then
    update public.invitations
       set status = 'DECLINED', responded_at = now()
     where id = p_id returning * into v_inv;
    return v_inv;
  end if;

  -- 수락 — 정원을 다시 확인합니다. 제안을 받아 둔 사이에 찼을 수 있어요.
  select * into v_project from public.projects where id = v_inv.project_id for update;
  if v_project.status <> 'RECRUITING' then
    raise exception '지금은 합류할 수 없는 프로젝트예요';
  end if;

  select * into v_slot from public.project_slots
   where project_id = v_inv.project_id and field = v_inv.field;
  select count(*) into v_taken from public.applications
   where project_id = v_inv.project_id and field = v_inv.field and status = 'ACCEPTED';
  if v_taken >= v_slot.capacity then
    raise exception '아쉽게도 % 분야 정원이 찼어요', v_inv.field;
  end if;

  -- 팀이 정해졌으니 나머지는 정리합니다.
  -- (동시 지원 3개 제한 트리거에 걸리지 않도록 먼저 비웁니다)
  update public.applications
     set status = 'CANCELED'
   where applicant_id = v_inv.crew_id
     and status = 'PENDING'
     and project_id <> v_inv.project_id;

  update public.invitations
     set status = 'CANCELED', responded_at = now()
   where crew_id = v_inv.crew_id and status = 'PENDING' and id <> p_id;

  -- 이 프로젝트에 이미 낸 지원이 있으면 그것을 수락 처리하고, 없으면 새로 만듭니다.
  if exists (
    select 1 from public.applications
     where project_id = v_inv.project_id and applicant_id = v_inv.crew_id
       and status in ('PENDING', 'ACCEPTED')
  ) then
    update public.applications
       set status = 'ACCEPTED', field = v_inv.field
     where project_id = v_inv.project_id and applicant_id = v_inv.crew_id
       and status in ('PENDING', 'ACCEPTED');
  else
    insert into public.applications (project_id, applicant_id, field, message, status)
    values (v_inv.project_id, v_inv.crew_id, v_inv.field,
            '팀원 제안을 수락했어요', 'ACCEPTED');
  end if;

  update public.invitations
     set status = 'ACCEPTED', responded_at = now()
   where id = p_id returning * into v_inv;
  return v_inv;
end $$;

-- ── 제안 취소 (보낸 오너) ──────────────────────────────────
create or replace function public.cancel_invitation(p_id uuid)
returns public.invitations
language plpgsql security definer set search_path = public as $$
declare v_inv public.invitations;
begin
  select * into v_inv from public.invitations where id = p_id;
  if not found then raise exception '제안을 찾을 수 없어요'; end if;
  if not exists (
    select 1 from public.projects p
     where p.id = v_inv.project_id and p.owner_id = auth.uid()
  ) then
    raise exception '보낸 오너만 취소할 수 있어요';
  end if;
  if v_inv.status <> 'PENDING' then
    raise exception '이미 처리된 제안이에요';
  end if;

  update public.invitations
     set status = 'CANCELED', responded_at = now()
   where id = p_id returning * into v_inv;
  return v_inv;
end $$;

grant execute on function public.send_invitation(uuid, uuid, text, text) to authenticated;
grant execute on function public.respond_invitation(uuid, boolean)       to authenticated;
grant execute on function public.cancel_invitation(uuid)                 to authenticated;
grant execute on function public.has_team(uuid)                    to anon, authenticated;
