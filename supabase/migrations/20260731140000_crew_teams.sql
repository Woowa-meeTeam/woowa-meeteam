-- ─────────────────────────────────────────────────────────────
-- 크루가 "어느 팀"에 속했는지
--
-- has_team() 은 참/거짓만 알려 줘서, 팀이 있다는 것까지는 알아도
-- 어느 팀인지는 알 수 없었습니다. 게다가 한 크루가 두 곳에 걸쳐 있을 수 있어요:
--   · 본인이 등록한 프로젝트의 오너이면서
--   · 다른 사람 팀에 수락된 팀원
-- 실제로 지금 16명이 이 상태입니다.
--
-- 특히 "내 프로젝트는 모집 중단(CLOSED)으로 접어 두고 다른 팀에 합류한" 경우,
-- 접어 둔 내 프로젝트가 아니라 합류한 팀이 그 사람의 팀입니다.
-- 그래서 소속마다 우선순위를 매기고 대표 팀 하나를 고릅니다.
-- ─────────────────────────────────────────────────────────────

create or replace view public.crew_teams as
-- 내가 오너인 팀
select p.owner_id                          as crew_id,
       p.id                                as project_id,
       p.title                             as project_title,
       p.status                            as project_status,
       true                                as is_owner,
       -- 아직 모집 중이라면 본인 팀을 계속 꾸리는 중이니 그쪽이 대표입니다.
       -- 모집 중단으로 바꿨다면 그건 "이 프로젝트는 접었다" 는 신호라, 합류한 팀에 양보합니다.
       case p.status
         when 'CONFIRMED'  then 1
         when 'RECRUITING' then 2
         when 'CLOSED'     then 4
       end                                 as rank
  from public.projects p
 where p.status in ('RECRUITING', 'CLOSED', 'CONFIRMED')

union all

-- 수락되어 합류한 팀
select a.applicant_id,
       p.id,
       p.title,
       p.status,
       false,
       -- 확정 전이라도 '수락되어 합류한 자리' 는 내가 접어 둔(CLOSED) 프로젝트보다 우선합니다
       case when p.status = 'CONFIRMED' then 1 else 3 end
  from public.applications a
  join public.projects p on p.id = a.project_id
 where a.status = 'ACCEPTED'
   and p.status in ('RECRUITING', 'CLOSED', 'CONFIRMED');

grant select on public.crew_teams to anon, authenticated;

-- 대표 팀 하나 — 목록에서 "○○ 팀" 한 줄로 보여줄 때 씁니다.
-- 같은 순위면 오래된 프로젝트를 먼저 (id 로 안정적인 순서만 보장).
create or replace view public.crew_primary_team as
select distinct on (crew_id)
       crew_id, project_id, project_title, project_status, is_owner
  from public.crew_teams
 order by crew_id, rank, project_id;

grant select on public.crew_primary_team to anon, authenticated;
