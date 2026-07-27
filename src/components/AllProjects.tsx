import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Bookmark, Heart, Plus, Search, Users } from 'lucide-react';
import { Avatar, CoverFill, StatusBadge } from './primitives';
import Navbar from './Navbar';
import { api, FIELD_SHORT } from '../api';
import type { Project } from '../api';

const easeOut = [0.22, 1, 0.36, 1] as const;
const ALL_FIELDS = ['백엔드', '프론트엔드', '안드로이드'];

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
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setField(null)}
            className={`px-3.5 py-2 rounded-full border text-xs font-medium transition-all ${
              field === null
                ? 'bg-white text-black border-white'
                : 'bg-white/[0.03] text-white/60 border-white/10 hover:text-white'
            }`}
          >
            전체 분야
          </button>
          {ALL_FIELDS.map((f) => (
            <button
              key={f}
              onClick={() => setField(field === f ? null : f)}
              className={`px-3.5 py-2 rounded-full border text-xs font-medium transition-all ${
                field === f
                  ? 'bg-white text-black border-white'
                  : 'bg-white/[0.03] text-white/60 border-white/10 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
          <span className="mx-1 w-px h-5 bg-white/10" />
          <button
            onClick={() => setOpenOnly((v) => !v)}
            className={`px-3.5 py-2 rounded-full border text-xs font-medium transition-all ${
              openOnly
                ? 'border-[#00C471]/50 text-[#9df0c4] bg-[#00C471]/15'
                : 'bg-white/[0.06] text-white/70 border-white/15 hover:text-white'
            }`}
          >
            모집중만
          </button>
        </div>

        {error && (
          <p className="mt-8 text-sm text-white/60 py-10 text-center border border-dashed border-white/10 rounded-2xl">
            프로젝트를 불러오지 못했어요 ({error})
          </p>
        )}

        {!projects && !error && (
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="liquid-glass rounded-2xl h-64 animate-pulse" />
            ))}
          </div>
        )}

        {projects && filtered.length === 0 && (
          <p className="mt-8 text-sm text-white/60 py-14 text-center border border-dashed border-white/10 rounded-2xl">
            조건에 맞는 프로젝트가 없어요
          </p>
        )}

        {projects && filtered.length > 0 && (
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p, i) => (
              <motion.button
                key={p.id}
                type="button"
                onClick={() => navigate(`/projects/${p.id}`)}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: (i % 9) * 0.03, ease: easeOut }}
                className={`liquid-glass rounded-2xl overflow-hidden flex flex-col text-left transition-transform hover:-translate-y-1 active:scale-[0.99] ${
                  p.closed ? 'opacity-[0.85]' : ''
                }`}
              >
                <div className="relative h-36">
                  <CoverFill cover={p.coverImage} />
                  <div className="absolute top-3 left-3">
                    <StatusBadge status={p.status} />
                  </div>
                </div>

                <div className="flex flex-col gap-3 p-5 pt-3 flex-1">
                  <div>
                    <h3 className="text-base font-semibold text-white leading-snug">{p.title}</h3>
                    <p className="mt-1.5 text-sm text-white/70 leading-[1.5] line-clamp-2">{p.desc}</p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {p.slots.map((s) => {
                      const full = s.confirmed >= s.capacity;
                      return (
                        <span
                          key={s.field}
                          className={`text-[11px] px-2.5 py-1 rounded-full border tabular-nums ${
                            full
                              ? 'border-white/15 text-white/70'
                              : 'border-white/25 text-white/85 bg-white/[0.08]'
                          }`}
                        >
                          {FIELD_SHORT[s.field] ?? s.field} {s.confirmed}/{s.capacity}
                        </span>
                      );
                    })}
                  </div>

                  {/* 지원자 수 · 반응 */}
                  <div className="flex items-center gap-3 text-[11px] text-white/65">
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {p.applicants}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      {p.likes}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Bookmark className="w-3 h-3" />
                      {p.bookmarks}
                    </span>
                  </div>

                  <div className="mt-auto pt-3 border-t border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={p.owner?.name}
                        avatarUrl={p.owner?.avatarUrl}
                        gradient={p.owner?.avatarGradient}
                        className="w-6 h-6 text-[10px]"
                      />
                      <span className="text-xs text-white/60">{p.owner?.name}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-white/50" />
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
