-- ─────────────────────────────────────────────────────────────
-- 조회수를 "본 사람 수" → "누적 조회수" 로
--
-- 처음에는 (project_id, viewer_id) 를 기본키로 두어 한 사람이 여러 번 봐도 1로 셌습니다.
-- 열어 볼 때마다 쌓이는 누적 조회수가 더 재미있어서 기본키를 풀고 매번 한 줄씩 남깁니다.
--
-- 이미 쌓인 행은 그대로 두므로 지금까지의 집계가 시작점이 됩니다.
--
-- 비로그인 방문자도 이제 셉니다. 중복을 걸러낼 필요가 없어졌으니
-- viewer_id 를 비워 두고 기록해도 숫자의 의미가 흐려지지 않아요.
-- (내 프로젝트를 내가 연 것만 여전히 제외합니다)
-- ─────────────────────────────────────────────────────────────

-- 1. 사람당 1회로 묶어 두던 기본키를 풀고, 줄마다 고유 id 를 답니다.
alter table public.project_views drop constraint if exists project_views_pkey;

alter table public.project_views
  add column if not exists id bigint generated always as identity;

alter table public.project_views
  add constraint project_views_pkey primary key (id);

-- 2. 비로그인 조회도 담을 수 있도록
alter table public.project_views alter column viewer_id drop not null;

-- 3. 집계 뷰는 그대로 count(*) — 이제 줄 수가 곧 누적 조회수입니다.
create or replace view public.project_view_counts as
select project_id, count(*)::int as views
  from public.project_views
 group by project_id;

grant select on public.project_view_counts to anon, authenticated;

-- 4. 열 때마다 한 줄씩 기록합니다. 중복 무시(on conflict)가 사라졌어요.
create or replace function public.record_project_view(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.projects where id = p_id;
  if not found then return; end if;

  -- 내 프로젝트를 내가 연 건 세지 않습니다 (auth.uid() 가 null 이면 이 조건은 성립하지 않아 그대로 기록)
  if v_owner = auth.uid() then return; end if;

  insert into public.project_views (project_id, viewer_id)
  values (p_id, auth.uid());
end $$;

grant execute on function public.record_project_view(uuid) to anon, authenticated;
