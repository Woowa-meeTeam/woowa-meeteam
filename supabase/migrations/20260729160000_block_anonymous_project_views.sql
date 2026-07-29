-- 비로그인 사용자는 프로젝트 조회수를 올릴 수 없도록 합니다.
-- 기존 익명 조회 기록은 보존하고, 이 migration 이후의 기록만 차단합니다.

revoke execute on function public.record_project_view(uuid) from public, anon;
grant execute on function public.record_project_view(uuid) to authenticated;

create or replace function public.record_project_view(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null then
    return;
  end if;

  select owner_id into v_owner
    from public.projects
   where id = p_id;

  if not found or v_owner = auth.uid() then
    return;
  end if;

  insert into public.project_views (project_id, viewer_id)
  values (p_id, auth.uid());
end $$;

revoke execute on function public.record_project_view(uuid) from public, anon;
grant execute on function public.record_project_view(uuid) to authenticated;
