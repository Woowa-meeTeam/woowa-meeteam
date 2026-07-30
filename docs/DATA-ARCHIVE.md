# meeTeam 데이터 보존 가이드 — 무엇이 사라지고 무엇이 남는가

행사(수·목·금) 데이터를 나중에 분석하려면, **무엇이 진짜로 사라지는지**부터 갈라야 합니다.
"Free 라서 24시간치만 보인다"는 건 **로그**에만 해당합니다. 테이블 데이터는 그대로 있습니다.

---

## 0. 먼저 — 세 가지는 성격이 완전히 다릅니다

| 종류 | 어디에 | Free 보존 | 사라지면 복구 |
| --- | --- | --- | --- |
| **① 관측 로그** (API·Postgres·Auth) | Logflare (Logs Explorer) | **1일** | ❌ 영영 불가 |
| **② 테이블 데이터** (crews·projects·applications…) | Postgres | **무기한** | ⚠️ 자동 백업 없음 |
| **③ 상태 변화 이력** | **어디에도 없음** | — | ❌ 지금도 계속 사라지는 중 |

세 번째가 핵심입니다. 아래에서 자세히.

---

## 1. 🔴 ①번 — 지금 당장 (24시간 안에) 받아야 하는 것

Logs Explorer 의 로그만 진짜로 1일 뒤 증발합니다. **오늘이 목요일이면 수요일 로그는 지금 사라지는 중입니다.**

**받는 법:** Supabase → Logs → Logs Explorer → 쿼리 실행 → 우측 상단 **Download CSV**

```sql
-- API 요청 전량 (어떤 화면이 얼마나 불렸는지 · 4xx/5xx 패턴)
select
  cast(timestamp as datetime) as ts,
  request.method, request.path,
  response.status_code
from edge_logs
  cross join unnest(metadata) as m
  cross join unnest(m.request) as request
  cross join unnest(m.response) as response
order by ts desc
limit 10000;
```

```sql
-- Postgres 에러 · RLS 거부 · 제약 위반 (버그 흔적이 여기 남습니다)
select cast(timestamp as datetime) as ts, event_message, parsed.error_severity
from postgres_logs
  cross join unnest(metadata) as m
  cross join unnest(m.parsed) as parsed
where parsed.error_severity in ('ERROR','FATAL','PANIC')
order by ts desc
limit 10000;
```

```sql
-- 로그인 성공/실패 (OAuth 가 막힌 사람이 있었는지)
select cast(timestamp as datetime) as ts, event_message
from auth_logs
order by ts desc
limit 10000;
```

> 컬럼 이름은 프로젝트마다 조금 다를 수 있습니다. Explorer 가 자동완성을 주니 안 맞으면 거기서 맞추세요.

**Reports(그래프)는 CSV 내려받기가 없습니다.** 필요하면 스크린샷이 유일한 보존 수단입니다.
행사 끝나고 하루 지나면 그래프도 비워집니다.

---

## 2. 🔴 ③번 — 가장 많이 잃고 있는 것 (그리고 아무도 모르는 것)

`projects.status` 와 `applications.status` 는 **UPDATE 로 덮어씁니다.** `updated_at` 조차 없습니다.
그래서 스냅샷을 아무리 자주 떠도 **그 사이에 일어난 일은 통째로 사라집니다.**

지금 구조로는 이런 걸 영영 답할 수 없습니다:

- 이 프로젝트는 **언제 승인**됐나? 등록부터 승인까지 **몇 시간** 걸렸나? (= 코치 병목의 실제 크기)
- 이 지원은 **언제 수락**됐나? 지원자는 **얼마나 기다렸나**?
- 이 `CANCELED` 는 **본인이 취소한 건가, 1인 1팀 자동 취소인가?** — 지금은 구분 불가
- 거절이 몇 건이었나? (거절 후 재지원하면 흔적이 덮입니다)
- 정원이 도중에 바뀌었나?

이건 백업으로 해결되는 문제가 아니라 **기록을 안 하고 있는 문제**입니다.

**대응:** [`20260730120000_audit_log.sql`](../supabase/migrations/20260730120000_audit_log.sql) 을 적용하면
트리거가 모든 전이를 `audit_log` 에 남깁니다. 기존 경로를 건드리지 않는 순수 추가(테이블 + AFTER 트리거)이고,
적용 시점에 이미 있는 프로젝트·지원의 생성 시각은 backfill 로 채웁니다.
**과거 전이는 복원되지 않습니다 — 적용이 빠를수록 더 많이 건집니다.**

---

## 3. 🟡 ②번 — 테이블 데이터: 안 사라지지만 백업은 없다

**Free 플랜에는 자동 백업이 없습니다.** (Pro 부터 일 단위 백업 / PITR 은 별도 애드온)
게다가 삭제는 cascade 라, 프로젝트 하나 지우면 그에 달린 지원·조회·반응이 **전부 같이** 사라집니다.

그래서 직접 떠야 합니다:

```bash
export SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@<host>:5432/postgres'
./scripts/snapshot.sh
```

한 번 돌리면 `data-archive/<시각>/` 에 이렇게 쌓입니다:

- `public.dump` — 복원 가능한 전체 덤프 (`pg_restore`)
- `public.sql` — 눈으로 읽고 grep 하는 평문
- `csv/*.csv` — 테이블별 CSV (엑셀·pandas 로 바로)
- `data-archive/metrics-timeseries.csv` — **돌릴 때마다 한 줄씩 누적**되는 지표 추이

