-- meeTeam 스키마
-- 기획서의 비즈니스 규칙(FR-*)을 애플리케이션 코드가 아니라 DB 제약/정책으로 강제합니다.

-- ─────────────────────────────────────────────────────────────
-- 1. crews — auth.users 확장 프로필 (FR-ONB)
-- ─────────────────────────────────────────────────────────────
create table public.crews (
  id           uuid primary key references auth.users on delete cascade,
  github_login text not null default '',
  crew_name    text unique,                       -- FR-ONB-02: 중복 불가
  avatar_url   text,                              -- GitHub OAuth avatar_url
  fields       text[] not null default '{}',
  skills       text[] not null default '{}',
  onboarded    boolean not null default false,
  created_at   timestamptz not null default now(),
  constraint crew_name_len check (
    crew_name is null or char_length(crew_name) between 2 and 20  -- FR-ONB-02
  )
);

-- GitHub 로그인 시 crews 행 자동 생성 + 아바타/로그인명 동기화
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.crews (id, github_login, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'user_name',
      new.raw_user_meta_data->>'preferred_username',
      ''
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
    set avatar_url   = excluded.avatar_url,
        github_login = excluded.github_login;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 2. projects (FR-PRJ)
-- ─────────────────────────────────────────────────────────────
create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.crews(id) on delete cascade,
  title         text not null check (char_length(title) between 2 and 40),  -- FR-PRJ-02
  description   text not null check (char_length(description) > 0),          -- FR-PRJ-03
  cover_image   text,          -- Supabase Storage public URL (FR-PRJ-04)
  prototype_url text,
  schedule      text not null default '일정 미정',
  deadline      date,
  status        text not null default 'RECRUITING'
                check (status in ('RECRUITING', 'CLOSED')),
  created_at    timestamptz not null default now()
);
create index projects_owner_idx  on public.projects (owner_id);
create index projects_status_idx on public.projects (status, created_at desc);

-- 분야별 모집 인원 (FR-PRJ-05)
create table public.project_slots (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  field      text not null,
  capacity   int  not null check (capacity between 1 and 9),
  unique (project_id, field)
);

