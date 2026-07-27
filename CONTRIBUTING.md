# 협업 가이드 (CONTRIBUTING)

이 리포는 `Uechann/meeteam` 에서 미러된 것으로, **현재 140명이 실사용 중인 라이브 서비스**입니다.
[meeteam-eight.vercel.app](https://meeteam-eight.vercel.app) · 백엔드는 Supabase.

기능 개요는 [`README.md`](./README.md), 운영은 [`docs/OPERATIONS.md`](./docs/OPERATIONS.md) 참고.

---

## 1. 로컬 셋업

```bash
git clone https://github.com/Woowa-meeTeam/woowa-meeteam.git
cd woowa-meeteam
npm install
cp .env.example .env.local     # 아래 값 채우기
npm run dev                    # http://localhost:5200
npm run build                  # 타입체크 + 프로덕션 빌드 (PR 전 필수)
```

`.env.local` 에 넣을 값 (오너에게 받으세요 — anon key 는 공개돼도 안전한 키입니다):
```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon/publishable key>
```
> `service_role` 키는 **절대** 프론트/리포에 넣지 마세요. RLS 를 우회하는 마스터 키입니다.

---

## 2. ⚠️ 개발용 DB 를 따로 쓰세요 (중요)

기본 `.env.local` 을 **운영 Supabase** 로 채우면, 로컬 개발이 **실사용자 140명의 실데이터를 직접 건드립니다.**
프로젝트 등록·수락·확정 테스트가 진짜 데이터에 반영돼요.

**권장**: 개발용 Supabase 프로젝트를 따로 만들고 거기에 `supabase/migrations/` 를 번호순으로 실행한 뒤,
그 URL/anon key 를 `.env.local` 에 넣으세요. 스키마 실험도 여기서.

운영 Supabase 에 직접 SQL(마이그레이션)을 실행하는 건 **오너(관리자)만** 합니다.

---

## 3. 브랜치 · PR 규칙

`main` 에 직접 push 금지 (라이브 배포와 연결될 수 있음). 브랜치 → PR → 리뷰 → merge.

```bash
git checkout -b feat/<기능이름>
# 작업...
npm run build          # 타입·빌드 통과 확인
git push origin feat/<기능이름>
# GitHub 에서 PR 생성
```

---

## 4. DB 스키마 변경 시

DB 를 바꾸는 기능이면 **새 마이그레이션 파일**로만 추가합니다 (기존 0001~0006 은 수정 금지):

```
supabase/migrations/0007_<설명>.sql
```

- 규칙(권한·정합성)은 **앱이 아니라 DB(RLS·제약·RPC)가 강제**합니다. 새 규칙도 이 패턴을 따르세요.
- 로컬 Postgres 나 개발 Supabase 에서 **먼저 검증**하고 PR 에 SQL 을 포함.
- 운영 반영은 오너가 SQL Editor 에서 순서대로 실행.
- 클라이언트 타입/호출은 `src/api.ts` 한 곳에 모여 있습니다. 화면은 이 시그니처만 사용.

---

## 5. 배포 (Vercel)

정적 배포(SPA). 두 가지 방식:
- **CLI**: `vercel --prod` (현재 오너가 이 방식으로 운영)
- **Git 연동**: Vercel 프로젝트를 이 리포에 연결하면 `main` merge 시 자동 배포

> **새 Vercel 프로젝트로 배포하면 URL 이 바뀝니다.** 그 경우 반드시:
> 1. Vercel 환경변수 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 등록
> 2. **Supabase → Auth → URL Configuration → Redirect URLs** 에 새 도메인 `/auth/callback` 추가
> 3. (커스텀 도메인 시) GitHub OAuth App callback 도 점검
> 안 하면 GitHub 로그인이 새 도메인에서 실패합니다.

---

## 6. 관리자 / 코치

`/admin` 은 `crews.is_admin = true` 인 계정만 접근 (그 외는 홈으로 리다이렉트).
지정은 운영 Supabase SQL Editor 에서만:
```sql
update public.crews set is_admin = true where github_login = '<깃허브아이디>';
```
관리자 플래그는 앱에서 못 바꿉니다 (0004 에서 차단).

---

## 7. 코드 구조

```
src/
├─ lib/supabase.ts    Supabase 클라이언트
├─ api.ts             데이터 계층 (화면은 이 시그니처만 사용)
├─ App.tsx            라우트 · OAuth 콜백
├─ features/booths/    부스 지도·관리자·SVG 지도·배치 저장소
└─ components/        화면 + 디자인 프리미티브(primitives.tsx)
supabase/migrations/  스키마 · RLS · RPC (0001~)
```

디자인 시스템은 다크·시네마틱 톤 + `liquid-glass` 유틸(`src/index.css`). 새 화면도 이 톤을 따르세요.
