-- 관리자 대시보드에서 지원자와 지원 프로젝트를 확인할 수 있도록 합니다.
-- 일반 크루에게는 기존처럼 본인 지원서와 본인 프로젝트의 지원서만 노출됩니다.

create policy applications_admin_read on public.applications
  for select to authenticated
  using (public.is_admin());
