import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Plus } from 'lucide-react';
import { SectionEyebrow } from './primitives';
import { Avatar, CoverFill, StatusBadge } from './primitives';
import { api, FIELD_SHORT } from '../api';
import type { Project } from '../api';

type Props = {
  onRegister?: () => void;
  onSelect?: (id: string) => void;
};

export default function ProjectsShowcase({ onRegister, onSelect }: Props) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .projects()
      .then(setProjects)
      .catch((e) => setError(e.message));
  }, []);

  const recruiting = projects?.filter((p) => !p.closed).length ?? 0;

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
      </motion.div>

      {error && (
        <p className="text-sm text-white/60 py-10 text-center border border-dashed border-white/10 rounded-2xl">
          프로젝트를 불러오지 못했어요 — API 서버를 확인해 주세요 ({error})
        </p>
      )}

      {!projects && !error && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="liquid-glass rounded-2xl p-5 h-52 animate-pulse" />
          ))}
        </div>
      )}

      {projects && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p, i) => (
            <motion.button
              key={p.id}
              type="button"
              onClick={() => onSelect?.(p.id)}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: (i % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className={`liquid-glass rounded-2xl overflow-hidden flex flex-col text-left transition-transform hover:-translate-y-1 active:scale-[0.99] ${
                p.closed ? 'opacity-[0.85]' : ''
              }`}
            >
              {/* 대표 이미지 — 아래로 갈수록 배경에 녹아들도록 fade */}
              <div className="relative h-36">
                <CoverFill cover={p.coverImage} />
                <div className="absolute top-3 left-3 right-3 flex items-center">
                  <StatusBadge status={p.status} />
                </div>
              </div>

              <div className="flex flex-col gap-4 p-5 pt-3 flex-1">
                <div>
                  <h3 className="text-base font-semibold text-white leading-snug">{p.title}</h3>
                  <p className="mt-1.5 text-sm text-white/70 leading-[1.5]">{p.desc}</p>
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

                <div className="mt-auto pt-3 border-t border-white/10 flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Avatar
                      name={p.owner?.name}
                      avatarUrl={p.owner?.avatarUrl}
                      gradient={p.owner?.avatarGradient}
                      className="w-6 h-6 text-[10px]"
                    />
                    <span className="text-xs text-white/75">
                      {p.owner?.name} · {p.owner?.field}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-white/50" />
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </section>
  );
}
