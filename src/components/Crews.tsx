import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Search, Users } from 'lucide-react';
import { Avatar } from './primitives';
import Navbar from './Navbar';
import FieldFilters, { FieldTag } from './FieldFilters';
import { api } from '../api';
import type { User } from '../api';

const easeOut = [0.22, 1, 0.36, 1] as const;
const HANGUL_INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';

const getHangulInitials = (name: string) =>
  Array.from(name)
    .map((character) => {
      const code = character.charCodeAt(0) - 0xac00;
      return code >= 0 && code <= 11171
        ? HANGUL_INITIALS[Math.floor(code / 588)]
        : character;
    })
    .join('');

export default function Crews() {
  const navigate = useNavigate();
  const [crews, setCrews] = useState<User[] | null>(null);
  const [lookingIds, setLookingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [field, setField] = useState<string | null>(null);
  const [lookingOnly, setLookingOnly] = useState(false);

  useEffect(() => {
    Promise.all([api.crews(), api.crewsLookingForTeam().catch(() => [] as User[])])
      .then(([all, looking]) => {
        setCrews(all);
        setLookingIds(new Set(looking.map((c) => c.id)));
      })
      .catch((e) => setError(e.message));
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered =
    crews?.filter(
      (c) =>
        (!normalizedQuery ||
          (c.crewName ?? '').toLowerCase().includes(normalizedQuery) ||
          getHangulInitials(c.crewName ?? '').includes(normalizedQuery)) &&
        (!field || c.fields.includes(field)) &&
        (!lookingOnly || lookingIds.has(c.id)),
    ) ?? [];
  const lookingCount = crews?.filter((c) => lookingIds.has(c.id)).length ?? 0;

  return (
    <div className="relative z-20 min-h-screen flex flex-col">
      <Navbar />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut }}
        className="flex-1 max-w-6xl w-full mx-auto px-6 pb-20"
      >
        <div>
          <h1 className="page-title leading-[1.15]">
            함께할 크루들을
            <br />
            먼저 만나보세요.
          </h1>
          <p className="mt-3 text-sm text-white/70">
            어떤 분야와 스킬을 가진 크루가 있는지 둘러볼 수 있어요
          </p>
        </div>

        {/* 크루 이름 검색 */}
        <div className="mt-6 flex justify-end">
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/70">
            크루 {crews ? `${crews.length}명` : '불러오는 중'}
          </span>
        </div>
        <div className="relative mt-2">
          <Search className="w-4 h-4 text-white/50 absolute left-5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="크루 이름으로 검색"
            aria-label="크루 이름으로 검색"
            className="w-full h-14 rounded-2xl bg-white/[0.04] border border-white/10 pl-12 pr-5 text-sm text-white placeholder:text-white/50 outline-none focus:border-[#3182F6] focus:bg-white/[0.06] transition-colors"
          />
        </div>

        {/* 분야 필터 */}
        <FieldFilters value={field} onChange={setField} className="mt-8">
          <button
            type="button"
            onClick={() => setLookingOnly((v) => !v)}
            className={`flex-shrink-0 whitespace-nowrap px-3.5 py-2 rounded-full border text-sm font-medium transition-all sm:px-4 ${
              lookingOnly
                ? 'border-[#FFB020]/50 text-[#ffd27d] bg-[#FFB020]/10'
                : 'bg-white/[0.03] text-white/70 border-white/10 hover:border-white/25 hover:text-white'
            }`}
          >
            팀 찾는 중 {lookingCount > 0 && <span className="opacity-70">{lookingCount}</span>}
          </button>
        </FieldFilters>

        {error && (
          <p className="mt-8 text-sm text-white/60 py-10 text-center border border-dashed border-white/10 rounded-2xl">
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
          <p className="mt-8 text-sm text-white/60 py-12 text-center border border-dashed border-white/10 rounded-2xl">
            {crews.length === 0
              ? '아직 온보딩을 마친 크루가 없어요'
              : normalizedQuery
                ? `'${query}' 이름의 크루가 없어요`
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
                className="liquid-glass h-[190px] rounded-2xl p-5 text-left flex flex-col transition-transform hover:-translate-y-1 active:scale-[0.99]"
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
                    <span className="text-xs text-white/60">@{c.githubLogin}</span>
                  </div>
                  {lookingIds.has(c.id) && (
                    <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full border border-[#FFB020]/40 text-[#ffd27d] bg-[#FFB020]/10">
                      팀 찾는 중
                    </span>
                  )}
                </div>

                <div className="mt-auto h-7 flex flex-nowrap items-center gap-1.5 overflow-hidden">
                  {c.fields.slice(0, 2).map((f) => (
                    <FieldTag key={f} field={f} className="max-w-[112px] truncate flex-shrink-0" />
                  ))}
                  {c.fields.length > 2 && (
                    <span className="flex-shrink-0 text-[11px] text-[#7db4ff] px-1 py-1">
                      +{c.fields.length - 2}
                    </span>
                  )}
                </div>

                <div className="mt-2 h-6 flex flex-nowrap items-center gap-1.5 overflow-hidden">
                  {c.skills.slice(0, 3).map((s) => (
                    <span
                      key={s}
                      className="max-w-[92px] truncate flex-shrink-0 text-[11px] text-white/60 px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.03]"
                    >
                      {s}
                    </span>
                  ))}
                  {c.skills.length > 3 && (
                    <span className="flex-shrink-0 text-[11px] text-white/55 px-1 py-0.5">
                      +{c.skills.length - 3}
                    </span>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        )}

        {crews && crews.length > 0 && (
          <p className="mt-10 text-xs text-white/50 text-center inline-flex items-center gap-1.5 w-full justify-center">
            <Users className="w-3.5 h-3.5" />
            프로필은 온보딩과 마이페이지에서 언제든 바꿀 수 있어요
          </p>
        )}
      </motion.div>
    </div>
  );
}
