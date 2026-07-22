-- 0002: 자기소개 · 분야별 기술스택 · 마감일 · 프로젝트 수정/삭제

-- ─────────────────────────────────────────────────────────────
-- 1. 컬럼 추가
-- ─────────────────────────────────────────────────────────────
alter table public.crews
  add column if not exists bio text
  constraint crews_bio_len check (bio is null or char_length(bio) <= 200);

-- 분야별로 "이런 기술 쓰실 분" 을 선택적으로 명시 (비어 있어도 됨)
alter table public.project_slots
  add column if not exists skills text[] not null default '{}';

-- ─────────────────────────────────────────────────────────────
-- 2. create_project — 마감일 + 슬롯별 스킬 지원
-- ─────────────────────────────────────────────────────────────
drop function if exists public.create_project(text, text, text, text, text, jsonb);

create function public.create_project(
  p_title       text,
  p_description text,
  p_cover_image text,
  p_prototype   text,
  p_schedule    text,
  p_deadline    date,
  p_slots       jsonb   -- [{"field":"프론트엔드","capacity":2,"skills":["React"]}, ...]
) returns public.projects
language plpgsql security definer set search_path = public as $$
declare
  v_project public.projects;
  v_slot    jsonb;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if jsonb_array_length(p_slots) = 0 then
    raise exception '모집 분야를 1개 이상 추가해 주세요';
  end if;
  if p_deadline is not null and p_deadline < current_date then
    raise exception '마감일은 오늘 이후로 정해 주세요';
  end if;

  insert into public.projects (owner_id, title, description, cover_image, prototype_url, schedule, deadline)
  values (auth.uid(), p_title, p_description,
          nullif(p_cover_image, ''), nullif(p_prototype, ''),
          coalesce(nullif(p_schedule, ''), '일정 미정'),
          coalesce(p_deadline, current_date + 14))
  returning * into v_project;

  for v_slot in select * from jsonb_array_elements(p_slots) loop
    insert into public.project_slots (project_id, field, capacity, skills)
    values (
      v_project.id,
      v_slot->>'field',
      (v_slot->>'capacity')::int,
      coalesce(
        array(select jsonb_array_elements_text(coalesce(v_slot->'skills', '[]'::jsonb))),
        '{}'
      )
    );
  end loop;

  return v_project;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 3. update_project — 오너가 등록한 프로젝트 수정 (FR-PRJ-06)
--    확정된 인원을 깨뜨리는 수정은 거부합니다.
-- ─────────────────────────────────────────────────────────────
create function public.update_project(
  p_id          uuid,
  p_title       text,
  p_description text,
  p_cover_image text,
  p_prototype   text,
  p_schedule    text,
  p_deadline    date,
  p_slots       jsonb
) returns public.projects
language plpgsql security definer set search_path = public as $$
declare
  v_project  public.projects;
  v_slot     jsonb;
  v_fields   text[];
  v_accepted int;
  v_cap      int;
  r          record;
begin
  select * into v_project from public.projects where id = p_id;
  if not found then raise exception '프로젝트를 찾을 수 없어요'; end if;
  if v_project.owner_id is distinct from auth.uid() then
    raise exception '오너만 수정할 수 있어요';
  end if;
  if jsonb_array_length(p_slots) = 0 then
    raise exception '모집 분야를 1개 이상 추가해 주세요';
  end if;

  v_fields := array(select jsonb_array_elements(p_slots)->>'field');

  -- 확정 인원이 있는 분야를 통째로 빼는 건 막습니다
  for r in
    select s.field,
           (select count(*) from public.applications a
             where a.project_id = p_id and a.field = s.field and a.status = 'ACCEPTED') as accepted
      from public.project_slots s
     where s.project_id = p_id
  loop
    if r.accepted > 0 and not (r.field = any(v_fields)) then
      raise exception '% 분야에 확정된 팀원이 있어 삭제할 수 없어요', r.field;
    end if;
  end loop;

  update public.projects
     set title         = p_title,
         description   = p_description,
         cover_image   = nullif(p_cover_image, ''),
         prototype_url = nullif(p_prototype, ''),
         schedule      = coalesce(nullif(p_schedule, ''), '일정 미정'),
         deadline      = coalesce(p_deadline, deadline)
   where id = p_id
   returning * into v_project;

  -- 목록에서 빠진 분야 제거 (위에서 확정 인원 없음을 확인함)
  delete from public.project_slots
   where project_id = p_id and not (field = any(v_fields));

  -- 남은/새 분야 upsert — 정원은 확정 인원 밑으로 못 내립니다
  for v_slot in select * from jsonb_array_elements(p_slots) loop
    v_cap := (v_slot->>'capacity')::int;

    select count(*) into v_accepted
      from public.applications
     where project_id = p_id and field = v_slot->>'field' and status = 'ACCEPTED';

    if v_cap < v_accepted then
      raise exception '%: 이미 %명이 확정돼 정원을 %명으로 줄일 수 없어요',
        v_slot->>'field', v_accepted, v_cap;
    end if;

    insert into public.project_slots (project_id, field, capacity, skills)
    values (
      p_id, v_slot->>'field', v_cap,
      coalesce(array(select jsonb_array_elements_text(coalesce(v_slot->'skills', '[]'::jsonb))), '{}')
    )
    on conflict (project_id, field) do update
      set capacity = excluded.capacity,
          skills   = excluded.skills;
  end loop;

  -- 정원을 늘렸다면 다시 모집중으로 되돌립니다
  if exists (
    select 1 from public.project_slot_status st
     where st.project_id = p_id and st.confirmed < st.capacity
  ) then
    update public.projects set status = 'RECRUITING' where id = p_id returning * into v_project;
  end if;

  return v_project;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 4. 집계 뷰에 skills 노출
-- ─────────────────────────────────────────────────────────────
drop view if exists public.project_slot_status;

create view public.project_slot_status as
select
  s.project_id,
  s.field,
  s.capacity,
  s.skills,
  (
    select count(*)::int
    from public.applications a
    where a.project_id = s.project_id
      and a.field      = s.field
      and a.status     = 'ACCEPTED'
  ) as confirmed
from public.project_slots s;

grant select on public.project_slot_status to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. 크루 목록에서 자기소개도 보이도록 (crews_read 는 이미 public)
-- ─────────────────────────────────────────────────────────────
-- 별도 정책 변경 없음: crews_read (using true) 가 bio 까지 커버합니다.
