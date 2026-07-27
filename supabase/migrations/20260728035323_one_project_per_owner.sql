-- ─────────────────────────────────────────────────────────────
-- 한 크루는 한 시점에 하나의 프로젝트(아이디어)만 등록할 수 있습니다.
--
-- 아이디어 자체는 몇 번이든 낼 수 있지만, 동시에 들고 있을 수 있는 건 하나뿐입니다.
-- 팀을 모으지 못했다면 기존 프로젝트를 삭제(폐기)한 뒤 새 아이디어로 다시 등록합니다.
--
-- 규칙은 앱이 아니라 DB가 강제합니다:
--   projects_one_per_owner (unique index) → 직접 INSERT 로도 못 뚫음 (동시 요청 포함)
--   create_project()       (사전 검사)    → 사용자가 읽을 수 있는 메시지로 먼저 차단
-- ─────────────────────────────────────────────────────────────

-- 1. 제약을 걸기 전에 이미 2개 이상 가진 크루가 있는지 확인합니다.
--    있으면 여기서 멈추고 누가 걸리는지 알려줍니다. (데이터를 임의로 지우지 않습니다)
do $$
declare v_dupes text;
begin
  select string_agg(format('%s — %s개', coalesce(c.crew_name, d.owner_id::text), d.cnt), E'\n')
    into v_dupes
    from (
      select owner_id, count(*) as cnt
        from public.projects
       group by owner_id
      having count(*) > 1
    ) d
    left join public.crews c on c.id = d.owner_id;

  if v_dupes is not null then
    raise exception E'프로젝트를 2개 이상 가진 크루가 있어 제약을 걸 수 없어요. 먼저 정리한 뒤 다시 실행해 주세요:\n%', v_dupes;
  end if;
end $$;

create unique index if not exists projects_one_per_owner
  on public.projects (owner_id);

-- 2. create_project — 등록을 시작하기 전에 막고, 어떤 프로젝트 때문인지 알려줍니다.
--    (unique index 는 동시 요청까지 잡아주는 최종 방어선이고, 여기는 메시지 담당입니다)
create or replace function public.create_project(
  p_title text, p_summary text, p_description text,
  p_cover_image text, p_prototype text, p_slots jsonb
) returns public.projects
language plpgsql security definer set search_path = public as $$
declare
  v_project  public.projects;
  v_slot     jsonb;
  v_existing text;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if jsonb_array_length(p_slots) = 0 then raise exception '모집 분야를 1개 이상 추가해 주세요'; end if;

  select title into v_existing
    from public.projects
   where owner_id = auth.uid()
   limit 1;
  if v_existing is not null then
    raise exception '이미 등록한 프로젝트(%)가 있어요. 하나만 등록할 수 있으니 기존 프로젝트를 삭제한 뒤 다시 등록해 주세요', v_existing;
  end if;

  insert into public.projects (owner_id, title, summary, description, cover_image, prototype_url, deadline, status)
  values (auth.uid(), p_title, nullif(p_summary,''), p_description,
          nullif(p_cover_image,''), nullif(p_prototype,''), current_date + 14, 'PENDING')
  returning * into v_project;

  for v_slot in select * from jsonb_array_elements(p_slots) loop
    insert into public.project_slots (project_id, field, capacity, skills)
    values (v_project.id, v_slot->>'field', (v_slot->>'capacity')::int,
      coalesce(array(select jsonb_array_elements_text(coalesce(v_slot->'skills','[]'::jsonb))), '{}'));
  end loop;
  return v_project;
end $$;
