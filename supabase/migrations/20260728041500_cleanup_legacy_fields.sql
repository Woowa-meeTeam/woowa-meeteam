-- ─────────────────────────────────────────────────────────────
-- 과거 분야(기획 · 디자인 · iOS) 정리
--
-- 모집 분야를 백엔드 · 프론트엔드 · 안드로이드 3개로 줄이면서 선택지에서만 뺐던 탓에,
-- 그 이전에 온보딩한 크루의 프로필에는 옛 값이 그대로 남아 있습니다.
-- 화면에는 안 보여도 값은 살아 있어서, 프로필을 저장하면 다시 따라 들어옵니다.
--
-- 여기서는 crews.fields 만 정리합니다.
-- project_slots.field 는 지우면 모집 분야와 그 분야 지원자가 붕 뜨므로 건드리지 않고,
-- 남아 있는 게 있으면 아래에서 알려주기만 합니다.
-- ─────────────────────────────────────────────────────────────

-- 1. 정리하면 분야가 아예 비는 크루가 있는지 먼저 봅니다.
--    (온보딩은 분야 1개 이상을 요구하므로, 비게 되면 프로필이 깨진 상태가 됩니다)
do $$
declare v_empty text;
begin
  select string_agg(format('%s (@%s): %s', coalesce(crew_name, '이름없음'), github_login, fields), E'\n')
    into v_empty
    from public.crews
   where onboarded
     and fields is not null
     and cardinality(array(
           select unnest(fields)
           intersect
           select unnest(array['백엔드','프론트엔드','안드로이드'])
         )) = 0;

  if v_empty is not null then
    raise warning E'정리하면 분야가 비는 크루가 있어요. 직접 확인해 주세요:\n%', v_empty;
  end if;
end $$;

-- 2. 유효한 분야만 남깁니다. (순서는 유지)
update public.crews
   set fields = array(
         select f
           from unnest(fields) as f
          where f in ('백엔드', '프론트엔드', '안드로이드')
       )
 where fields is not null
   and exists (
     select 1 from unnest(fields) as f
      where f not in ('백엔드', '프론트엔드', '안드로이드')
   );

-- 3. 앞으로 다시 들어오지 못하게 막습니다.
--    분야를 늘리려면 이 제약과 api.ts 의 FIELDS 를 함께 고쳐야 합니다.
alter table public.crews drop constraint if exists crews_fields_valid;
alter table public.crews
  add constraint crews_fields_valid
  check (fields is null or fields <@ array['백엔드', '프론트엔드', '안드로이드']::text[]);

-- 4. 프로젝트 모집 분야에 옛 값이 남아 있으면 알려만 줍니다. (지우지 않습니다)
do $$
declare v_slots text;
begin
  select string_agg(format('%s — %s (%s/%s명)', p.title, s.field, s.capacity, p.status), E'\n')
    into v_slots
    from public.project_slots s
    join public.projects p on p.id = s.project_id
   where s.field not in ('백엔드', '프론트엔드', '안드로이드');

  if v_slots is not null then
    raise warning E'옛 분야로 모집 중인 프로젝트가 있어요. 오너와 확인 후 직접 정리해 주세요:\n%', v_slots;
  end if;
end $$;
