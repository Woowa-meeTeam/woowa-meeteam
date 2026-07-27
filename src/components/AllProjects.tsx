import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Plus, Search } from 'lucide-react';
import Navbar from './Navbar';
import ProjectCard from './ProjectCard';
import FieldFilters from './FieldFilters';
import { api } from '../api';
import type { Project } from '../api';

const easeOut = [0.22, 1, 0.36, 1] as const;
export default function AllProjects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [field, setField] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);

  useEffect(() => {
    api
      .projects()
      .then(setProjects)
      .catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (projects ?? []).filter((p) => {
      if (openOnly && p.closed) return false;
      if (field && !p.slots.some((s) => s.field === field)) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.summary ?? '').toLowerCase().includes(q) ||
        p.longDesc.join(' ').toLowerCase().includes(q) ||
        (p.owner?.name ?? '').toLowerCase().includes(q)
      );
    });
  }, [projects, query, field, openOnly]);

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

        {/* 필터 */}
        <FieldFilters value={field} onChange={setField} className="mt-4">
          <button
            type="button"
            onClick={() => setOpenOnly((v) => !v)}
            className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
              openOnly
                ? 'border-[#00C471]/50 text-[#9df0c4] bg-[#00C471]/15'
                : 'bg-white/[0.03] text-white/70 border-white/10 hover:border-white/25 hover:text-white'
            }`}
          >
            모집중만
          </button>
        </FieldFilters>

        {error && (
          <p className="mt-8 text-sm text-white/60 py-10 text-center border border-dashed border-white/10 rounded-2xl">
            프로젝트를 불러오지 못했어요 ({error})
          </p>
        )}

        {!projects && !error && (
          <div className="project-card-grid mt-6">
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
