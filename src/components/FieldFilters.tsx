import type { ReactNode } from 'react';
import { FIELDS } from '../api';

/** 분야 목록의 원본은 api.ts 한 곳입니다 (과거 분야 필터링과 같은 출처) */
export const ALL_FIELDS = FIELDS;

export const FIELD_STYLES: Record<
  string,
  { tag: string; filter: string; filterActive: string }
> = {
  백엔드: {
    tag: 'border-violet-400/40 text-violet-300 bg-violet-400/10',
    filter:
      'border-violet-400/20 text-violet-200/75 hover:border-violet-400/45 hover:bg-violet-400/10',
    filterActive: 'border-violet-400/55 text-violet-200 bg-violet-400/15',
  },
  프론트엔드: {
    tag: 'border-cyan-400/40 text-cyan-300 bg-cyan-400/10',
    filter:
      'border-cyan-400/20 text-cyan-200/75 hover:border-cyan-400/45 hover:bg-cyan-400/10',
    filterActive: 'border-cyan-400/55 text-cyan-200 bg-cyan-400/15',
  },
  안드로이드: {
    tag: 'border-emerald-400/40 text-emerald-300 bg-emerald-400/10',
    filter:
      'border-emerald-400/20 text-emerald-200/75 hover:border-emerald-400/45 hover:bg-emerald-400/10',
    filterActive: 'border-emerald-400/55 text-emerald-200 bg-emerald-400/15',
  },
};

/** 분야 배지의 기본 모양 — 목록에 없는 옛 분야도 같은 틀로 보이게 합니다 */
const FIELD_TAG_FALLBACK = 'border-white/20 bg-white/[0.06] text-white/70';

/**
 * 분야 배지 — 마이페이지·크루·팀 스페이스가 같은 색과 모양을 씁니다.
 * 여기저기 흩어져 있던 같은 마크업을 한 곳으로 모았습니다.
 */
export function FieldTag({ field, className = '' }: { field: string; className?: string }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
        FIELD_STYLES[field]?.tag ?? FIELD_TAG_FALLBACK
      } ${className}`}
    >
      {field}
    </span>
  );
}

type Props = {
  value: string | null;
  onChange: (field: string | null) => void;
  className?: string;
  children?: ReactNode;
};

export default function FieldFilters({
  value,
  onChange,
  className = '',
  children,
}: Props) {
  // 모바일에서는 분야 칩이 줄바꿈 대신 가로 스크롤 한 줄이 됩니다.
  // 칩이 아래로 접히면 목록이 화면 밖으로 밀려 정작 프로젝트가 안 보여요.
  // 덧붙는 필터(children)는 스크롤에 숨지 않도록 모바일에서만 아랫줄로 내립니다.
  // sm 이상에서는 sm:contents 로 감싸개를 지워, 예전처럼 한 줄에서 자연스럽게 접힙니다.
  return (
    <div
      className={`flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center ${className}`}
    >
      <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:contents">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`flex-shrink-0 whitespace-nowrap px-3.5 py-2 rounded-full border text-sm font-medium transition-all sm:px-4 ${
            value === null
              ? 'bg-white text-black border-white'
              : 'bg-white/[0.03] text-white/70 border-white/10 hover:border-white/25 hover:text-white'
          }`}
        >
          전체
        </button>

        {ALL_FIELDS.map((field) => (
          <button
            type="button"
            key={field}
            onClick={() => onChange(value === field ? null : field)}
            className={`flex-shrink-0 whitespace-nowrap px-3.5 py-2 rounded-full border text-sm font-medium transition-all sm:px-4 ${
              value === field
                ? FIELD_STYLES[field].filterActive
                : FIELD_STYLES[field].filter
            }`}
          >
            {field}
          </button>
        ))}
      </div>

      {children && (
        <>
          <span className="hidden sm:block mx-1 w-px h-6 flex-shrink-0 self-center bg-white/10" />
          <div className="flex flex-shrink-0 items-center gap-2 sm:contents">{children}</div>
        </>
      )}
    </div>
  );
}
