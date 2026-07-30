-- ─────────────────────────────────────────────────────────────
-- 감사 로그 — 상태 변화를 '사건'으로 남긴다
--
-- 지금 projects.status / applications.status 는 UPDATE 로 덮여 씁니다.
-- 즉 지금 이 순간의 상태만 알 수 있고, 아래는 영영 알 수 없습니다:
--   · 이 프로젝트가 언제 승인됐는지, 누가 승인했는지
--   · 이 지원이 언제 수락/거절됐는지, 대기 시간이 얼마였는지
--   · 팀 확정으로 '자동 취소'된 지원인지, 본인이 취소한 것인지
--   · 정원이 도중에 바뀌었는지
--
-- 스냅샷(scripts/snapshot.sh)은 찍은 순간만 담으므로 그 사이 변화는 놓칩니다.
-- 이 테이블은 트리거로 모든 전이를 잡아 두어, 스냅샷 사이의 구멍을 메웁니다.
--
-- 기존 경로를 건드리지 않는 순수 추가입니다 (테이블 + AFTER 트리거).
-- ─────────────────────────────────────────────────────────────

create table if not exists public.audit_log (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  -- 행위 주체. RPC·PostgREST 세션에서는 JWT 의 uid 가 잡히고,
  -- SQL Editor 에서 손으로 고치면 null 이 됩니다 (그 자체로 정보입니다).
  actor_id   uuid,
  entity     text not null,          -- 'project' | 'application' | 'slot'
  entity_id  uuid not null,
  action     text not null,          -- 'INSERT' | 'STATUS' | 'DELETE' | 'CAPACITY'
  old_value  text,
  new_value  text,
  detail     jsonb
);

create index if not exists audit_log_at_idx     on public.audit_log (at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity, entity_id, at);

alter table public.audit_log enable row level security;

-- 읽기는 관리자만. 지원 메시지만큼은 아니어도 누가 언제 거절당했는지가 드러납니다.
drop policy if exists audit_log_read on public.audit_log;
create policy audit_log_read on public.audit_log for select to authenticated
  using (public.is_admin());

-- 쓰기는 트리거(SECURITY DEFINER)만 합니다. 클라이언트에는 INSERT 를 열지 않습니다.
revoke insert, update, delete on public.audit_log from authenticated, anon;

-- ─────────────────────────────────────────────────────────────
-- 트리거 본체
-- ─────────────────────────────────────────────────────────────
create or replace function public.log_project_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor_id, entity, entity_id, action, new_value, detail)
    values (auth.uid(), 'project', new.id, 'INSERT', new.status,
            jsonb_build_object('title', new.title, 'owner_id', new.owner_id));
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (actor_id, entity, entity_id, action, old_value, detail)
    values (auth.uid(), 'project', old.id, 'DELETE', old.status,
            jsonb_build_object('title', old.title, 'owner_id', old.owner_id));
  elsif new.status is distinct from old.status then
    insert into public.audit_log (actor_id, entity, entity_id, action, old_value, new_value, detail)
    values (auth.uid(), 'project', new.id, 'STATUS', old.status, new.status,
            jsonb_build_object('title', new.title, 'owner_id', new.owner_id));
  end if;
  return null;  -- AFTER 트리거라 반환값은 무시됩니다
end $$;

create or replace function public.log_application_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor_id, entity, entity_id, action, new_value, detail)
    values (auth.uid(), 'application', new.id, 'INSERT', new.status,
            jsonb_build_object('project_id', new.project_id,
                               'applicant_id', new.applicant_id, 'field', new.field));
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (actor_id, entity, entity_id, action, old_value, detail)
    values (auth.uid(), 'application', old.id, 'DELETE', old.status,
            jsonb_build_object('project_id', old.project_id,
                               'applicant_id', old.applicant_id));
  elsif new.status is distinct from old.status then
    -- actor_id 가 지원자 본인이면 자발적 취소, 아니면 오너/코치의 처리입니다.
    -- 1인 1팀 자동 취소는 confirm_team 을 부른 오너의 uid 로 찍힙니다.
    insert into public.audit_log (actor_id, entity, entity_id, action, old_value, new_value, detail)
    values (auth.uid(), 'application', new.id, 'STATUS', old.status, new.status,
            jsonb_build_object('project_id', new.project_id,
                               'applicant_id', new.applicant_id,
                               'by_self', auth.uid() = new.applicant_id));
  end if;
  return null;
end $$;

create or replace function public.log_slot_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.capacity is distinct from old.capacity then
    insert into public.audit_log (actor_id, entity, entity_id, action, old_value, new_value, detail)
    values (auth.uid(), 'slot', new.id, 'CAPACITY',
            old.capacity::text, new.capacity::text,
            jsonb_build_object('project_id', new.project_id, 'field', new.field));
  end if;
  return null;
end $$;

drop trigger if exists projects_audit     on public.projects;
drop trigger if exists applications_audit on public.applications;
drop trigger if exists slots_audit        on public.project_slots;

create trigger projects_audit
  after insert or update or delete on public.projects
  for each row execute function public.log_project_change();

create trigger applications_audit
  after insert or update or delete on public.applications
  for each row execute function public.log_application_change();

create trigger slots_audit
  after update on public.project_slots
  for each row execute function public.log_slot_change();

-- ─────────────────────────────────────────────────────────────
-- 지금까지 쌓인 것에 대한 최소한의 출발점.
-- 과거 전이는 복원할 수 없지만, '언제 만들어졌는지'는 created_at 에 남아 있으니
-- 그것만이라도 사건으로 옮겨 둡니다. 이후 변화는 트리거가 이어서 기록합니다.
-- ─────────────────────────────────────────────────────────────
insert into public.audit_log (at, actor_id, entity, entity_id, action, new_value, detail)
select p.created_at, p.owner_id, 'project', p.id, 'INSERT', p.status,
       jsonb_build_object('title', p.title, 'owner_id', p.owner_id, 'backfilled', true)
  from public.projects p
 where not exists (
   select 1 from public.audit_log a
    where a.entity = 'project' and a.entity_id = p.id and a.action = 'INSERT'
 );

insert into public.audit_log (at, actor_id, entity, entity_id, action, new_value, detail)
select a.created_at, a.applicant_id, 'application', a.id, 'INSERT', a.status,
       jsonb_build_object('project_id', a.project_id, 'applicant_id', a.applicant_id,
                          'field', a.field, 'backfilled', true)
  from public.applications a
 where not exists (
   select 1 from public.audit_log l
    where l.entity = 'application' and l.entity_id = a.id and l.action = 'INSERT'
 );
