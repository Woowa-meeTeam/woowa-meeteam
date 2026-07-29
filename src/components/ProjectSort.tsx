import type { Project } from '../api';

export type SortKey = 'latest' | 'views' | 'likes';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'latest', label: '등록순' },
  { key: 'views', label: '조회수순' },
  { key: 'likes', label: '좋아요순' },
];

/** 목록이 등록 최신순으로 내려오니 '등록순'은 받은 순서를 그대로 씁니다 */
export function sortProjects(projects: Project[], sort: SortKey): Project[] {
  if (sort === 'latest') return projects;
  const weight = sort === 'views' ? (p: Project) => p.views : (p: Project) => p.likes;
  return [...projects].sort((a, b) => weight(b) - weight(a));
}

type Props = {
  value: SortKey;
  onChange: (sort: SortKey) => void;
  className?: string;
};

export default function ProjectSort({ value, onChange, className = '' }: Props) {
  return (
    <div className={`flex flex-wrap items-center justify-end text-xs ${className}`}>
      {SORTS.map((item, index) => (
        <span key={item.key} className="inline-flex items-center">
          {index > 0 && <span className="mx-2 text-white/20">|</span>}
          <button
            type="button"
            onClick={() => onChange(item.key)}
            className={`font-medium transition-colors ${
              value === item.key ? 'text-white' : 'text-white/40 hover:text-white/75'
            }`}
          >
            {item.label}
          </button>
        </span>
      ))}
    </div>
  );
}
