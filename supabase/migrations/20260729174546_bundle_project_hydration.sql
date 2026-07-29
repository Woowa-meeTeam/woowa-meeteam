-- 프로젝트 목록 한 번을 구성할 때 각각 호출하던 공개 뷰들을 한 응답으로 묶습니다.
-- 함수는 호출자 권한으로 실행되어 기존 뷰의 공개 범위를 넓히지 않습니다.
create or replace function public.get_project_hydration(p_project_ids uuid[])
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'slots',
    coalesce(
      (
        select jsonb_agg(to_jsonb(s))
        from public.project_slot_status s
        where s.project_id = any(p_project_ids)
      ),
      '[]'::jsonb
    ),
    'members',
    coalesce(
      (
        select jsonb_agg(to_jsonb(m))
        from public.project_members m
        where m.project_id = any(p_project_ids)
      ),
      '[]'::jsonb
    ),
    'applicants',
    coalesce(
      (
        select jsonb_agg(to_jsonb(a))
        from public.project_applicant_counts a
        where a.project_id = any(p_project_ids)
      ),
      '[]'::jsonb
    ),
    'reactions',
    coalesce(
      (
        select jsonb_agg(to_jsonb(r))
        from public.project_reaction_counts r
        where r.project_id = any(p_project_ids)
      ),
      '[]'::jsonb
    ),
    'views',
    coalesce(
      (
        select jsonb_agg(to_jsonb(v))
        from public.project_view_counts v
        where v.project_id = any(p_project_ids)
      ),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.get_project_hydration(uuid[]) from public;
grant execute on function public.get_project_hydration(uuid[]) to anon, authenticated, service_role;
