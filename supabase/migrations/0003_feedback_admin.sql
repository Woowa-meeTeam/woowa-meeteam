-- 0003: 사용자 제보(피드백) + 관리자 권한

-- ─────────────────────────────────────────────────────────────
-- 1. 관리자 플래그
-- ─────────────────────────────────────────────────────────────
alter table public.crews
  add column if not exists is_admin boolean not null default false;

-- RLS 정책 안에서 crews 를 다시 조회하면 재귀가 될 수 있어
-- security definer 함수로 분리합니다.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select c.is_admin from public.crews c where c.id = auth.uid()), false)
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. 제보 테이블
-- ─────────────────────────────────────────────────────────────
create table if not exists public.feedbacks (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid references public.crews(id) on delete set null,
  kind       text not null default 'IMPROVEMENT'
             check (kind in ('BUG', 'IMPROVEMENT', 'FEATURE', 'ETC')),
  message    text not null check (char_length(message) between 5 and 1000),
  status     text not null default 'OPEN'
             check (status in ('OPEN', 'DONE')),
  created_at timestamptz not null default now()
);
create index if not exists feedbacks_created_idx on public.feedbacks (created_at desc);

alter table public.feedbacks enable row level security;

-- 로그인한 크루는 본인 명의로 제보할 수 있어요
create policy feedbacks_insert on public.feedbacks for insert to authenticated
  with check (author_id = auth.uid());

-- 본인 제보 + 관리자는 전체 조회
create policy feedbacks_read on public.feedbacks for select to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- 상태 변경(처리 완료)은 관리자만
create policy feedbacks_update on public.feedbacks for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy feedbacks_delete on public.feedbacks for delete to authenticated
  using (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 3. 첫 관리자 지정 (프로젝트 소유자)
--    다른 사람을 관리자로 만들려면 아래처럼 실행하세요:
--    update public.crews set is_admin = true where github_login = '<깃허브아이디>';
-- ─────────────────────────────────────────────────────────────
update public.crews set is_admin = true where github_login = 'Uechann';