> 연결 문자열은 Supabase → Project Settings → Database → Connection string (URI).
> `data-archive/` 는 `.gitignore` 에 있습니다 — 크루명·GitHub 아이디·지원 메시지가 들어 있으니
> **절대 커밋하거나 공유 드라이브에 그대로 올리지 마세요.**

**행사 중엔 하루 2~3회** (아침·점심·마감 후) 돌려두면 시점별 비교가 됩니다.

---

## 4. 분석에 실제로 쓸 만한 데이터

떠 놓은 CSV 로 답할 수 있는 것들. SQL Editor 에서 돌려 **Download CSV** 해도 됩니다.

```sql
-- ① 분야별 수급 — 매칭 플랫폼에서 가장 중요한 그림
--    "백엔드는 자리보다 지원자가 3배" 같은 불균형이 여기서 보입니다
--    정원과 지원을 각각 집계한 뒤 붙입니다. 그냥 join 하면 정원이 지원 수만큼 뻥튀기돼요.
select f.field,
       f.capacity                                as 총정원,
       coalesce(a.pending, 0)                    as 대기지원,
       coalesce(a.accepted, 0)                   as 확정,
       coalesce(a.total, 0)                      as 총지원,
       round(coalesce(a.total, 0)::numeric / nullif(f.capacity, 0), 2) as 경쟁률
  from (select field, sum(capacity) as capacity
          from project_slots group by field) f
  left join (select field, count(*) as total,
                    count(*) filter (where status = 'PENDING')  as pending,
                    count(*) filter (where status = 'ACCEPTED') as accepted
               from applications group by field) a on a.field = f.field
 order by 경쟁률 desc nulls last;
```

```sql
-- ② 끝내 팀을 못 구한 크루 — 사후 케어 대상이자 가장 아픈 지표
select c.crew_name, c.github_login, c.fields, c.created_at,
       (select count(*) from applications a where a.applicant_id = c.id) as 지원횟수
  from crews c
 where c.onboarded and not public.is_teamed(c.id)
 order by 지원횟수 desc, c.created_at;
```

```sql
-- ③ 프로젝트별 깔때기 — 조회는 많은데 지원이 없다면 소개글 문제
select p.title, p.status,
       (select count(*) from project_views v where v.project_id = p.id)      as 조회,
       (select count(*) from project_reactions r
         where r.project_id = p.id and r.kind='LIKE')                        as 좋아요,
       (select count(*) from applications a where a.project_id = p.id)       as 지원,
       round(100.0 * (select count(*) from applications a where a.project_id = p.id)
             / nullif((select count(*) from project_views v where v.project_id = p.id),0), 1) as 전환율
  from projects p order by 조회 desc;
```

```sql
-- ④ 시간대별 활동 — 언제 몰렸는지 (서버 증설·운영 인력 배치 근거)
select date_trunc('hour', created_at) as 시각,
       count(*) filter (where src='project')     as 프로젝트등록,
       count(*) filter (where src='application') as 지원,
       count(*) filter (where src='crew')        as 가입
  from (
    select created_at, 'project'     as src from projects
    union all select created_at, 'application' from applications
    union all select created_at, 'crew'        from crews
  ) t group by 1 order by 1;
```

```sql
-- ⑤ 승인 병목의 실제 크기 — audit_log 적용 후에만 가능
select entity_id, min(at) filter (where new_value='PENDING')    as 등록,
       min(at) filter (where new_value='RECRUITING')            as 승인,
       min(at) filter (where new_value='RECRUITING')
         - min(at) filter (where new_value='PENDING')           as 대기시간
  from audit_log where entity='project'
 group by entity_id having count(*) > 1 order by 대기시간 desc nulls last;
```

```sql
-- ⑥ 의견(제보) 전문 — 정성 데이터. 숫자로 안 보이는 게 여기 있습니다
select f.kind, f.status, f.message, f.created_at,
       (select crew_name from crews c where c.id = f.author_id) as 작성자
  from feedbacks f order by f.created_at;
```

---

## 5. Supabase 대시보드에서 직접 받을 수 있는 것

CLI 없이 브라우저만으로 되는 것들:

| 위치 | 받을 수 있는 것 | 형식 |
| --- | --- | --- |
| **Table Editor** → 테이블 → ⋯ | 테이블 통째로 | CSV 다운로드 |
| **SQL Editor** → 쿼리 실행 후 | 쿼리 결과 (위 4장 전부) | CSV 다운로드 |
| **Logs → Logs Explorer** | ①번 로그 (**24시간치만**) | CSV 다운로드 |
| **Storage → project-covers** | 업로드된 커버 이미지 원본 | 파일 다운로드 |
| **Database → Backups** | Free 는 **비어 있음** | — |
| **Reports** | 그래프 | 스크린샷만 |

> 커버 이미지(Storage)는 `snapshot.sh` 가 **메타데이터만** 뜹니다(파일 목록·용량).
> 이미지 원본까지 보관하려면 Storage 에서 따로 받으세요 — 1GB 한도라 용량도 같이 확인됩니다.

---

## 6. 권장 순서

| 순위 | 할 일 | 시급성 | 소요 |
| --- | --- | --- | --- |
| 1 | Logs Explorer 3종 CSV 다운로드 | **오늘 안 (사라지는 중)** | 5분 |
| 2 | `./scripts/snapshot.sh` 첫 실행 | 지금 | 2분 |
| 3 | `audit_log` 마이그레이션 적용 | 빠를수록 많이 건짐 | 1분 |
| 4 | 행사 중 스냅샷 하루 2~3회 | 매일 | 자동화 가능 |
| 5 | 4장 분석 쿼리 CSV 저장 | 행사 종료 직후 | 10분 |
| 6 | Storage 커버 이미지 백업 | 종료 후 | 5분 |