-- ─────────────────────────────────────────────────────────────
-- 3. applications (FR-APP / FR-MEM)
-- ─────────────────────────────────────────────────────────────
create table public.applications (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  applicant_id uuid not null references public.crews(id) on delete cascade,
  field        text not null,
  message      text not null check (char_length(message) between 1 and 100), -- FR-APP-02
  status       text not null default 'PENDING'
               check (status in ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELED')),
  created_at   timestamptz not null default now()
);
create index applications_project_idx   on public.applications (project_id);
create index applications_applicant_idx on public.applications (applicant_id);

-- FR-APP-04: 프로젝트당 1인 1지원.
-- 취소/거절된 건은 제외해서 재지원은 허용 (partial unique index)
create unique index applications_one_active
  on public.applications (project_id, applicant_id)
  where status in ('PENDING', 'ACCEPTED');

-- ─────────────────────────────────────────────────────────────
-- 4. 공개 조회용 뷰 (FR-PRJ-05/08)
--    개별 지원서는 RLS로 비공개지만, "집계"와 "확정 멤버"는 누구나 봐야 합니다.
--    → security definer 뷰로 집계만 노출 (지원 메시지 등은 새어나가지 않음)
-- ─────────────────────────────────────────────────────────────
create view public.project_slot_status as
select
  s.project_id,
  s.field,
  s.capacity,
  (
    select count(*)::int
    from public.applications a
    where a.project_id = s.project_id
      and a.field      = s.field
      and a.status     = 'ACCEPTED'
  ) as confirmed
from public.project_slots s;

-- 확정된 팀 멤버 = 오너 + 수락된 지원자 (FR-MEM-06)
create view public.project_members as
select p.id as project_id, c.id as crew_id, c.crew_name, c.avatar_url,
       coalesce(c.fields[1], '') as field, true as is_owner
  from public.projects p
  join public.crews c on c.id = p.owner_id
union all
select a.project_id, c.id, c.crew_name, c.avatar_url, a.field, false
  from public.applications a
  join public.crews c on c.id = a.applicant_id
 where a.status = 'ACCEPTED';

grant select on public.project_slot_status to anon, authenticated;
grant select on public.project_members     to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. 구성원 확정 RPC — 정원 가드를 원자적으로 (FR-MEM-02/04/05)
--    슬롯 행을 FOR UPDATE 로 잠가 동시 수락 경쟁 조건을 차단합니다.
-- ─────────────────────────────────────────────────────────────
create function public.accept_application(app_id uuid)
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
  if v_owner is distinct from auth.uid() then
    raise exception '오너만 처리할 수 있어요';           -- FR-MEM-02
  end if;

  if v_app.status = 'ACCEPTED' then return v_app; end if;

  -- 같은 분야 동시 수락을 직렬화
  select capacity into v_capacity
    from public.project_slots
   where project_id = v_app.project_id and field = v_app.field
     for update;
  if not found then raise exception '모집하지 않는 분야예요'; end if;

  select count(*) into v_accepted
    from public.applications
   where project_id = v_app.project_id
     and field      = v_app.field
     and status     = 'ACCEPTED';

  if v_accepted >= v_capacity then
    raise exception '% 정원이 찼어요', v_app.field;      -- FR-MEM-05
  end if;

  update public.applications set status = 'ACCEPTED'
   where id = app_id returning * into v_app;

  -- 모든 분야가 정원을 채우면 자동 마감 (FR-PRJ-09)
  if not exists (
    select 1
      from public.project_slot_status st
     where st.project_id = v_app.project_id
       and st.confirmed  < st.capacity
  ) then
    update public.projects set status = 'CLOSED' where id = v_app.project_id;
  end if;

  return v_app;
end $$;

-- 프로젝트 + 슬롯을 한 트랜잭션으로 생성 (FR-PRJ-01)
create function public.create_project(
  p_title       text,
  p_description text,
  p_cover_image text,
  p_prototype   text,
  p_schedule    text,
  p_slots       jsonb          -- [{"field":"프론트엔드","capacity":2}, ...]
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

  insert into public.projects (owner_id, title, description, cover_image, prototype_url, schedule, deadline)
  values (auth.uid(), p_title, p_description,
          nullif(p_cover_image, ''), nullif(p_prototype, ''),
          coalesce(nullif(p_schedule, ''), '일정 미정'),
          current_date + 14)
  returning * into v_project;

  for v_slot in select * from jsonb_array_elements(p_slots) loop
    insert into public.project_slots (project_id, field, capacity)
    values (v_project.id, v_slot->>'field', (v_slot->>'capacity')::int);
  end loop;

  return v_project;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 6. RLS — 규칙을 DB 레벨에서 강제
-- ─────────────────────────────────────────────────────────────
alter table public.crews          enable row level security;
alter table public.projects       enable row level security;
alter table public.project_slots  enable row level security;
alter table public.applications   enable row level security;

-- crews: 프로필은 공개 읽기(카드에 오너·멤버 표시), 수정은 본인만
create policy crews_read   on public.crews for select using (true);
create policy crews_update on public.crews for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- projects: 목록/상세는 누구나(FR-PRJ-07), 생성·수정·삭제는 오너만(FR-PRJ-06)
create policy projects_read   on public.projects for select using (true);
create policy projects_insert on public.projects for insert to authenticated
  with check (owner_id = auth.uid());
create policy projects_update on public.projects for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy projects_delete on public.projects for delete to authenticated
  using (owner_id = auth.uid());

create policy slots_read   on public.project_slots for select using (true);
create policy slots_write   on public.project_slots for all to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

-- applications: 지원자 본인 + 해당 프로젝트 오너만 조회 (FR-MEM-01)
create policy applications_read on public.applications for select to authenticated
  using (
    applicant_id = auth.uid()
    or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  );

-- FR-APP-01/05/08: 본인 명의로만, 자기 프로젝트엔 지원 불가, 마감된 프로젝트 불가
create policy applications_insert on public.applications for insert to authenticated
  with check (
    applicant_id = auth.uid()
    and exists (
      select 1 from public.projects p
       where p.id = project_id
         and p.owner_id <> auth.uid()
         and p.status = 'RECRUITING'
    )
    and exists (
      select 1 from public.project_slots s
       where s.project_id = project_id and s.field = field
    )
  );

-- FR-APP-06: 지원자는 대기 중일 때만 취소 / FR-MEM-03: 오너는 상태 변경
create policy applications_update on public.applications for update to authenticated
  using (
    (applicant_id = auth.uid() and status = 'PENDING')
    or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  )
  with check (
    (applicant_id = auth.uid() and status = 'CANCELED')
    or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
-- 7. Storage — 프로젝트 커버 이미지 (FR-PRJ-04)
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('project-covers', 'project-covers', true)
on conflict (id) do nothing;

create policy covers_read on storage.objects for select
  using (bucket_id = 'project-covers');
create policy covers_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'project-covers' and owner = auth.uid());
create policy covers_delete on storage.objects for delete to authenticated
  using (bucket_id = 'project-covers' and owner = auth.uid());
