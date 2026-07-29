import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Plus, Search } from 'lucide-react';
import Navbar from './Navbar';
import ProjectCard from './ProjectCard';
import FieldFilters from './FieldFilters';
import { api, PROJECT_CATEGORIES } from '../api';
import type { Project } from '../api';

const easeOut = [0.22, 1, 0.36, 1] as const;

type StatusFilter = 'all' | 'RECRUITING' | 'CLOSED' | 'CONFIRMED';

/** 승인 대기·반려는 오너와 코치에게만 보이는 상태라 필터로 내놓지 않습니다 */
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'RECRUITING', label: '모집중' },
  { key: 'CLOSED', label: '모집 마감' },
  { key: 'CONFIRMED', label: '팀 확정' },
];

const countByStatus = (projects: Project[], status: StatusFilter) =>
  projects.filter((p) => p.status === status).length;
export default function AllProjects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [field, setField] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    api
      .projects()
      .then(setProjects)
      .catch((e) => setError(e.message));
  }, []);

  const all = projects ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (projects ?? []).filter((p) => {
      if (status !== 'all' && p.status !== status) return false;
      if (category && p.category !== category) return false;
      if (field && !p.slots.some((s) => s.field === field)) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.summary ?? '').toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.owner?.name ?? '').toLowerCase().includes(q)
      );
    });
  }, [projects, query, field, status, category]);

  return (
    <div className="relative z-20 min-h-screen flex flex-col">
      <Navbar />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut }}
        className="flex-1 max-w-6xl w-full mx-auto px-6 pb-20"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">전체 프로젝트</h1>
            <p className="mt-2 text-sm text-white/70">
              {projects ? `${projects.length}개의 프로젝트` : '불러오는 중…'}
            </p>
          </div>
          <button
            onClick={() => navigate('/projects/new')}
            className="inline-flex items-center gap-2 rounded-full bg-white text-black text-sm font-semibold px-5 py-3 hover:bg-white/90 active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            프로젝트 등록
          </button>
        </div>

        {/* 검색 */}
        <div className="relative mt-6">
          <Search className="w-4 h-4 text-white/50 absolute left-5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="프로젝트 · 소개 · 오너로 검색"
            className="w-full h-14 rounded-2xl bg-white/[0.04] border border-white/10 pl-12 pr-5 text-sm text-white placeholder:text-white/50 outline-none focus:border-[#3182F6] focus:bg-white/[0.06] transition-colors"
          />
        </div>

        {/* 카테고리 — 프로젝트 탐색의 주요 기준이라 탭 형태로 크게 보여 줍니다 */}
        {PROJECT_CATEGORIES.length > 0 && (
          <div className="mt-4 overflow-x-auto border-b border-white/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max items-stretch">
              <button
                type="button"
                onClick={() => setCategory(null)}
                className={`border-b-2 px-4 py-4 text-sm md:px-5 md:text-base font-semibold whitespace-nowrap transition-colors ${
                  category === null
                    ? 'border-[#3182F6] text-white'
                    : 'border-transparent text-white/50 hover:text-white/85'
                }`}
              >
                전체
              </button>
              {PROJECT_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(category === c ? null : c)}
                  className={`border-b-2 px-4 py-4 text-sm md:px-5 md:text-base font-semibold whitespace-nowrap transition-colors ${
                    category === c
                      ? 'border-[#3182F6] text-white'
                      : 'border-transparent text-white/50 hover:text-white/85'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 분야 필터 */}
        <FieldFilters value={field} onChange={setField} className="mt-3" />

        {/* 프로젝트 목록과 모집 상태 필터 */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white/90">프로젝트 목록</h2>
          <div className="flex flex-wrap items-center justify-end text-sm">
            {STATUS_FILTERS.map((item, index) => (
              <span key={item.key} className="inline-flex items-center">
                {index > 0 && <span className="mx-2 text-white/20">|</span>}
                <button
                  type="button"
                  onClick={() => setStatus(item.key)}
                  className={`font-medium transition-colors ${
                    status === item.key
                      ? 'text-white'
                      : 'text-white/50 hover:text-white/85'
                  }`}
                >
                  {item.label}
                  <span className="ml-1 text-xs opacity-60 tabular-nums">
                    {item.key === 'all' ? all.length : countByStatus(all, item.key)}
                  </span>
                </button>
              </span>
            ))}
          </div>
        </div>

        {error && (
          <p className="mt-8 text-sm text-white/60 py-10 text-center border border-dashed border-white/10 rounded-2xl">
            프로젝트를 불러오지 못했어요 ({error})
          </p>
        )}

        {!projects && !error && (
          <div className="project-card-grid mt-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="project-card project-card--skeleton animate-pulse" />
            ))}
          </div>
        )}

        {projects && filtered.length === 0 && (
          <p className="mt-8 text-sm text-white/60 py-14 text-center border border-dashed border-white/10 rounded-2xl">
            조건에 맞는 프로젝트가 없어요
          </p>
        )}

        {projects && filtered.length > 0 && (
          <div className="project-card-grid mt-6">
            {filtered.map((p, i) => (
              <ProjectCard
                key={p.id}
                project={p}
                index={i}
                onClick={() => navigate(`/projects/${p.id}`)}
              />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
