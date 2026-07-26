-- 0006: 프로젝트 생명주기(코치 승인 · 팀 확정/되돌리기) + 1인 1팀 강제

-- ─────────────────────────────────────────────────────────────
-- 1. 상태 확장
--    PENDING(코치 승인 대기) → RECRUITING → CLOSED(모집 마감) → CONFIRMED(팀 확정)
--    REJECTED(코치 반려)
-- ─────────────────────────────────────────────────────────────
alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects
  add constraint projects_status_check
  check (status in ('PENDING', 'RECRUITING', 'CLOSED', 'CONFIRMED', 'REJECTED'));

-- ─────────────────────────────────────────────────────────────
-- 2. "이 크루가 이미 확정된 팀에 속해 있나?" (1인 1팀 판정)
--    = 확정된 프로젝트의 오너이거나, 확정된 프로젝트에 수락된 지원자
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_teamed(p_crew uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects pr
     where pr.owner_id = p_crew and pr.status = 'CONFIRMED'
  ) or exists (
    select 1 from public.applications a
      join public.projects pr on pr.id = a.project_id
     where a.applicant_id = p_crew and a.status = 'ACCEPTED' and pr.status = 'CONFIRMED'
  );
$$;

-- 공개용: 크루가 팀에 속했는지 (크루 목록의 "팀 찾는 중" 표시)
create or replace view public.crew_team_status as
select c.id as crew_id, public.is_teamed(c.id) as teamed
  from public.crews c;
