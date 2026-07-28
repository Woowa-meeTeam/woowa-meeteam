-- ─────────────────────────────────────────────────────────────
-- 프로젝트 조회수
--
-- "나 이외에 다른 사람이 조회한 횟수" 를 보여주는 게 목적이라, 오너 본인의 조회는 세지 않습니다.
-- 새로고침으로 숫자가 부풀지 않도록 (프로젝트, 크루) 당 한 번만 기록합니다.
-- 즉 값의 의미는 "이 프로젝트를 열어 본 다른 크루 수" 입니다.
--
-- 비로그인 방문자는 재방문을 구분할 방법이 없어(쿠키/핑거프린팅) 세지 않습니다.
-- meeTeam 은 지원·등록에 로그인이 필요하니, 의미 있는 조회는 대부분 잡힙니다.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.project_views (
  project_id uuid not null references public.projects (id) on delete cascade,
  viewer_id  uuid not null references public.crews (id)    on delete cascade,
  viewed_at  timestamptz not null default now(),
  primary key (project_id, viewer_id)
);

create index if not exists project_views_project_idx on public.project_views (project_id);

alter table public.project_views enable row level security;

-- 개별 조회 기록은 누가 봤는지 드러나므로 공개하지 않습니다. 집계 뷰로만 노출해요.
-- (본인 행만 읽을 수 있게 두어 "내가 이미 봤는지" 정도만 확인 가능)
drop policy if exists project_views_read_own on public.project_views;
create policy project_views_read_own on public.project_views for select to authenticated
  using (viewer_id = auth.uid());

-- 집계 뷰 — 개별 행은 비공개, 총 개수만 공개
create or replace view public.project_view_counts as
select project_id, count(*)::int as views
  from public.project_views
 group by project_id;

grant select on public.project_view_counts to anon, authenticated;

-- 조회 기록 — 오너 본인이면 아무 것도 하지 않고, 이미 본 프로젝트면 조용히 넘어갑니다.
create or replace function public.record_project_view(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if auth.uid() is null then return; end if;

  select owner_id into v_owner from public.projects where id = p_id;
  if not found or v_owner = auth.uid() then return; end if;

  insert into public.project_views (project_id, viewer_id)
  values (p_id, auth.uid())
  on conflict (project_id, viewer_id) do nothing;
end $$;

grant execute on function public.record_project_view(uuid) to authenticated;
