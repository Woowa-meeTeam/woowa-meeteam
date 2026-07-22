import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Users, X } from 'lucide-react';
import { Avatar, HomeLogo, SectionEyebrow } from './primitives';
import { api } from '../api';
import type { User } from '../api';

const easeOut = [0.22, 1, 0.36, 1] as const;

const ALL_FIELDS = ['프론트엔드', '백엔드', '안드로이드', 'iOS', '기획', '디자인'];

export default function Crews() {
  const navigate = useNavigate();
  const [crews, setCrews] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<string | null>(null);

  useEffect(() => {
    api
      .crews()
      .then(setCrews)
      .catch((e) => setError(e.message));
  }, []);

  const filtered = crews?.filter((c) => !field || c.fields.includes(field)) ?? [];

  return (
    <div className="relative z-20 min-h-screen flex flex-col">
      <div className="max-w-6xl w-full mx-auto px-6 py-5 flex items-center justify-between">
        <HomeLogo />
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="홈으로"
        >
          <X className="w-[18px] h-[18px]" />
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut }}
        className="flex-1 max-w-6xl w-full mx-auto px-6 pb-20"
      >
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />홈
        </button>

        <div className="mt-6">
          <SectionEyebrow label="크루" tag={crews ? `${crews.length}명` : '불러오는 중'} />
          <h1 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight leading-[1.15]">
            함께할 크루들을
            <br />
            먼저 만나보세요.
          </h1>
          <p className="mt-3 text-sm text-white/50">
            어떤 분야와 스킬을 가진 크루가 있는지 둘러볼 수 있어요
          </p>
        </div>

        {/* 분야 필터 */}
        <div className="mt-8 flex flex-wrap gap-2">
          <button
            onClick={() => setField(null)}
            className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
              field === null
                ? 'bg-white text-black border-white'
                : 'bg-white/[0.03] text-white/70 border-white/10 hover:border-white/25 hover:text-white'
            }`}
          >
            전체
          </button>
          {ALL_FIELDS.map((f) => (
            <button
              key={f}
              onClick={() => setField(f)}
              className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                field === f
                  ? 'bg-white text-black border-white'
                  : 'bg-white/[0.03] text-white/70 border-white/10 hover:border-white/25 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-8 text-sm text-white/40 py-10 text-center border border-dashed border-white/10 rounded-2xl">
            크루를 불러오지 못했어요 ({error})
          </p>
        )}

        {!crews && !error && (
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="liquid-glass rounded-2xl h-40 animate-pulse" />
            ))}
          </div>
        )}

        {crews && filtered.length === 0 && (
          <p className="mt-8 text-sm text-white/40 py-12 text-center border border-dashed border-white/10 rounded-2xl">
            {crews.length === 0
              ? '아직 온보딩을 마친 크루가 없어요'
              : `${field} 분야 크루가 아직 없어요`}
          </p>
        )}

        {crews && filtered.length > 0 && (
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c, i) => (
              <motion.button
                key={c.id}
                type="button"
                onClick={() => navigate(`/crews/${c.id}`)}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: (i % 6) * 0.05, ease: easeOut }}
                className="liquid-glass rounded-2xl p-5 text-left transition-transform hover:-translate-y-1 active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    name={c.crewName}
                    avatarUrl={c.avatarUrl}
                    gradient={c.avatarGradient}
                    className="w-12 h-12 text-base"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-semibold text-white truncate">{c.crewName}</div>
                    <span className="text-xs text-white/40">@{c.githubLogin}</span>
                  </div>
                </div>

                {c.bio && (
                  <p className="mt-3.5 text-sm text-white/60 leading-[1.6] line-clamp-3">{c.bio}</p>
                )}

                <div className="mt-3.5 flex flex-wrap gap-1.5">
                  {c.fields.map((f) => (
                    <span
                      key={f}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-[#3182F6]/40 text-[#7db4ff] bg-[#3182F6]/10"
                    >
                      {f}
                    </span>
                  ))}
                </div>

                {c.skills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.skills.slice(0, 5).map((s) => (
                      <span
                        key={s}
                        className="text-[11px] text-white/60 px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.03]"
                      >
                        {s}
                      </span>
                    ))}
                    {c.skills.length > 5 && (
                      <span className="text-[11px] text-white/35 px-1 py-0.5">
                        +{c.skills.length - 5}
                      </span>
                    )}
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        )}

        {crews && crews.length > 0 && (
          <p className="mt-10 text-xs text-white/30 text-center inline-flex items-center gap-1.5 w-full justify-center">
            <Users className="w-3.5 h-3.5" />
            프로필은 온보딩과 마이페이지에서 언제든 바꿀 수 있어요
          </p>
        )}
      </motion.div>
    </div>
  );
}
