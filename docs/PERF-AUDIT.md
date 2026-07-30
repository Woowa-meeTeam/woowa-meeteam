# Supabase 쿼터 초과 — 원인과 해결 (2026-07-30)

## 관측값

| 항목 | 값 | 상태 |
| --- | --- | --- |
| **Cached Egress** | 12.481 / 5 GB | **250%** 🔴 |
| **Egress** | 5.147 / 5 GB | **103%** 🔴 |
| Database Size | 0.032 / 0.5 GB | 6% |
| **Storage Size** | **0.025 GB (25 MB)** | 2% |
| MAU | 129 / 50,000 | <1% |
| Storage Image Transformations | **Unavailable in plan** | — |

24시간 전 대비 Cached Egress 7.87 GB → **12.481 GB (+4.6 GB/일)**.

---

## 1. 핵심 — 저장량이 아니라 '반복 전송'이 문제다

**저장한 건 25 MB인데 나간 건 17.6 GB입니다. 약 700배.**

이 한 줄이 전부입니다. 용량을 줄이는 문제가 아니라, **같은 25 MB를 몇 번 내보내는가**의 문제입니다.
DB도 Storage도 MAU도 전부 한가합니다(2~6%). 오직 전송량만 터졌습니다.

### 두 egress 항목은 서로 다른 범인입니다

| 항목 | 값 | 정체 | 근거 |
| --- | --- | --- | --- |
| **Egress** (비캐시) | 5.147 GB | **API JSON** | 743,869 요청 × ≈6.9 KB = 5.1 GB — 정확히 일치 |
| **Cached Egress** | 12.481 GB | **커버 이미지** | CDN 캐시 히트분. Storage 요청이 809뿐인 이유이기도 함 |

Storage 요청 809건은 **캐시 미스만** 센 숫자입니다. 나머지는 CDN이 처리해 Storage 로그에 안 남지만,
Supabase는 그걸 "Cached Egress"로 과금합니다 (대시보드 설명: *"served from a cache hit"*).

---

## 2. 왜 하루 만에 4.6 GB가 늘었나

세 가지가 곱해집니다.

### ① 커버 이미지가 표시 크기의 16배

