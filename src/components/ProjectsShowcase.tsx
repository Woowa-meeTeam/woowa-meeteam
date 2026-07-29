import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { SectionEyebrow } from './primitives';
import ProjectCard from './ProjectCard';
import ProjectSort, { sortProjects } from './ProjectSort';
import type { SortKey } from './ProjectSort';
import { api } from '../api';
import type { Project } from '../api';

type Props = {
  onRegister?: () => void;
  onSelect?: (id: string) => void;
};

export default function ProjectsShowcase({ onRegister, onSelect }: Props) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('latest');

  useEffect(() => {
    api
      .projects()
      .then(setProjects)
      .catch((e) => setError(e.message));
  }, []);

  const recruiting = projects?.filter((p) => !p.closed).length ?? 0;
  const sorted = useMemo(() => sortProjects(projects ?? [], sort), [projects, sort]);

  return (
    <section id="projects" className="relative z-20 max-w-6xl mx-auto px-6 py-16 md:py-24 scroll-mt-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap items-end justify-between gap-4 mb-8"
      >
        <div>
          <SectionEyebrow
            label="지금 모집 중"
            tag={projects ? `${recruiting}개 모집중` : '불러오는 중'}
            live
          />
          <h2 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight leading-[1.15]">
            어떤 프로젝트가 있는지
            <br />
            먼저 둘러보세요.
          </h2>
        </div>
        <div className="flex flex-col items-end gap-2">
          {/* 정렬 기준 — 프로젝트 탐색과 같은 UI */}
          <ProjectSort value={sort} onChange={setSort} />
          <div className="flex items-center gap-2.5">
            <a
              href="/projects"
              className="text-sm font-medium text-white/60 hover:text-white transition-colors px-2"
            >
              전체 보기
            </a>
            <button
              onClick={onRegister}
              className="group inline-flex items-center gap-2 rounded-full bg-white text-black text-sm font-semibold px-5 py-3 hover:bg-white/90 active:scale-[0.98] transition-all"
            >
              <Plus className="w-4 h-4" />
              프로젝트 등록
            </button>
          </div>
        </div>
      </motion.div>

      {error && (
        <p className="text-sm text-white/60 py-10 text-center border border-dashed border-white/10 rounded-2xl">
          프로젝트를 불러오지 못했어요 — API 서버를 확인해 주세요 ({error})
        </p>
      )}

      {!projects && !error && (
        <div className="project-card-grid">
          {[0, 1].map((i) => (
            <div key={i} className="project-card project-card--skeleton animate-pulse" />
          ))}
        </div>
      )}

      {projects && (
        <div className="project-card-grid">
          {sorted.map((p, i) => (
            <ProjectCard
              key={p.id}
              project={p}
              index={i}
              onClick={() => onSelect?.(p.id)}
              animateOnView
            />
          ))}
        </div>
      )}
    </section>
  );
}
