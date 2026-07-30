#!/usr/bin/env bash
#
# meeTeam 데이터 스냅샷 — 지금 이 순간의 DB 를 통째로 뜬다.
#
# Free 플랜은 자동 백업이 없고, 무엇보다 status 컬럼은 UPDATE 로 덮여서
# "언제 승인됐는지 / 언제 수락됐는지" 를 나중에 복원할 수 없습니다.
# 행사 기간에는 하루 한 번 이상 돌려서 시점별로 쌓아 두세요.
#
# 사용법:
#   export SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@<host>:5432/postgres'
#   ./scripts/snapshot.sh
#
# 연결 문자열은 Supabase → Project Settings → Database → Connection string
# 에서 복사합니다. 셸 히스토리에 남기지 않으려면 앞에 공백을 넣고 export 하세요.
# 이 값은 절대 커밋하지 마세요 (data-archive/ 는 .gitignore 에 있습니다).

set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  cat >&2 <<'MSG'
SUPABASE_DB_URL 이 없습니다.

  export SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@<host>:5432/postgres'

Supabase → Project Settings → Database → Connection string (URI) 에서 복사하세요.
MSG
  exit 1
fi

STAMP="$(date +%Y-%m-%dT%H%M)"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/data-archive/$STAMP"
CSV="$OUT/csv"
mkdir -p "$CSV"

# psql/pg_dump 에 비밀번호가 argv 로 노출되지 않도록 URL 은 환경변수로만 넘깁니다.
export PGCONNECT_TIMEOUT=15

echo "▶ 스냅샷 → data-archive/$STAMP"

# ── 1. 복원 가능한 전체 덤프 ──────────────────────────────────
# public 스키마만 뜹니다. Supabase 가 관리하는 스키마(auth/storage/realtime)는
# 소유자가 달라 덤프가 중간에 실패하는 일이 잦고, 복원할 일도 없습니다.
echo "  · 전체 덤프 (public)"
pg_dump "$SUPABASE_DB_URL" \
  --schema=public --no-owner --no-privileges \
  --format=custom --file="$OUT/public.dump"

# 사람이 눈으로 읽고 grep 할 수 있는 평문 버전도 같이 둡니다.
pg_dump "$SUPABASE_DB_URL" \
  --schema=public --no-owner --no-privileges \
  --format=plain --file="$OUT/public.sql"

# ── 2. 분석용 테이블별 CSV ───────────────────────────────────
# 엑셀·파이썬으로 바로 열 수 있게. 덤프와 중복이지만 다루기가 훨씬 편합니다.
TABLES=(
  crews
  projects
  project_slots
  applications
  project_views
  project_reactions
  feedbacks
  floor_maps
  floor_layout_drafts
  floor_layout_publications
)

echo "  · 테이블 CSV"
for t in "${TABLES[@]}"; do
  if psql "$SUPABASE_DB_URL" -Atqc "select to_regclass('public.$t') is not null" | grep -q '^t$'; then
    psql "$SUPABASE_DB_URL" -q \
      -c "\copy (select * from public.$t) to '$CSV/$t.csv' with (format csv, header)"
    printf '      %-28s %s행\n' "$t" \
      "$(psql "$SUPABASE_DB_URL" -Atqc "select count(*) from public.$t")"
  else
    printf '      %-28s (없음 — 건너뜀)\n' "$t"
  fi
done

# Storage 사용량은 테이블이 아니라 storage.objects 메타데이터에 있습니다.
psql "$SUPABASE_DB_URL" -q -c "\copy (
  select bucket_id, name, owner, created_at, updated_at,
         (metadata->>'size')::bigint as size_bytes, metadata->>'mimetype' as mimetype
    from storage.objects
) to '$CSV/storage_objects.csv' with (format csv, header)" 2>/dev/null \
  && echo "      storage.objects              (커버 이미지 목록)" \
  || echo "      storage.objects              (권한 없음 — 건너뜀)"

# ── 3. 시계열 지표 한 줄 추가 ────────────────────────────────
# 스냅샷을 돌릴 때마다 한 행씩 쌓입니다. 나중에 이 파일 하나로 추이 그래프가 나옵니다.
TIMESERIES="$ROOT/data-archive/metrics-timeseries.csv"
if [[ ! -f "$TIMESERIES" ]]; then
  echo "snapshot_at,crews,onboarded,projects,pending,recruiting,closed,confirmed,applications,app_pending,app_accepted,app_rejected,app_canceled,views,likes,bookmarks,feedbacks_open" > "$TIMESERIES"
fi
psql "$SUPABASE_DB_URL" -Atq -F',' -c "
select now(),
  (select count(*) from crews),
  (select count(*) from crews where onboarded),
  (select count(*) from projects),
  (select count(*) from projects where status='PENDING'),
  (select count(*) from projects where status='RECRUITING'),
  (select count(*) from projects where status='CLOSED'),
  (select count(*) from projects where status='CONFIRMED'),
  (select count(*) from applications),
  (select count(*) from applications where status='PENDING'),
  (select count(*) from applications where status='ACCEPTED'),
  (select count(*) from applications where status='REJECTED'),
  (select count(*) from applications where status='CANCELED'),
  (select count(*) from project_views),
  (select count(*) from project_reactions where kind='LIKE'),
  (select count(*) from project_reactions where kind='BOOKMARK'),
  (select count(*) from feedbacks where status='OPEN')
" >> "$TIMESERIES"

echo "  · 지표 1행 추가 → data-archive/metrics-timeseries.csv"

du -sh "$OUT" | awk '{print "▶ 완료 — 크기 " $1}'
echo "▶ 경로: $OUT"