크로퍼가 **1600×900 WebP quality 0.92** 로 굽습니다 ([CoverCropper.tsx:7,150](../src/components/CoverCropper.tsx#L150)).

- 25 MB ÷ 커버 약 100장 = **장당 약 250 KB**
- 카드가 실제로 쓰는 폭은 **약 400 px** → 픽셀 기준 **16배**, 용량 기준 **10배 이상** 과잉
- 업로드도 읽기도 원본 그대로. **`srcset` 없음, width 파라미터 없음, 변환 없음**

### ② 랜딩과 목록이 전체 프로젝트를 한 번에 렌더한다

```tsx
// ProjectsShowcase.tsx:90 — 랜딩. slice 없음
{sorted.map((p, i) => ( … ))}
```

[AllProjects.tsx](../src/components/AllProjects.tsx) 에도 페이지네이션이 없습니다.

`loading="lazy"` 는 걸려 있지만([primitives.tsx:184](../src/components/primitives.tsx#L184)),
**스크롤을 내리는 순간 전부 로드**됩니다. 즉 **랜딩 한 번 훑기 = 카탈로그 전체 25 MB**.

### ③ 행사 트래픽

4.6 GB ÷ 25 MB = **하루 약 184회의 "전체 카탈로그 다운로드"**.
129명 기준 **1인당 하루 1.4회** — 행사 중이면 지극히 정상적인 사용량입니다.

> 브라우저 캐시(`cacheControl: 31536000`)가 있는데 왜 반복되나?
> 사용자마다 브라우저가 다르고(129명 × 25 MB = 3.2 GB, 한 바퀴만 돌아도), 모바일은 캐시를 빨리 버리며,
> 새로고침·시크릿창·기기 변경이 겹칩니다. **캐시는 반복을 줄일 뿐 첫 방문 비용을 없애지 못합니다.**

---

## 3. 해결 — 효과 · 속도 순

> **Free 플랜은 Storage Image Transformations 를 못 씁니다**(대시보드에서 확인).
> 따라서 `?width=400` 같은 서버 변환은 선택지가 아니고, **업로드 시점에 직접 만들어야** 합니다.

### 🥇 1. 목록 렌더 개수 제한 — 가장 빠르고, 기존 이미지에도 즉시 먹힘

코드 몇 줄이고 **이미 올라간 커버에도 바로 효과**가 납니다. 지금 당장 할 수 있는 유일한 조치.

```tsx
// ProjectsShowcase.tsx — 랜딩은 맛보기만. 전체는 /projects 로.
const VISIBLE = 6;
const sorted = useMemo(
  () => sortProjects(projects ?? [], sort).slice(0, VISIBLE),
  [projects, sort],
);
```

```tsx
// AllProjects.tsx — 더보기 방식
const PAGE = 12;
const [shown, setShown] = useState(PAGE);
// filtered.slice(0, shown) 렌더 + "더 보기" 버튼에서 setShown(s => s + PAGE)
// 필터/정렬/검색이 바뀌면 setShown(PAGE) 로 리셋
```

**예상 효과: Cached Egress 60~80% 감소** (랜딩 100장 → 6장).

### 🥈 2. 업로드 시 썸네일 동시 생성 + `srcset`

새로 올라오는 커버부터 근본 해결. 카드용 400 px 를 따로 만듭니다.

```ts
// CoverCropper.tsx — 이미 canvas 를 쓰고 있으니 한 번 더 굽기만 하면 됩니다
const THUMB_WIDTH = 400;

function bake(img, sx, sy, sw, sh, width, quality): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round(width / COVER_ASPECT);
  canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/webp', quality));
}

// 원본 1600 은 상세용, 400 은 카드용
const [full, thumb] = await Promise.all([
  bake(img, sx, sy, sw, sh, OUTPUT_WIDTH, 0.9),
  bake(img, sx, sy, sw, sh, THUMB_WIDTH, 0.8),
]);
```

업로드 시 `<uuid>.webp` 와 `<uuid>-400.webp` 두 개를 올리고, 카드에서:

```tsx
<img
  src={thumbUrl}
  srcSet={`${thumbUrl} 400w, ${fullUrl} 1600w`}
  sizes="(max-width: 640px) 100vw, 400px"
  loading="lazy" decoding="async"
/>
```

400×225 WebP q0.8 ≈ **15~25 KB** (250 KB 대비 **약 90% 감소**).

### 🥉 3. 기존 커버 100장 백필

1·2번을 해도 **이미 올라간 커버는 그대로 1600 px** 입니다.
`scripts/` 에 다운로드→리사이즈→재업로드 스크립트를 두고 한 번 돌리면 카탈로그가 25 MB → 약 3 MB 가 됩니다.
(service_role 키가 필요하므로 직접 실행하셔야 합니다.)

### 4. `api.me()` 캐시 — Auth 요청 약 90% 감소

`getUser()` 는 호출마다 `/auth/v1/user` 왕복입니다. `/my` 한 번에 **5번** 부릅니다.

```ts
// api.ts
let meCache: { uid: string; promise: Promise<User> } | null = null;

async function currentUser(): Promise<User> {
  const { data } = await supabase.auth.getSession();   // 로컬 — 네트워크 없음
  const uid = data.session?.user.id;
  if (!uid) throw new ApiError(401, '로그인이 필요해요');
  if (meCache?.uid !== uid) {
    meCache = {
      uid,
      promise: supabase.from('crews')
        .select('id, github_login, crew_name, avatar_url, fields, skills, bio, onboarded')
        .eq('id', uid).single()
        .then(({ data, error }) => {
          if (error || !data) { meCache = null; throw new ApiError(401, '프로필을 불러오지 못했어요'); }
          return toUser(data as CrewRow);
        }),
    };
  }
  return meCache.promise;
}
// onAuthStateChange 에서 meCache = null 로 무효화
```

`select('*')` 대신 명시 컬럼을 쓰면 **`is_admin` 노출도 같이 사라집니다**(§4 참고).

### 5. MyPage 의 `api.projects()` 제거

좋아요·북마크 몇 건 거르려고 **전체 프로젝트 테이블**을 받고 있습니다 ([MyPage.tsx:65](../src/components/MyPage.tsx#L65)).
`project_reactions` 에서 내 것만 조회해 해당 프로젝트만 가져오면 됩니다.

### 6. `loadProjects()` 페이지네이션

[api.ts:538](../src/api.ts#L538) 에 `limit`/`range` 가 없어 매번 전체 테이블 + 전원 hydration 입니다.

---

## 4. 같이 발견한 취약점

### 🔴 크루 전체 명단이 비로그인에게 공개 + `is_admin` 노출

```sql
create policy crews_read on public.crews for select using (true);
```

`to authenticated` 가 없어 **`anon` 도 읽습니다.** anon 키는 JS 번들에 공개돼 있으므로 누구나 129명 전원을 덤프할 수 있고,
클라이언트의 `select('*')` 는 **`is_admin` 까지** 반환합니다 → **관리자 계정 특정 가능**.

명단·프로필 공개는 서비스 성격상 의도일 수 있지만, 관리자 플래그가 같이 나가는 건 아닐 겁니다.
§3-4 의 명시 컬럼 조회로 클라이언트 쪽은 즉시 막히고, 근본적으로는 정책을 `to authenticated` 로 좁히는 게 맞습니다.

### 🟡 `crew_team_status` 가 anon 에 공개

**누가 아직 팀을 못 구했는지** 전원 명단이 비로그인에게 열려 있습니다.

### 🟡 `saveProjectExtras` 가 오류를 통째로 삼킴

```ts
await supabase.from('projects').update(body).eq('id', id);   // 반환값 미확인
```

[api.ts:529](../src/api.ts#L529) — RLS 거부든 컬럼 부재든 조용히 실패하고 사용자는 저장됐다고 믿습니다.
**Postgres 에러 114건의 유력한 출처**입니다.

### ✅ 확인 결과 문제 없음

- `applications` RLS — 지원자 본인 또는 오너만 (`0001_init.sql:247`). **지원 메시지는 보호됩니다.**
- `is_admin` 권한 상승 — `0004_lock_admin_flag.sql` 에서 이미 차단.
- 폴링·리얼타임 구독 없음. 커버 URL 캐시버스팅 없음. `loading="lazy"` 적용됨.

---

## 5. 권장 순서

| 순위 | 조치 | 예상 효과 | 스키마 변경 | 소요 |
| --- | --- | --- | --- | --- |
| 1 | 랜딩·목록 렌더 개수 제한 | **Cached Egress 60~80% ↓** | 없음 | 30분 |
| 2 | `api.me()` 캐시 + 명시 컬럼 | Auth 90% ↓, `is_admin` 노출 제거 | 없음 | 30분 |
| 3 | MyPage `api.projects()` 제거 | API egress ↓ | 없음 | 30분 |
| 4 | 업로드 시 썸네일 + `srcset` | 신규 커버 90% ↓ | 없음 | 2시간 |
| 5 | 기존 커버 100장 백필 | 카탈로그 25 MB → 3 MB | 없음 | 1시간 |
| 6 | `crews_read` → `to authenticated` | 관리자 열거 차단 | **있음** | 10분 |
| 7 | `saveProjectExtras` 오류 표면화 | 조용한 실패 제거 | 없음 | 20분 |

**1~5·7 은 전부 프런트엔드만 고치면 되어 행사 중에도 안전하게 배포됩니다.**
1번만 해도 오늘의 출혈은 멈춥니다.

---

## 6. 확인하지 못한 것

Postgres 에러 114건 / Auth 에러 30건의 **실제 내용은 로그를 봐야** 확정됩니다.
§4 의 `saveProjectExtras` 는 코드 기반 추정입니다.
[DATA-ARCHIVE.md](DATA-ARCHIVE.md) §1 의 Postgres 로그 쿼리로 확인하세요 — **24시간 뒤 사라집니다.**
