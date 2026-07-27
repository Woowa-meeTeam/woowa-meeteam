import type { ReactNode } from 'react';

export const ALL_FIELDS = ['백엔드', '프론트엔드', '안드로이드'];

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
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
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
          className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
            value === field
              ? FIELD_STYLES[field].filterActive
              : FIELD_STYLES[field].filter
          }`}
        >
          {field}
        </button>
      ))}

      {children && (
        <>
          <span className="mx-1 w-px h-6 self-center bg-white/10" />
          {children}
        </>
      )}
    </div>
  );
}
