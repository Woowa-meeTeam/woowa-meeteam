-- ─────────────────────────────────────────────────────────────
-- 프로필은 다 채웠는데 온보딩 미완료로 남은 크루 되살리기
--
-- 온보딩은 마지막 "시작하기" 를 눌러야 onboarded = true 가 됩니다.
-- 도중에 나갔다가 나중에 프로필 수정으로 이름·분야·스킬을 채운 크루는
-- 값이 false 로 남고, api.crews() 가 onboarded = true 만 조회하므로
-- 본인은 서비스를 멀쩡히 쓰는데 크루 목록에서만 사라져 보입니다.
--
-- 이름 · 분야 · 스킬이 모두 있으면 온보딩을 마친 것으로 보고 되살립니다.
-- (아무것도 채우지 않은 크루는 그대로 둡니다 — 목록에 빈 카드가 생기면 안 되니까요)
-- ─────────────────────────────────────────────────────────────

-- 1. 무엇이 바뀌는지 먼저 알려 줍니다.
do $$
declare v_targets text;
begin
  select string_agg(format('%s (@%s) — %s / %s', crew_name, github_login, fields, skills), E'\n')
    into v_targets
    from public.crews
   where not onboarded
     and crew_name is not null
     and cardinality(fields) > 0
     and cardinality(skills) > 0;

  if v_targets is null then
    raise notice '되살릴 크루가 없습니다.';
  else
    raise notice E'다음 크루를 크루 목록에 다시 노출합니다:\n%', v_targets;
  end if;
end $$;

update public.crews
   set onboarded = true
 where not onboarded
   and crew_name is not null
   and cardinality(fields) > 0
   and cardinality(skills) > 0;

-- 2. 앞으로 같은 일이 반복되지 않도록.
--    어느 화면에서 저장하든 프로필이 갖춰지면 온보딩 완료로 표시합니다.
create or replace function public.mark_onboarded_when_complete()
returns trigger language plpgsql as $$
begin
  if not new.onboarded
     and new.crew_name is not null
     and cardinality(new.fields) > 0
     and cardinality(new.skills) > 0
  then
    new.onboarded := true;
  end if;
  return new;
end $$;

drop trigger if exists crews_mark_onboarded on public.crews;
create trigger crews_mark_onboarded
  before insert or update on public.crews
  for each row execute function public.mark_onboarded_when_complete();
