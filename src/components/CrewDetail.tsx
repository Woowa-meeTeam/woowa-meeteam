import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ExternalLink } from 'lucide-react';
import { Avatar } from './primitives';
import Navbar from './Navbar';
import { FIELD_STYLES } from './FieldFilters';
import ProjectCard from './ProjectCard';
import { api } from '../api';
import type { Project, User } from '../api';

const easeOut = [0.22, 1, 0.36, 1] as const;

export default function CrewDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const [crew, setCrew] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.crew(id), api.projectsByOwner(id)])
      .then(([c, p]) => {
        setCrew(c);
        setProjects(p);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="relative z-20 min-h-screen flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm text-white/70">{error}</p>
        <button onClick={() => navigate('/crews')} className="text-sm text-[#7db4ff] hover:underline">
          크루 목록으로
        </button>
      </div>
    );
  }
  if (!crew) {
    return (
      <div className="relative z-20 min-h-screen grid place-items-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative z-20 min-h-screen flex flex-col">
      <Navbar />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut }}
        className="flex-1 max-w-6xl w-full mx-auto px-5 sm:px-6 pb-16"
      >
        <h1 className="page-title">크루 프로필</h1>

        <section className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
          <div className="order-last lg:order-first">
            <div className="flex items-center gap-5">
              <h2 className="shrink-0 text-sm font-semibold tracking-[0.18em] text-white/75">
                기술 스택
              </h2>
              <span className="h-px flex-1 bg-white/15" aria-hidden="true" />
            </div>

            {crew.skills.length > 0 ? (
              <div className="mt-5 grid grid-cols-2 border-y border-white/15 sm:grid-cols-3">
                {crew.skills.map((skill, index) => (
                  <div
                    key={skill}
                    className="min-h-24 border-b border-r border-white/10 p-5 last:border-b-0 sm:[&:nth-last-child(-n+3)]:border-b-0"
                  >
                    <span className="text-[10px] font-medium tracking-[0.18em] text-[#7db4ff]/70">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <p className="mt-2 text-base font-medium text-white/90">{skill}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 border-y border-white/15 py-10 text-sm text-white/45">
                등록된 기술 스택이 없어요.
              </p>
            )}
          </div>

          <aside className="order-first flex flex-col items-center text-center lg:order-last lg:border-l lg:border-white/10 lg:pl-16">
            <Avatar
              name={crew.crewName}
              avatarUrl={crew.avatarUrl}
              gradient={crew.avatarGradient}
              className="h-36 w-36 text-3xl ring-1 ring-white/20"
            />
            <h2 className="mt-6 text-2xl font-semibold tracking-tight">{crew.crewName}</h2>
            {crew.fields.length > 0 ? (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {crew.fields.map((field) => (
                  <span
                    key={field}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      FIELD_STYLES[field]?.tag ??
                      'border-white/20 bg-white/[0.06] text-white/70'
                    }`}
                  >
                    {field}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-white/45">분야 미설정</p>
            )}
            <a
              href={`https://github.com/${crew.githubLogin}`}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex max-w-full items-center gap-1.5 text-sm text-[#7db4ff] transition-colors hover:text-[#a9cbff]"
            >
              <span className="truncate">github.com/{crew.githubLogin}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
            {crew.bio && (
              <p className="mt-5 max-w-xs whitespace-pre-line text-sm leading-6 text-white/50">
                {crew.bio}
              </p>
            )}
          </aside>
        </section>

        {/* 등록한 프로젝트 */}
        <div className="mt-14">
          <div className="flex items-center gap-5">
            <h2 className="shrink-0 text-sm font-semibold tracking-[0.18em] text-white/75">
            등록한 프로젝트 <span className="text-white/60 font-normal">{projects.length}개</span>
            </h2>
            <span className="h-px flex-1 bg-white/15" aria-hidden="true" />
          </div>
          {projects.length === 0 ? (
            <p className="mt-5 text-sm text-white/60 py-10 text-center border-y border-white/10">
              아직 등록한 프로젝트가 없어요
            </p>
          ) : (
            <div className="project-card-grid mt-8">
              {projects.map((p, index) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  index={index}
                  onClick={() => navigate(`/projects/${p.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
