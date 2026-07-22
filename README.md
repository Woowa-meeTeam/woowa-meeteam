<div align="center">

# meeTeam

**흩어져 있던 팀 빌딩을 한 곳에서.**

우아한테크코스 크루들이 사이드 프로젝트를 등록하고,
함께할 팀원을 모집해 팀을 확정하는 웹 서비스입니다.

[**meeteam-eight.vercel.app**](https://meeteam-eight.vercel.app)

</div>

---

## 왜 만들었나

우테코 크루들은 정규 미션 외에 사이드 프로젝트를 하고 싶어 하지만, 팀을 꾸리는 과정이 흩어져 있습니다.

- 모집 글이 **슬랙·디스코드·오프라인 공지**에 흩어져 놓치기 쉽고
- 어떤 기술을 쓰는지, 누구를 뽑는지 **한눈에 파악하기 어렵고**
- 지원과 수락이 **개별 DM**으로 오가 관리가 힘들고
- 지원자의 분야·스킬을 미리 알 수 없어 **팀 구성이 즉흥적**입니다

meeTeam은 이 흐름을 **등록 → 지원 → 확정** 한 줄기로 정리합니다.

---

## 핵심 기능

| | 기능 |
| --- | --- |
| 🔑 | **GitHub 로그인** — 계정 하나로 시작. 프로필 사진도 GitHub에서 그대로 |
| 👤 | **온보딩** — 크루명 · 분야 · 스킬을 3스텝으로 등록 |
| 📋 | **프로젝트 등록** — 대표 이미지, 마크다운 설명, 분야별 모집 인원과 원하는 기술 스택 |
| 🔍 | **탐색** — 모집 현황(`FE 1/2`)과 커버 이미지가 보이는 카드 피드 |
| ✋ | **지원** — 한 줄 각오와 함께. 내 분야·스킬 프로필이 오너에게 전달 |
| ✅ | **구성원 확정** — 오너가 지원자를 보고 수락·거절. 정원이 차면 자동 마감 |
| 🧑‍🤝‍🧑 | **크루 탐색** — 어떤 분야·스킬의 크루가 있는지 둘러보고 상세 프로필 확인 |
| 💬 | **의견 보내기** — 불편했던 점·바라는 기능을 제보 |

---

## 화면

| 경로 | 화면 |
| --- | --- |
| `/` | 랜딩 + 프로젝트 피드 |
| `/onboarding` | 온보딩 (크루명 · 분야 · 스킬) |
| `/projects/new` · `/projects/:id/edit` | 프로젝트 등록 · 수정 |
| `/projects/:id` | 프로젝트 상세 · 지원 |
| `/projects/:id/applicants` | 지원자 관리 (오너) |
| `/crews` · `/crews/:id` | 크루 목록 · 크루 상세 |
| `/my` · `/profile/edit` | 마이페이지 · 프로필 수정 |
| `/admin` | 관리자 (지정 계정만) |

---

## 기술 스택

**Frontend** React 18 · TypeScript · Vite · Tailwind CSS · motion/react · React Router
**Backend** Supabase (PostgreSQL · Auth · Storage)
**Hosting** Vercel (정적 배포)

### 서버가 없습니다

RLS(Row Level Security)로 권한을 DB에서 강제하기 때문에, 클라이언트가 Supabase와 직접 통신합니다.
별도 API 서버가 없어 **콜드 스타트도, 서버 관리도 없습니다.**

```
브라우저 ──▶ Supabase (Postgres + RLS)
   │
   └──▶ Vercel (정적 파일만)
```

---

## 데이터 정합성

**규칙을 애플리케이션이 아니라 DB가 강제합니다.** 요청을 조작해도 뚫리지 않습니다.

| 규칙 | 강제 수단 |
| --- | --- |
| 프로젝트당 1인 1지원 | `applications_one_active` partial unique index — 취소분은 제외해 재지원 허용 |
| 내 프로젝트엔 지원 불가 | `applications_insert` RLS 정책 |
| 마감된 프로젝트 지원 불가 | 같은 정책의 `status = 'RECRUITING'` 조건 |
| 정원 초과 수락 불가 | `accept_application()` 의 `SELECT … FOR UPDATE` 행 잠금으로 동시 수락 직렬화 |
| 전 분야 충족 시 자동 마감 | 같은 함수 안에서 원자적으로 처리 |
| 확정 팀원을 깨는 수정 불가 | `update_project()` 가 분야 삭제·정원 축소를 거부 |
| 크루명 중복 불가 | `crews.crew_name` UNIQUE |
| **관리자 권한 자가 부여 불가** | 컬럼 단위 GRANT + 트리거 (아래 참고) |

### 공개 범위

개별 지원서(각오 메시지)는 **지원자 본인과 프로젝트 오너만** 볼 수 있습니다.
반면 카드에 필요한 **모집 현황 집계**와 **확정 멤버**는 `security definer` 뷰로 공개해,
비로그인 방문자도 모집 상황은 볼 수 있되 남의 지원 내용은 볼 수 없습니다.

### 관리자

`crews.is_admin = true` 인 계정만 `/admin` 에 접근할 수 있고,
그 외에는 페이지 존재를 드러내지 않고 홈으로 돌려보냅니다.

이 플래그는 **애플리케이션에서 절대 바꿀 수 없습니다.** `authenticated` 역할에서 테이블 전체
UPDATE 권한을 회수하고 안전한 컬럼(`crew_name`, `fields`, `skills`, `bio`, `onboarded`)만 다시
부여했으며, 트리거로 한 번 더 막습니다. 지정은 SQL Editor에서만 가능합니다.

```sql
update public.crews set is_admin = true where github_login = '<깃허브아이디>';
```

---

## 로컬 실행

```bash
npm install
cp .env.example .env.local     # Supabase URL / anon key 입력
npm run dev                    # http://localhost:5200
```

| 스크립트 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입체크 + 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |

---

## 초기 세팅

1. **Supabase 프로젝트 생성** 후 SQL Editor에서 `supabase/migrations/` 안의 SQL을 번호 순서대로 실행
2. **GitHub OAuth App 등록** — Authorization callback URL:
   `https://<프로젝트>.supabase.co/auth/v1/callback`
3. **Supabase → Authentication → Providers → GitHub** 에 Client ID/Secret 입력
4. **Authentication → URL Configuration → Redirect URLs** 에 추가
   - `http://localhost:5200/auth/callback`
   - `https://<배포도메인>/auth/callback`
5. **Vercel 환경변수** 등록 후 배포
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

> anon key는 브라우저 번들에 포함되도록 설계된 공개 키입니다. 실제 보호는 RLS가 담당합니다.
> `service_role` 키는 RLS를 우회하므로 **프론트엔드에 절대 넣지 마세요.**

---

## 구조

```
src/
├─ lib/supabase.ts    Supabase 클라이언트
├─ api.ts             데이터 계층 — 화면은 이 시그니처만 알면 됩니다
├─ App.tsx            라우트 · OAuth 콜백
└─ components/        화면 + 디자인 프리미티브
supabase/migrations/  스키마 · RLS · RPC
```

| 마이그레이션 | 내용 |
| --- | --- |
| `0001_init` | 크루 · 프로젝트 · 모집 분야 · 지원, RLS, 확정 RPC, Storage |
| `0002_edit_bio_skills` | 자기소개, 분야별 기술 스택, 프로젝트 수정 RPC |
| `0003_feedback_admin` | 의견 보내기, 관리자 플래그 |
| `0004_lock_admin_flag` | 관리자 권한 자가 부여 차단 |

---

## 디자인

다크 · 시네마틱 톤에 배경 영상과 `liquid-glass` 카드를 얹었습니다.
프로젝트 커버는 아래쪽이 배경으로 자연스럽게 사라지도록 마스킹해, 카드가 배경 위에 떠 있는 느낌을 줍니다.

기획 · 요구사항 문서는 [`../docs`](../docs) 에 있습니다.
