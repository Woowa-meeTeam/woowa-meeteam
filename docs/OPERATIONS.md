# meeTeam 운영 가이드 — 140명 실사용 대비 (수·목·금)

이번 주 3일간 약 **140명**이 동시기에 몰려 사용합니다. 아래는 규모 진단, 반드시 대응할 것,
실시간으로 봐야 할 것, 남겨두면 좋은 로그를 우선순위대로 정리한 것입니다.

> 요약 한 줄: **인프라는 여유롭습니다. 진짜 위험은 "코치 1명 승인 병목"과 "알림 부재"라는 운영 이슈입니다.**

---

## 0. 규모 진단 — 인프라는 문제없다

현재: 크루 17명, 공개 프로젝트 2개. 목표: 3일간 ~140명.

| 자원 | Supabase Free 한도 | 140명 예상 | 판정 |
| --- | --- | --- | --- |
| DB 용량 | 500 MB | 텍스트 위주, 수천 행 → 수 MB | ✅ 넉넉 |
| Storage (커버 이미지) | 1 GB | 140명 × (커버 최대 5MB) 이론상 700MB | ⚠️ **주시** |
| Egress(전송량) | 5 GB/월 | 이미지·API. 배경영상은 CloudFront(별도) | 🟡 관찰 |
| Auth 사용자 | 사실상 무제한 | 140명 | ✅ |
| 동시 연결 | Pooler 가 관리 | 140명 산발적 요청 | ✅ |
| Vercel 대역폭 | 100 GB/월 | 정적 파일뿐 | ✅ |

**결론: 트래픽/용량으로 죽을 일은 거의 없습니다.** DB 정합성(1인 1팀·정원)도 이미 DB 레벨로 검증됨.
문제가 생긴다면 아래 "운영 이슈"에서 납니다.

---

## 1. 🔴 반드시 대응 (출시 전/중)

### ① 코치 승인 병목 — 최우선 위험
현재 **모든 신규 프로젝트는 `PENDING` 으로 시작하고, 관리자(마이찬) 1명이 승인해야만** 피드에 뜹니다.
140명이 첫날 프로젝트를 쏟아내면 승인 대기 큐가 수십 건 쌓이고, **승인 전까지 탐색 피드가 비어 보여
"쓸 프로젝트가 없다"는 인상**을 줍니다.

**대응:**
- **코치 계정 2~3명으로 늘리기** (가장 확실). SQL Editor 에서:
  ```sql
  update public.crews set is_admin = true where github_login in ('추가코치1','추가코치2');
  ```
- 행사 시간엔 **승인 큐를 상시 확인** (`/admin` 상단 "승인 대기" 타일, 또는 아래 SQL).
- (선택) 오리엔테이션 초반엔 **자동 승인**으로 열어두고 싶다면 알려주세요 — `create_project` 기본 상태를
  `RECRUITING` 으로 바꾸는 스위치를 만들어 드릴 수 있습니다.

### ② 알림이 없다 — 사용자 혼란
지원 결과(수락/거절), 프로젝트 승인, 새 지원 도착에 대한 **이메일·푸시 알림이 없습니다.**
사용자는 마이페이지를 직접 새로고침해야 상태를 압니다. 장애는 아니지만 140명 규모에서
"내 지원 됐나요?" 문의가 몰릴 수 있습니다.

**대응:**
- 오리엔테이션에서 **"결과는 마이페이지에서 확인"**을 명확히 안내.
- (선택) Supabase Auth 이메일 + Edge Function 으로 핵심 알림(승인/수락) 추가 가능 — 필요 시 구현.

### ③ 1인 1팀 자동 정리가 조용하다
팀이 확정되면 그 구성원의 **다른 지원이 자동 취소**되고, 팀이 있는 크루는 지원 버튼이 막힙니다(정상 동작).
사용자는 이유를 모를 수 있습니다.

