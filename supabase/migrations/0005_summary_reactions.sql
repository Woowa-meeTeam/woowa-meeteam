-- 0005: 짧은 소개 · 자기소개 500자 · 좋아요/북마크 · 지원자 수 공개

-- ─────────────────────────────────────────────────────────────
-- 1. 자기소개 200 → 500자
-- ─────────────────────────────────────────────────────────────
alter table public.crews drop constraint if exists crews_bio_len;
alter table public.crews add constraint crews_bio_len
  check (bio is null or char_length(bio) <= 500);

-- ─────────────────────────────────────────────────────────────
-- 2. 프로젝트 짧은 소개
-- ─────────────────────────────────────────────────────────────
alter table public.projects
  add column if not exists summary text
  constraint projects_summary_len check (summary is null or char_length(summary) <= 80);

-- create_project / update_project 에 p_summary 추가 (기존 함수 대체)
drop function if exists public.create_project(text, text, text, text, text, date, jsonb);
create function public.create_project(
  p_title       text,
  p_summary     text,
  p_description text,
  p_cover_image text,
  p_prototype   text,
  p_slots       jsonb
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

  insert into public.projects (owner_id, title, summary, description, cover_image, prototype_url, deadline)
  values (auth.uid(), p_title, nullif(p_summary, ''), p_description,
          nullif(p_cover_image, ''), nullif(p_prototype, ''), current_date + 14)
  returning * into v_project;

  for v_slot in select * from jsonb_array_elements(p_slots) loop
    insert into public.project_slots (project_id, field, capacity, skills)
    values (v_project.id, v_slot->>'field', (v_slot->>'capacity')::int,
      coalesce(array(select jsonb_array_elements_text(coalesce(v_slot->'skills','[]'::jsonb))), '{}'));
  end loop;

  return v_project;
end $$;

drop function if exists public.update_project(uuid, text, text, text, text, text, date, jsonb);
create function public.update_project(
  p_id          uuid,
  p_title       text,
  p_summary     text,
  p_description text,
  p_cover_image text,
  p_prototype   text,
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

  for r in
    select s.field,
           (select count(*) from public.applications a
             where a.project_id = p_id and a.field = s.field and a.status = 'ACCEPTED') as accepted
      from public.project_slots s where s.project_id = p_id
  loop
    if r.accepted > 0 and not (r.field = any(v_fields)) then
      raise exception '% 분야에 확정된 팀원이 있어 삭제할 수 없어요', r.field;
    end if;
  end loop;

  update public.projects
     set title = p_title, summary = nullif(p_summary, ''), description = p_description,
         cover_image = nullif(p_cover_image, ''), prototype_url = nullif(p_prototype, '')
   where id = p_id returning * into v_project;

  delete from public.project_slots
   where project_id = p_id and not (field = any(v_fields));

  for v_slot in select * from jsonb_array_elements(p_slots) loop
    v_cap := (v_slot->>'capacity')::int;
    select count(*) into v_accepted from public.applications
     where project_id = p_id and field = v_slot->>'field' and status = 'ACCEPTED';
    if v_cap < v_accepted then
      raise exception '%: 이미 %명이 확정돼 정원을 %명으로 줄일 수 없어요',
        v_slot->>'field', v_accepted, v_cap;
    end if;
    insert into public.project_slots (project_id, field, capacity, skills)
    values (p_id, v_slot->>'field', v_cap,
      coalesce(array(select jsonb_array_elements_text(coalesce(v_slot->'skills','[]'::jsonb))), '{}'))
    on conflict (project_id, field) do update
      set capacity = excluded.capacity, skills = excluded.skills;
  end loop;

  if exists (
    select 1 from public.project_slot_status st
     where st.project_id = p_id and st.confirmed < st.capacity
  ) then
    update public.projects set status = 'RECRUITING' where id = p_id returning * into v_project;
  end if;

  return v_project;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 3. 지원자 수 공개 (개별 지원서는 여전히 비공개, 집계만 공개)
-- ─────────────────────────────────────────────────────────────
create or replace view public.project_applicant_counts as
select
  project_id,
  count(*) filter (where status = 'PENDING')::int                      as pending,
  count(*) filter (where status in ('PENDING', 'ACCEPTED'))::int       as applicants
from public.applications
group by project_id;

grant select on public.project_applicant_counts to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. 좋아요 · 북마크 (익명 카운트)
--    누가 눌렀는지는 공개하지 않고 총 개수만 공개합니다.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.project_reactions (
  project_id uuid not null references public.projects(id) on delete cascade,
  crew_id    uuid not null references public.crews(id) on delete cascade,
  kind       text not null check (kind in ('LIKE', 'BOOKMARK')),
  created_at timestamptz not null default now(),
  primary key (project_id, crew_id, kind)
);

alter table public.project_reactions enable row level security;

-- 본인 반응만 추가/삭제/조회 (내 좋아요·북마크 상태 확인용)
create policy reactions_insert on public.project_reactions for insert to authenticated
  with check (crew_id = auth.uid());
create policy reactions_delete on public.project_reactions for delete to authenticated
  using (crew_id = auth.uid());
create policy reactions_read on public.project_reactions for select to authenticated
  using (crew_id = auth.uid());

-- 총 개수는 누구나 (security definer 뷰라 RLS 우회 → 익명 카운트)
create or replace view public.project_reaction_counts as
select
  project_id,
  count(*) filter (where kind = 'LIKE')::int     as likes,
  count(*) filter (where kind = 'BOOKMARK')::int as bookmarks
from public.project_reactions
group by project_id;

grant select on public.project_reaction_counts to anon, authenticated;
