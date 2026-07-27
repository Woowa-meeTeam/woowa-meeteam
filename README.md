<div align="center">

# meeTeam

**흩어져 있던 팀 빌딩을 한 곳에서.**

우아한테크코스 크루들이 사이드 프로젝트를 등록하고,
코치 승인을 거쳐 게시하고, 함께할 팀원을 모아 팀을 확정하는 웹 서비스입니다.

[**meeteam-eight.vercel.app**](https://meeteam-eight.vercel.app)

</div>

---

## 목차

- [서비스 흐름](#서비스-흐름)
- [기능 상세](#기능-상세)
- [화면 · 라우트](#화면--라우트)
- [기술 스택](#기술-스택)
- [데이터 모델](#데이터-모델)
- [정합성 · 보안 규칙](#정합성--보안-규칙)
- [로컬 실행 · 배포](#로컬-실행--배포)
- [운영](#운영)

---

## 서비스 흐름

```
[크루]  GitHub 로그인 → 온보딩(크루명·분야·스킬)
          │
          ├─ 프로젝트 등록 ─▶ (PENDING) ─ 코치 승인 ─▶ (RECRUITING) 게시
          │                                              │
          │                                        지원자 모집
          ▼                                              ▼
      프로젝트 탐색 ─ 지원 ─▶ 오너가 수락 ─ 정원 참(CLOSED) ─ 오너가 팀 확정 ─▶ (CONFIRMED)
                                                                                │
                                                                          1인 1팀 확정
```

프로젝트는 **PENDING → RECRUITING → CLOSED → CONFIRMED** 상태를 거칩니다. (코치 반려 시 REJECTED)

---

## 기능 상세

### 인증 · 프로필
- **GitHub OAuth 로그인** — GitHub 계정으로 가입/로그인. 프로필 사진은 GitHub 아바타를 그대로 사용.
- **온보딩** — 크루명(2~20자, 중복 불가) · 분야(복수) · 스킬(검색 + 직접 추가) 3스텝.
- **프로필 수정** — 온보딩을 다시 밟지 않고 필요한 항목만 수정. 자기소개(bio) 최대 500자.

### 프로젝트
- **등록** — 제목, 짧은 소개(카드용 한 줄), 마크다운 설명(**사진 첨부 지원**), 대표 이미지(업로드 또는 프리셋 그라데이션), 프로토타입 링크, 분야별 모집 인원 + 분야별 원하는 기술 스택.
- **코치 승인** — 등록 시 `PENDING`. 관리자(코치)가 승인해야 목록에 게시됨. 승인 전에는 오너·코치에게만 보임.
- **수정 · 삭제** — 오너만. 확정 인원이 있는 분야 삭제나 정원 축소는 거부.
- **탐색** — 랜딩 쇼케이스 + 전체 목록 페이지(`/projects`, 검색 · 분야 · 모집중 필터).
- **상세** — 마크다운 설명 렌더, 클릭 가능한 프로토타입 링크, 분야별 모집 현황 게이지, 팀 멤버(GitHub 아바타), 지원자 수, 좋아요 · 북마크.

### 지원 · 팀 확정
- **지원** — 한 줄 각오 + 지원 분야. 내 분야·스킬 프로필이 오너에게 전달. 1인 1지원(재지원은 취소 후 가능).
- **지원자 관리(오너)** — "팀에 합류시키기"가 주 액션, 거절은 조용한 보조 액션. 정원이 차면 **팀 확정**, 확정 시 남은 대기자는 자동으로 정중히 마감.
- **팀 확정 / 되돌리기** — 정원이 다 차면 오너가 팀을 확정(`CONFIRMED`). 되돌리면 다시 `CLOSED`.
- **모집 중단/재개** — 오너가 확정 없이 모집을 멈출 수 있음(다른 팀에 합류하려 할 때 등).
- **1인 1팀** — 한 크루는 동시에 하나의 확정 팀에만 속함. 확정 시 다른 프로젝트 지원은 자동 정리되고, 이미 팀이 있으면 지원·수락 불가. (DB가 원자적으로 강제)
- **나의 팀** — 마이페이지에서 내가 오너·멤버로 속한 확정 팀 모아보기.

### 크루
- **크루 목록 · 상세** — 분야 필터, 크루별 프로필(자기소개·분야·스킬·등록한 프로젝트).
- **팀 찾는 중** — 아직 확정 팀이 없는 크루를 배지·필터로 표시(도움이 필요한 크루 발견).

### 좋아요 · 북마크
- 프로젝트별 **익명 카운트** — 누가 눌렀는지는 공개하지 않고 총 개수만 공개.

### 의견 · 관리자
- **의견 보내기** — 우하단 위젯. 버그 · 개선 · 기능 · 기타로 제보.
- **관리자(`/admin`)** — 지정된 관리자만 접근. 서비스 집계, **승인 대기 프로젝트 승인/반려**, 크루 의견 처리.

---

## 화면 · 라우트

| 경로 | 화면 | 접근 |
| --- | --- | --- |
| `/` | 랜딩 + 프로젝트 쇼케이스 | 전체 |
| `/auth/callback` | GitHub OAuth 콜백 | — |
| `/onboarding` | 온보딩 | 로그인 |
| `/projects` | 전체 프로젝트 (검색·필터) | 전체 |
| `/projects/new` · `/projects/:id/edit` | 프로젝트 등록 · 수정 | 오너 |
| `/projects/:id` | 프로젝트 상세 · 지원 | 전체 |
| `/projects/:id/applicants` | 지원자 관리 · 팀 확정 | 오너 |
| `/crews` · `/crews/:id` | 크루 목록 · 상세 | 전체 |
| `/my` · `/profile/edit` | 마이페이지 · 프로필 수정 | 로그인 |
| `/admin` | 관리자 | 관리자만 |

---

## 기술 스택

| 영역 | 선택 |
| --- | --- |
| Frontend | React 18 · TypeScript · Vite · Tailwind CSS · motion/react · React Router |
| Backend | **Supabase** (PostgreSQL · Auth · Storage) — 별도 서버 없음 |
| Hosting | **Vercel** (정적 배포) |

**서버가 없습니다.** RLS(Row Level Security)로 권한을 DB에서 강제하므로, 클라이언트가 Supabase와 직접 통신합니다.

```
브라우저 ──▶ Supabase (Postgres + RLS + RPC + Storage + Auth)
   └──▶ Vercel (정적 파일만)   ·   배경 영상은 CloudFront
```

---

## 데이터 모델

| 테이블 | 설명 |
| --- | --- |
| `crews` | 크루 프로필 (auth.users 확장). 크루명·분야·스킬·자기소개·관리자 여부 |
| `projects` | 프로젝트. 상태(PENDING/RECRUITING/CLOSED/CONFIRMED/REJECTED)·소개·커버 |
| `project_slots` | 분야별 모집 정원 + 원하는 스킬 |
| `applications` | 지원 (PENDING/ACCEPTED/REJECTED/CANCELED) |
| `project_reactions` | 좋아요 · 북마크 |
| `feedbacks` | 사용자 제보 |

**공개 집계 뷰** (개별 행은 비공개, 집계만 공개): `project_slot_status`(분야별 확정 인원), `project_members`(확정 멤버), `project_applicant_counts`(지원자 수), `project_reaction_counts`(좋아요·북마크), `crew_team_status`(팀 보유 여부).

**핵심 RPC**: `create_project` · `update_project` · `accept_application`(정원 락) · `confirm_team`/`unconfirm_team`(1인 1팀 강제) · `approve_project`(코치) · `set_recruiting`.

마이그레이션은 `supabase/migrations/` 에 `0001`~`0006` 순서로 있습니다.

| 마이그레이션 | 내용 |
| --- | --- |
| `0001_init` | 크루·프로젝트·슬롯·지원, RLS, 확정 RPC, Storage |
| `0002_edit_bio_skills` | 자기소개, 분야별 스킬, 프로젝트 수정 RPC |
| `0003_feedback_admin` | 의견 보내기, 관리자 플래그 |
| `0004_lock_admin_flag` | 관리자 권한 자가 부여 차단 |
| `0005_summary_reactions` | 짧은 소개, 자기소개 500자, 좋아요/북마크, 지원자 수 |
| `0006_team_lifecycle` | 코치 승인, 팀 확정/되돌리기, 1인 1팀 강제 |

---

## 정합성 · 보안 규칙

**규칙을 앱이 아니라 DB가 강제합니다.** 요청을 조작해도 뚫리지 않습니다.

| 규칙 | 강제 수단 |
| --- | --- |
| 1인 1지원 | `applications_one_active` partial unique index |
| 내 프로젝트·마감·미승인 지원 불가 | `applications_insert` RLS |
| **이미 팀 있는 크루 지원·수락 불가** | RLS `is_teamed()` + `accept_application` 검사 |
| 정원 초과 수락 불가 | `accept_application` 의 `FOR UPDATE` 행 잠금 |
| 정원 충족 시에만 팀 확정 | `confirm_team` |
| **1인 1팀 (중복 확정 차단)** | `confirm_team` 재검증 + 확정 시 타 지원 자동 정리 |
| 미승인 프로젝트 숨김 | `projects_read` RLS (PENDING/REJECTED 는 오너·코치만) |
| 개별 지원서 비공개 | `applications` RLS (지원자 본인 + 오너만) |
| 관리자 권한 자가 부여 불가 | 컬럼 단위 GRANT + 트리거 (SQL Editor 에서만 지정) |

관리자 지정:
```sql
update public.crews set is_admin = true where github_login = '<깃허브아이디>';
```

---

## 로컬 실행 · 배포

```bash
npm install
cp .env.example .env.local     # Supabase URL / anon key 입력
npm run dev                    # http://localhost:5200
npm run build                  # 타입체크 + 프로덕션 빌드
```

**초기 세팅**: Supabase 프로젝트 생성 → `supabase/migrations/` 를 번호순 실행 → GitHub OAuth App 등록(callback `https://<프로젝트>.supabase.co/auth/v1/callback`) → Providers·URL Configuration 설정 → Vercel 환경변수(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) → 배포.

> anon key 는 공개용입니다(RLS 가 보호). `service_role` 키는 프론트엔드에 절대 넣지 마세요.

---

## 운영

140명 규모 실사용 대비 모니터링·대응·로그 가이드는 [`docs/OPERATIONS.md`](docs/OPERATIONS.md) 를 참고하세요.
