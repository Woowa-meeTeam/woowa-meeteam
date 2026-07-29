-- ─────────────────────────────────────────────────────────────
-- 팀 스페이스 2차 — 팀원 GitHub · 자유 링크 · 팀 공지
--
-- team_links  — [{"type":"github","url":"…"}] 형태의 링크 모음.
--               github_url/notion_url 두 칸으로는 피그마·슬랙·배포 주소를 담을 수 없어
--               팀이 필요한 것만 골라 넣도록 배열로 옮깁니다.
-- team_notice — 팀이 맨 위에 붙여 두는 한마디 (회의 시간, 이번 주 할 일 …)
--
-- project_members 뷰에는 github_login 을 실어, 팀원 카드에서 프로필로 바로 가게 합니다.
-- ─────────────────────────────────────────────────────────────

alter table public.projects
  add column if not exists team_links  jsonb not null default '[]'::jsonb,
  add column if not exists team_notice text;

-- 이미 넣어 둔 링크가 사라지지 않도록 배열로 옮겨 담습니다.
-- github_url/notion_url 컬럼 자체는 남겨 둡니다 — 되돌릴 여지를 두기 위해서입니다.
update public.projects p
   set team_links = (
         select coalesce(jsonb_agg(jsonb_build_object('type', t.type, 'url', t.url)), '[]'::jsonb)
           from (values ('github', p.github_url), ('notion', p.notion_url)) as t(type, url)
          where t.url is not null
       )
 where p.team_links = '[]'::jsonb
   and (p.github_url is not null or p.notion_url is not null);

-- ─────────────────────────────────────────────────────────────
-- 팀원 목록에 GitHub 로그인 추가.
-- create or replace view 는 기존 컬럼 뒤에 붙이는 것만 허용해서 맨 끝에 둡니다.
-- ─────────────────────────────────────────────────────────────
create or replace view public.project_members as
select p.id as project_id, c.id as crew_id, c.crew_name, c.avatar_url,
       coalesce(c.fields[1], '') as field, true as is_owner, c.github_login
  from public.projects p
  join public.crews c on c.id = p.owner_id
union all
select a.project_id, c.id, c.crew_name, c.avatar_url, a.field, false, c.github_login
  from public.applications a
  join public.crews c on c.id = a.applicant_id
 where a.status = 'ACCEPTED';

grant select on public.project_members to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 20260729094108 과 같은 이유로 컬럼 단위로만 열어 둡니다.
-- projects 전체 UPDATE 를 열면 오너가 status 를 직접 바꿔 코치 승인을 건너뛸 수 있습니다.
-- ─────────────────────────────────────────────────────────────
grant update (team_links, team_notice) on public.projects to authenticated;
