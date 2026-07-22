-- 0004: 권한 상승(privilege escalation) 차단
--
-- 문제: crews_update 정책이 `using (id = auth.uid())` 라서 사용자가 자기 행의
--       "모든 컬럼"을 고칠 수 있었습니다. is_admin 도 포함이라
--         supabase.from('crews').update({ is_admin: true }).eq('id', 내아이디)
--       한 줄로 누구나 관리자가 될 수 있었습니다.
--
-- RLS 정책은 컬럼 단위 제어를 못 하므로, 컬럼 단위 GRANT 로 막습니다.

-- ─────────────────────────────────────────────────────────────
-- 1. 테이블 전체 UPDATE 회수 → 안전한 컬럼만 다시 부여
-- ─────────────────────────────────────────────────────────────
revoke update on public.crews from authenticated, anon;

grant update (crew_name, fields, skills, bio, onboarded)
  on public.crews to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. 심층 방어 — GRANT 가 되돌아가도 트리거가 막습니다.
--    관리자 플래그는 SQL Editor(postgres 역할)에서만 바꿀 수 있어요.
-- ─────────────────────────────────────────────────────────────
create or replace function public.prevent_admin_self_grant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_admin is distinct from old.is_admin
     and current_setting('role', true) not in ('postgres', 'service_role')
     and session_user not in ('postgres', 'supabase_admin') then
    raise exception '관리자 권한은 직접 변경할 수 없어요';
  end if;
  return new;
end $$;

drop trigger if exists crews_block_admin_change on public.crews;
create trigger crews_block_admin_change
  before update on public.crews
  for each row execute function public.prevent_admin_self_grant();

-- ─────────────────────────────────────────────────────────────
-- 3. 관리자 지정은 여기(SQL Editor)에서만
--    update public.crews set is_admin = true  where github_login = '<아이디>';
--    update public.crews set is_admin = false where github_login = '<아이디>';
-- ─────────────────────────────────────────────────────────────