**대응:** "**한 번 팀이 확정되면 다른 팀에는 지원할 수 없어요**"를 사전 공지. (상세 화면에도 상태 문구 있음)

### ④ 출시 전 점검 체크리스트
- [ ] Supabase → Auth → URL Configuration 의 **Redirect URLs** 에 프로덕션 도메인
      `https://meeteam-eight.vercel.app/auth/callback` 포함 확인 (커스텀 도메인 붙이면 추가)
- [ ] GitHub OAuth App 의 callback = `https://ksawtxuprgssnncwtxjv.supabase.co/auth/v1/callback`
- [ ] 코치 계정 2명 이상 지정
- [ ] `service_role` 키가 프론트 번들·리포에 없는지 (anon 키만 사용 — 확인됨)
- [ ] 승인 큐 모니터링 담당자·시간 정하기

---

## 2. 🟡 실시간 모니터링 (행사 중 열어둘 것)

### 어디를 보나
| 위치 | 무엇을 |
| --- | --- |
| **Supabase → Reports → Database** | API 요청량, DB CPU/RAM, 활성 연결 |
| **Supabase → Reports → Storage** | 버킷 용량 (1GB 한도) |
| **Supabase → Reports → Auth** | 신규 가입·로그인 추이 |
| **Supabase → Logs → API / Postgres / Auth** | 4xx/5xx, RLS 거부, 제약 위반, 로그인 실패 |
| **Vercel → Deployments / Logs** | 배포 상태, 정적 서빙 오류 |
| **앱 `/admin`** | 승인 대기 · 크루 · 프로젝트 · 의견 집계 |

### 경보 임계치 (넘으면 대응)
- **승인 대기 > 5건** → 코치가 승인 처리
- **Storage > 800 MB** → 커버 이미지 정리 or Pro 업그레이드
- **Egress 가 한도의 80% 접근** → Pro 업그레이드 검토
- **5xx / RLS 거부 급증** → Logs 에서 패턴 확인 (아래 런북)
- **DB CPU 지속 80%+** → 느린 쿼리 확인 (거의 없을 것)

### 부하 대응 (급증 시)
Supabase **Pro ($25/월)** 로 즉시 업그레이드하면 Storage 100GB·Egress 250GB·성능 상향.
행사 3일만 Pro 로 올렸다 내리는 것도 방법입니다. 다운타임 없이 전환됩니다.

---

## 3. 🔵 남겨두면 좋은 로그 · 기록 (현재 공백)

지금은 **Supabase 기본 로그(API/Postgres/Auth)만** 있고, 앱 자체의 기록은 없습니다.
사후 분석·분쟁 대응·퍼널 파악을 위해 아래를 권장합니다. (원하면 바로 구현해 드립니다)

### ① 감사 로그(audit_log) — 권장 ★
"이 프로젝트 왜 사라졌지?", "누가 승인/반려했지?", "팀 확정 언제 됐지?"에 답하려면 상태 변경 기록이 필요합니다.
현재 `approve_project` · `confirm_team` · `unconfirm_team` · `accept_application` 등의 **행위 주체·시각·대상**이
남지 않습니다. `audit_log` 테이블을 만들고 RPC 안에서 한 줄씩 기록하면 됩니다.

### ② 프론트 에러 추적 — 권장 ★
클라이언트 에러가 **아무 데도 안 남습니다.** 140명 중 누군가 흰 화면을 봐도 재현이 어렵습니다.
**Sentry 무료 플랜**(월 5천 이벤트) 연동이 가장 가성비 좋습니다. 또는 `window.onerror` → `errors` 테이블.

### ③ 퍼널 지표 — 선택
가입 → 온보딩 완료 → 프로젝트 등록/지원 → 확정까지의 전환을 보면 어디서 이탈하는지 알 수 있습니다.
아래 SQL 로 스냅샷을 뜨거나, `/admin` 에 카드로 추가 가능합니다.

---

## 4. 운영 SQL 모음 (Supabase SQL Editor 에 붙여넣기)

