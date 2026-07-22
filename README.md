# meeTeam

우아한테크코스 크루들이 사이드 프로젝트를 등록하고 함께할 팀원을 모집·확정하는 웹 서비스.
기획·요구사항 문서는 [`../docs`](../docs) 를 참고하세요.

## 기술 스택

| 영역 | 선택 | 이유 |
| --- | --- | --- |
| Frontend | React 18 + TypeScript + Vite | — |
| Styling | Tailwind + motion/react | Aura 디자인 시스템 (다크·시네마틱·liquid-glass) |
| Routing | React Router | 딥링크·새로고침·뒤로가기 |
| **Database** | **Supabase (Postgres)** | 데이터가 관계형(프로젝트↔모집분야↔지원↔확정)이라 SQL이 자연스럽고, 제약·트랜잭션으로 정합성을 보장 |
| **Auth** | **Supabase Auth (GitHub OAuth)** | 로그인 시 `avatar_url`·`user_name` 을 받아 프로필 사진 자동 세팅 |
| **Storage** | **Supabase Storage** | 커버 이미지를 CDN URL 로 (DB에 base64 저장 안 함) |
| Hosting | **Vercel (정적)** | RLS 로 클라이언트가 DB와 직접 통신 → 서버 불필요 |

### 왜 Firebase가 아니라 Supabase인가

분야별 확정 인원 카운트(`count(*) where status='ACCEPTED'`), 1인 1지원 제약, 정원 초과 방지가
전부 **관계형 연산**입니다. Firestore였다면 카운터를 비정규화하고 트랜잭션을 직접 관리해야 하지만,
Postgres에서는 인덱스·제약·`FOR UPDATE` 락으로 DB가 대신 보장합니다.

## 데이터 영속화 · 정합성

**규칙을 애플리케이션 코드가 아니라 DB가 강제합니다.** 요청을 조작해도 뚫리지 않아요.

| 규칙 | 강제 수단 | 검증 |
| --- | --- | --- |
| 1인 1지원 (FR-APP-04) | `applications_one_active` **partial unique index** (취소분은 제외해 재지원 허용) | ✅ 중복 insert 시 unique 위반 |
| 본인 프로젝트 지원 불가 (FR-APP-05) | `applications_insert` **RLS 정책** | ✅ RLS 위반으로 차단 |
| 마감 프로젝트 지원 불가 (FR-APP-08) | 같은 RLS 정책의 `status='RECRUITING'` 조건 | ✅ |
| 정원 초과 방지 (FR-MEM-05) | `accept_application()` RPC 의 `SELECT … FOR UPDATE` **행 잠금** → 동시 수락 직렬화 | ✅ 정원 1명에 2명 수락 시 두 번째 거부 |
| 전 분야 충족 시 자동 마감 (FR-PRJ-09) | 같은 RPC 안에서 원자적으로 `status='CLOSED'` | ✅ |
| 오너만 수락/거절 (FR-MEM-02) | RPC 내부 `auth.uid()` 검사 + RLS | ✅ |
| 크루명 중복 불가 (FR-ONB-02) | `crews.crew_name` UNIQUE + 길이 CHECK | ✅ |
| GitHub 프로필 사진 | `on_auth_user_created` 트리거가 `avatar_url` 자동 저장 | ✅ |

**프라이버시 설계**: 개별 지원서(각오 메시지 등)는 RLS로 *지원자 본인과 프로젝트 오너만* 조회 가능하지만,
카드에 필요한 **집계**(`FE 1/2`)와 **확정 멤버**는 `security definer` 뷰로 공개합니다.
→ 비로그인 방문자도 모집 현황은 보되, 남의 지원 내용은 볼 수 없습니다.

> 이전 프로토타입은 `db.json` 파일 저장이라 Vercel 서버리스에서 **콜드스타트마다 데이터가 사라지고**,
> 정원 체크가 원자적이지 않아 동시 수락 시 정원 초과가 가능했습니다. 그래서 Supabase로 전환했습니다.

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # Supabase URL / anon key 채우기
npm run dev                  # http://localhost:5200
```

## 설정 (최초 1회)

1. **Supabase 프로젝트 생성** → SQL Editor 에서 [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) 실행
2. **GitHub OAuth App 등록** (Settings → Developer settings → OAuth Apps)
   - Authorization callback URL: `https://<프로젝트>.supabase.co/auth/v1/callback`
3. **Supabase → Authentication → Providers → GitHub** 에 Client ID/Secret 입력
4. **Supabase → Authentication → URL Configuration** 의 Redirect URLs 에
   `http://localhost:5200/auth/callback` 과 `https://<배포도메인>/auth/callback` 추가
5. **Vercel 환경변수**에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 등록 후 배포

> anon key는 공개되어도 되는 키입니다. 실제 보호는 RLS가 담당합니다.

## 구조

```
src/
├─ lib/supabase.ts      # Supabase 클라이언트 + 아바타 그라데이션 파생
├─ api.ts               # 데이터 계층 (컴포넌트는 이 시그니처만 알면 됨)
├─ App.tsx              # 라우트 + OAuth 콜백
└─ components/          # 화면 (S1~S7) + 디자인 프리미티브
supabase/migrations/    # 스키마 · RLS · RPC
```

| 경로 | 화면 |
| --- | --- |
| `/` | 랜딩 + 프로젝트 쇼케이스 |
| `/auth/callback` | GitHub OAuth 콜백 → 온보딩 여부로 분기 |
| `/onboarding` | 크루명 · 분야 · 스킬 |
| `/projects/new` | 프로젝트 등록 (커버 이미지 업로드) |
| `/projects/:id` | 상세 + 지원 |
| `/projects/:id/applicants` | 지원자 관리 (오너) |
| `/my` | 마이페이지 |
