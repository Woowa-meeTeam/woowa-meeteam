import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, ExternalLink, X } from 'lucide-react';
import { Avatar, CoverFill, HomeLogo } from './primitives';
import { api, FIELD_SHORT } from '../api';
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
        <p className="text-sm text-white/50">{error}</p>
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
      <div className="max-w-6xl w-full mx-auto px-6 py-5 flex items-center justify-between">
        <HomeLogo />
        <button
          onClick={() => navigate('/crews')}
          className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="크루 목록으로"
        >
          <X className="w-[18px] h-[18px]" />
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut }}
        className="flex-1 max-w-2xl w-full mx-auto px-6 pb-20"
      >
        <button
          onClick={() => navigate('/crews')}
          className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          크루 목록
        </button>

        {/* 프로필 */}
        <div className="mt-7 flex items-center gap-5">
          <Avatar
            name={crew.crewName}
            avatarUrl={crew.avatarUrl}
            gradient={crew.avatarGradient}
            className="w-20 h-20 text-2xl"
          />
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
              {crew.crewName}
            </h1>
            <a
              href={`https://github.com/${crew.githubLogin}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-white/45 hover:text-[#7db4ff] transition-colors"
            >
              @{crew.githubLogin}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {crew.bio && (
          <p className="mt-6 text-[15px] text-white/70 leading-[1.75] whitespace-pre-line">
            {crew.bio}
          </p>
        )}

        {/* 분야 */}
        <div className="mt-7">
          <h2 className="text-sm font-semibold text-white/80">분야</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {crew.fields.map((f) => (
              <span
                key={f}
                className="text-sm font-medium px-3.5 py-1.5 rounded-full border border-[#3182F6]/40 text-[#7db4ff] bg-[#3182F6]/10"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* 스킬 */}
        {crew.skills.length > 0 && (
          <div className="mt-7">
            <h2 className="text-sm font-semibold text-white/80">스킬</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {crew.skills.map((s) => (
                <span
                  key={s}
                  className="text-sm text-white/70 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/[0.03]"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 등록한 프로젝트 */}
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-white/80">
            등록한 프로젝트 <span className="text-white/40 font-normal">{projects.length}개</span>
          </h2>
          {projects.length === 0 ? (
            <p className="mt-3 text-sm text-white/40 py-10 text-center border border-dashed border-white/10 rounded-2xl">
              아직 등록한 프로젝트가 없어요
            </p>
          ) : (
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className={`liquid-glass rounded-2xl overflow-hidden text-left transition-transform hover:-translate-y-1 ${
                    p.closed ? 'opacity-60' : ''
                  }`}
                >
                  <div className="relative h-28">
                    <CoverFill cover={p.coverImage} />
                    <span
                      className={`absolute top-3 left-3 text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-md border ${
                        p.closed
                          ? 'border-white/15 text-white/70 bg-black/30'
                          : 'border-[#3182F6]/40 text-[#cfe4ff] bg-[#3182F6]/25'
                      }`}
                    >
                      {p.closed ? '모집 마감' : '● 모집중'}
                    </span>
                  </div>
                  <div className="p-4 pt-3">
                    <h3 className="text-sm font-semibold text-white leading-snug">{p.title}</h3>
                    <p className="mt-1.5 text-xs text-white/50 leading-[1.5] line-clamp-2">
                      {p.desc}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {p.slots.map((s) => (
                        <span
                          key={s.field}
                          className="text-[11px] px-2 py-0.5 rounded-full border border-white/15 text-white/70 bg-white/[0.04] tabular-nums"
                        >
                          {FIELD_SHORT[s.field] ?? s.field} {s.confirmed}/{s.capacity}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