```sql
-- 승인 대기 큐 (가장 자주 볼 것)
select id, title, created_at,
       (select crew_name from crews c where c.id = p.owner_id) as owner
  from projects p where status = 'PENDING' order by created_at;

-- 상태별 프로젝트 수
select status, count(*) from projects group by status order by count desc;

-- 실시간 퍼널 스냅샷
select
  (select count(*) from crews where onboarded) as 온보딩완료,
  (select count(*) from projects) as 전체프로젝트,
  (select count(*) from projects where status='RECRUITING') as 모집중,
  (select count(*) from projects where status='CONFIRMED') as 확정팀,
  (select count(*) from applications where status='PENDING') as 대기지원,
  (select count(*) from applications where status='ACCEPTED') as 수락지원;

-- 아직 팀 없는 크루 (도움 필요) — 오래 기다린 순
select c.crew_name, c.github_login, c.created_at
  from crews c
 where c.onboarded and not public.is_teamed(c.id)
 order by c.created_at;

-- 미처리 의견
select kind, message, created_at from feedbacks where status='OPEN' order by created_at;

-- Storage 사용량 (버킷별 객체 수·용량)
select bucket_id, count(*), pg_size_pretty(sum((metadata->>'size')::bigint))
  from storage.objects group by bucket_id;
```

---

## 5. 장애 대응 런북 (증상 → 원인 → 조치)

| 증상 | 원인 | 조치 |
| --- | --- | --- |
| **탐색 피드가 비어요** | 신규 프로젝트가 승인 대기(PENDING) | `/admin` 에서 승인. 코치 늘리기 |
| **로그인이 안돼요** | Redirect URL 누락 / Provider 설정 | Supabase Auth 설정 확인, Auth 로그 |
| **지원 버튼이 막혀요** | 이미 팀 확정됨 / 마감 / 미승인 | 정상 동작. 1인 1팀 안내 |
| **이미지 업로드 실패** | 5MB 초과 / Storage 한도 | 용량 안내, Storage 사용량 확인 |
| **"이미 사용 중인 크루명"** | crew_name 중복(unique) | 다른 이름 안내 |
| **흰 화면 / 특정 사용자만 오류** | 프론트 에러(추적 없음) | Sentry 있으면 확인, 없으면 재현 어려움 → ②권장 |
| **전체가 느려요/급증** | Free 한도 근접 | Supabase Pro 업그레이드(즉시) |
| **DB가 멈췄어요** | Free 는 7일 미사용 시 자동 pause | 사용 중이면 무관. 대시보드에서 재개 |

---

## 6. 사용자 사전 공지 (권장 문구)

> - 프로젝트를 등록하면 **코치 승인 후** 목록에 올라가요 (조금 기다려 주세요).
> - 지원 결과는 **마이페이지 → 지원한 프로젝트**에서 확인해요 (알림은 아직 없어요).
> - **한 명은 한 팀만** — 팀이 확정되면 다른 팀에는 지원할 수 없어요.
> - 불편하거나 바라는 점은 우하단 **의견 보내기**로 알려주세요.

---

## 부록: 우선순위 요약

| 순위 | 항목 | 성격 | 바로 가능? |
| --- | --- | --- | --- |
| 1 | 코치 2~3명으로 확대 | 대응 | SQL 한 줄 (지금) |
| 2 | 승인 큐 모니터링 루틴 | 모니터링 | `/admin` + SQL |
| 3 | 사용자 사전 공지 | 대응 | 문구 배포 |
| 4 | 감사 로그(audit_log) | 로그 | 구현 필요 (요청 시) |
| 5 | 프론트 에러 추적(Sentry) | 로그 | 연동 필요 (요청 시) |
| 6 | Storage/Egress 관찰 | 모니터링 | 대시보드 |
| 7 | (선택) 핵심 알림 이메일 | 대응 | 구현 필요 (요청 시) |