grant select on public.crew_team_status to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. 코치(관리자) 승인 — PENDING 만 게시 가능
-- ─────────────────────────────────────────────────────────────
create or replace function public.approve_project(p_id uuid, p_approve boolean)
returns public.projects language plpgsql security definer set search_path = public as $$
declare v_project public.projects;
begin
  if not public.is_admin() then raise exception '코치만 승인할 수 있어요'; end if;
  update public.projects
     set status = case when p_approve then 'RECRUITING' else 'REJECTED' end
   where id = p_id and status in ('PENDING', 'REJECTED')
   returning * into v_project;
  if not found then raise exception '승인 대기 상태의 프로젝트가 아니에요'; end if;
  return v_project;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 4. 오너의 모집 중단/재개 (#4: 오너가 다른 팀에 합류하려 할 때)
--    승인된 프로젝트만, 확정 전에만.
-- ─────────────────────────────────────────────────────────────
create or replace function public.set_recruiting(p_id uuid, p_open boolean)
returns public.projects language plpgsql security definer set search_path = public as $$
declare v_project public.projects;
begin
  update public.projects
     set status = case when p_open then 'RECRUITING' else 'CLOSED' end
   where id = p_id and owner_id = auth.uid() and status in ('RECRUITING', 'CLOSED')
   returning * into v_project;
  if not found then raise exception '모집 상태를 바꿀 수 없어요'; end if;
  return v_project;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 5. 팀 확정 (#2) — 1인 1팀을 원자적으로 강제 (#7)
-- ─────────────────────────────────────────────────────────────
create or replace function public.confirm_team(p_id uuid)
returns public.projects language plpgsql security definer set search_path = public as $$
declare
  v_project  public.projects;
  v_conflict text;
begin
  select * into v_project from public.projects where id = p_id;
  if not found then raise exception '프로젝트를 찾을 수 없어요'; end if;
  if v_project.owner_id is distinct from auth.uid() then
    raise exception '오너만 확정할 수 있어요';
  end if;
  if v_project.status not in ('RECRUITING', 'CLOSED') then
    raise exception '지금은 확정할 수 없는 상태예요';
  end if;

  -- 모든 분야 정원이 찼을 때만 확정 (모집이 다 된 팀)
  if exists (
    select 1 from public.project_slot_status st
     where st.project_id = p_id and st.confirmed < st.capacity
  ) then
    raise exception '아직 모집 인원이 다 차지 않았어요';
  end if;

  -- 팀 구성원(오너 + 수락된 지원자) 중 이미 다른 팀에 확정된 사람이 있는지
  select string_agg(name, ', ') into v_conflict from (
    select c.crew_name as name
      from public.crews c
     where c.id = v_project.owner_id and public.is_teamed(c.id)
    union
    select c.crew_name
      from public.applications a
      join public.crews c on c.id = a.applicant_id
     where a.project_id = p_id and a.status = 'ACCEPTED' and public.is_teamed(a.applicant_id)
  ) t;
  if v_conflict is not null then
    raise exception '%님은 이미 다른 팀에 확정돼 있어요', v_conflict;
  end if;

  update public.projects set status = 'CONFIRMED' where id = p_id returning * into v_project;

  -- 이 프로젝트의 남은 대기 지원자는 자동으로 마감 처리 (오너가 일일이 거절하지 않아도 됨)
  update public.applications set status = 'REJECTED'
   where project_id = p_id and status = 'PENDING';

  -- 확정된 구성원들이 다른 프로젝트에 걸어둔 대기/수락 지원을 자동 정리
  -- → 1인 1팀 유지, 다른 팀의 정원도 되돌려줍니다.
  update public.applications a
     set status = 'CANCELED'
   where a.project_id <> p_id
     and a.status in ('PENDING', 'ACCEPTED')
     and a.applicant_id in (
       select applicant_id from public.applications
        where project_id = p_id and status = 'ACCEPTED'
       union
       select v_project.owner_id
     );

  return v_project;
end $$;

-- 팀 확정 되돌리기 (#2)
create or replace function public.unconfirm_team(p_id uuid)
returns public.projects language plpgsql security definer set search_path = public as $$
declare v_project public.projects;
begin
  update public.projects set status = 'CLOSED'
   where id = p_id and owner_id = auth.uid() and status = 'CONFIRMED'
   returning * into v_project;
  if not found then raise exception '확정된 프로젝트가 아니거나 권한이 없어요'; end if;
  return v_project;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 6. accept_application — 이미 팀이 있는 크루는 수락 불가 (#7 이중 방어)
-- ─────────────────────────────────────────────────────────────
create or replace function public.accept_application(app_id uuid)
returns public.applications
language plpgsql security definer set search_path = public as $$
declare
  v_app      public.applications;
  v_owner    uuid;
  v_capacity int;
  v_accepted int;
begin
  select * into v_app from public.applications where id = app_id;
  if not found then raise exception '지원 내역을 찾을 수 없어요'; end if;

  select owner_id into v_owner from public.projects where id = v_app.project_id;
  if v_owner is distinct from auth.uid() then raise exception '오너만 처리할 수 있어요'; end if;
  if v_app.status = 'ACCEPTED' then return v_app; end if;

  if public.is_teamed(v_app.applicant_id) then
    raise exception '이미 다른 팀에 확정된 크루예요';
  end if;

  select capacity into v_capacity
    from public.project_slots
   where project_id = v_app.project_id and field = v_app.field for update;
  if not found then raise exception '모집하지 않는 분야예요'; end if;

  select count(*) into v_accepted from public.applications
   where project_id = v_app.project_id and field = v_app.field and status = 'ACCEPTED';
  if v_accepted >= v_capacity then raise exception '% 정원이 찼어요', v_app.field; end if;

  update public.applications set status = 'ACCEPTED' where id = app_id returning * into v_app;

  -- 정원이 다 차면 모집 마감(오너가 이후 팀 확정)
  if not exists (
    select 1 from public.project_slot_status st
     where st.project_id = v_app.project_id and st.confirmed < st.capacity
  ) then
    update public.projects set status = 'CLOSED'
     where id = v_app.project_id and status = 'RECRUITING';
  end if;

  return v_app;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 7. create_project → PENDING 으로 시작 (코치 승인 필요), 지원 RLS 보강
-- ─────────────────────────────────────────────────────────────
create or replace function public.create_project(
  p_title text, p_summary text, p_description text,
  p_cover_image text, p_prototype text, p_slots jsonb
) returns public.projects
language plpgsql security definer set search_path = public as $$
declare v_project public.projects; v_slot jsonb;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if jsonb_array_length(p_slots) = 0 then raise exception '모집 분야를 1개 이상 추가해 주세요'; end if;

  insert into public.projects (owner_id, title, summary, description, cover_image, prototype_url, deadline, status)
  values (auth.uid(), p_title, nullif(p_summary,''), p_description,
          nullif(p_cover_image,''), nullif(p_prototype,''), current_date + 14, 'PENDING')
  returning * into v_project;

  for v_slot in select * from jsonb_array_elements(p_slots) loop
    insert into public.project_slots (project_id, field, capacity, skills)
    values (v_project.id, v_slot->>'field', (v_slot->>'capacity')::int,
      coalesce(array(select jsonb_array_elements_text(coalesce(v_slot->'skills','[]'::jsonb))), '{}'));
  end loop;
  return v_project;
end $$;

-- update_project: 승인 상태를 함부로 바꾸지 않도록 (PENDING/REJECTED 는 유지)
create or replace function public.update_project(
  p_id uuid, p_title text, p_summary text, p_description text,
  p_cover_image text, p_prototype text, p_slots jsonb
) returns public.projects
language plpgsql security definer set search_path = public as $$
declare
  v_project public.projects; v_slot jsonb; v_fields text[]; v_accepted int; v_cap int; r record;
begin
  select * into v_project from public.projects where id = p_id;
  if not found then raise exception '프로젝트를 찾을 수 없어요'; end if;
  if v_project.owner_id is distinct from auth.uid() then raise exception '오너만 수정할 수 있어요'; end if;
  if jsonb_array_length(p_slots) = 0 then raise exception '모집 분야를 1개 이상 추가해 주세요'; end if;

  v_fields := array(select jsonb_array_elements(p_slots)->>'field');
  for r in
    select s.field, (select count(*) from public.applications a
        where a.project_id = p_id and a.field = s.field and a.status = 'ACCEPTED') as accepted
      from public.project_slots s where s.project_id = p_id
  loop
    if r.accepted > 0 and not (r.field = any(v_fields)) then
      raise exception '% 분야에 확정된 팀원이 있어 삭제할 수 없어요', r.field;
    end if;
  end loop;

  update public.projects
     set title = p_title, summary = nullif(p_summary,''), description = p_description,
         cover_image = nullif(p_cover_image,''), prototype_url = nullif(p_prototype,'')
   where id = p_id returning * into v_project;

  delete from public.project_slots where project_id = p_id and not (field = any(v_fields));
  for v_slot in select * from jsonb_array_elements(p_slots) loop
    v_cap := (v_slot->>'capacity')::int;
    select count(*) into v_accepted from public.applications
     where project_id = p_id and field = v_slot->>'field' and status = 'ACCEPTED';
    if v_cap < v_accepted then
      raise exception '%: 이미 %명이 확정돼 정원을 %명으로 줄일 수 없어요', v_slot->>'field', v_accepted, v_cap;
    end if;
    insert into public.project_slots (project_id, field, capacity, skills)
    values (p_id, v_slot->>'field', v_cap,
      coalesce(array(select jsonb_array_elements_text(coalesce(v_slot->'skills','[]'::jsonb))), '{}'))
    on conflict (project_id, field) do update set capacity = excluded.capacity, skills = excluded.skills;
  end loop;

  -- 이미 게시된(RECRUITING/CLOSED) 프로젝트에서 정원이 생기면 다시 모집중.
  -- PENDING/REJECTED/CONFIRMED 는 그대로 둡니다.
  if v_project.status in ('RECRUITING', 'CLOSED') and exists (
    select 1 from public.project_slot_status st
     where st.project_id = p_id and st.confirmed < st.capacity
  ) then
    update public.projects set status = 'RECRUITING' where id = p_id returning * into v_project;
  end if;

  return v_project;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 8. RLS — PENDING/REJECTED 는 오너·코치만, 지원은 팀 없는 크루만
-- ─────────────────────────────────────────────────────────────
drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects for select
  using (
    status in ('RECRUITING', 'CLOSED', 'CONFIRMED')
    or owner_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists applications_insert on public.applications;
create policy applications_insert on public.applications for insert to authenticated
  with check (
    applicant_id = auth.uid()
    and not public.is_teamed(auth.uid())               -- 이미 팀 있으면 지원 불가
    and exists (
      select 1 from public.projects p
       where p.id = project_id and p.owner_id <> auth.uid() and p.status = 'RECRUITING'
    )
    and exists (
      select 1 from public.project_slots s where s.project_id = project_id and s.field = field
    )
  );
