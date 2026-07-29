-- ─────────────────────────────────────────────────────────────
-- 프로젝트 카테고리 + 팀 스페이스 링크
--
-- category   — 앱스토어처럼 큰 단위로 묶어 탐색하기 위한 분류
-- github_url — 팀 스페이스에 모아 두는 저장소 링크
-- notion_url — 팀 스페이스에 모아 두는 문서 링크
--
-- 셋 다 오너가 화면에서 바로 고치는 값이라 RPC 를 거치지 않고 직접 UPDATE 합니다.
-- create_project/update_project 는 인자 개수가 곧 시그니처여서, 인자를 늘리면
-- 마이그레이션을 적용하기 전까지 프로젝트 등록 자체가 깨지기 때문입니다.
-- ─────────────────────────────────────────────────────────────

alter table public.projects
  add column if not exists category   text,
  add column if not exists github_url text,
  add column if not exists notion_url text;

-- ─────────────────────────────────────────────────────────────
-- 오너가 직접 건드릴 수 있는 컬럼을 명시적으로 제한합니다.
--
-- 지금까지 projects 에는 컬럼 단위 제한이 없어서, RLS(projects_update)만 통과하면
-- 오너가 자기 프로젝트의 status 를 PENDING → RECRUITING 으로 직접 바꿀 수 있었습니다.
-- 코치 승인을 건너뛸 수 있는 구멍으로, crews.is_admin 을 잠갔던 0004 와 같은 종류입니다.
--
-- 제목·설명·상태 변경은 전부 SECURITY DEFINER RPC(update_project, approve_project,
-- set_recruiting, confirm_team …)를 거치므로 이 GRANT 제한에 걸리지 않습니다.
-- ─────────────────────────────────────────────────────────────
revoke update on public.projects from authenticated, anon;
grant update (category, github_url, notion_url) on public.projects to authenticated;
