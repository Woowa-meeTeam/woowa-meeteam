import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Check, Plus, Search, X } from 'lucide-react';
import { Avatar, LogoMark } from './primitives';
import { api, ApiError } from '../api';
import type { User } from '../api';

const easeOut = [0.22, 1, 0.36, 1] as const;

const ALL_FIELDS = ['프론트엔드', '백엔드', '안드로이드', 'iOS', '기획', '디자인'];
const SKILLS = [
  'React', 'TypeScript', 'Next.js', 'JavaScript', 'Spring', 'Kotlin', 'Java', 'JPA',
  'MySQL', 'Node.js', 'AWS', 'Android', 'Swift', 'SwiftUI', 'Figma', 'Docker',
];

/** 온보딩을 다시 밟지 않고 필요한 항목만 고치는 화면 (FR-MY-01) */
export default function ProfileEdit() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  const [crewName, setCrewName] = useState('');
  const [bio, setBio] = useState('');
  const [fields, setFields] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .me()
      .then((me) => {
        setUser(me);
        setCrewName(me.crewName ?? '');
        setBio(me.bio ?? '');
        setFields(me.fields);
        setSkills(me.skills);
      })
      .catch(() => navigate('/', { replace: true }));
  }, [navigate]);

  const filteredSkills = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? SKILLS.filter((s) => s.toLowerCase().includes(q)) : SKILLS;
  }, [query]);

  const canAddCustom =
    query.trim().length > 0 &&
    !SKILLS.some((s) => s.toLowerCase() === query.trim().toLowerCase()) &&
    !skills.some((s) => s.toLowerCase() === query.trim().toLowerCase());

  const toggle = (setter: (fn: (p: string[]) => string[]) => void, value: string) =>
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));

  const nameValid = crewName.trim().length >= 2 && crewName.trim().length <= 20;
  const bioValid = bio.length <= 200;
  const dirty =
    user != null &&
    (crewName.trim() !== (user.crewName ?? '') ||
      bio.trim() !== (user.bio ?? '') ||
      JSON.stringify(fields) !== JSON.stringify(user.fields) ||
      JSON.stringify(skills) !== JSON.stringify(user.skills));
  const canSave = nameValid && bioValid && fields.length > 0 && skills.length > 0 && dirty && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateMe({ crewName, bio, fields, skills });
      setUser(updated);
      setSaved(true);
      setTimeout(() => navigate('/my'), 700);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '저장에 실패했어요');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="relative z-20 min-h-screen grid place-items-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative z-20 min-h-screen flex flex-col">
      <div className="max-w-6xl w-full mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <LogoMark className="w-7 h-7" />
          <span className="text-[17px] font-bold tracking-tight">meeTeam</span>
        </div>
        <button
          onClick={() => navigate('/my')}
          className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="닫기"
        >
          <X className="w-[18px] h-[18px]" />
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut }}
        className="flex-1 max-w-lg w-full mx-auto px-6 pb-16"
      >
        <button
          onClick={() => navigate('/my')}
          className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          마이페이지
        </button>

        <h1 className="mt-6 text-3xl md:text-4xl font-semibold tracking-tight">프로필 수정</h1>
        <p className="mt-3 text-sm text-white/50">바꾸고 싶은 항목만 고치면 돼요</p>

        {/* GitHub 계정 (수정 불가) */}
        <div className="liquid-glass rounded-2xl p-4 mt-7 flex items-center gap-3">
          <Avatar
            name={user.crewName}
            avatarUrl={user.avatarUrl}
            gradient={user.avatarGradient}
            className="w-12 h-12 text-base"
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">@{user.githubLogin}</div>
            <div className="text-xs text-white/40 mt-0.5">
              프로필 사진은 GitHub 계정을 따라갑니다
            </div>
          </div>
        </div>

        {/* 크루명 */}
        <label className="mt-7 block">
          <span className="text-sm font-medium text-white/80">크루명</span>
          <input
            value={crewName}
            onChange={(e) => setCrewName(e.target.value)}
            className="mt-2.5 w-full h-14 rounded-2xl bg-white/[0.04] border border-white/10 px-5 text-base text-white outline-none focus:border-[#3182F6] focus:bg-white/[0.06] transition-colors"
          />
          <div className="mt-2 flex justify-between text-xs">
            <span className={crewName && !nameValid ? 'text-[#F04452]' : 'text-white/30'}>
              {crewName && !nameValid ? '2~20자로 입력해 주세요' : '동료 크루들에게 보여지는 이름'}
            </span>
            <span className="text-white/30 tabular-nums">{crewName.trim().length}/20</span>
          </div>
        </label>

        {/* 자기소개 */}
        <label className="mt-6 block">
          <span className="text-sm font-medium text-white/80">자기소개</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="어떤 걸 좋아하고, 어떤 팀을 찾고 있는지 자유롭게 적어주세요"
            className="mt-2.5 w-full rounded-2xl bg-white/[0.04] border border-white/10 px-5 py-4 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#3182F6] focus:bg-white/[0.06] transition-colors resize-none leading-[1.6]"
          />
          <div className="mt-2 flex justify-between text-xs">
            <span className={!bioValid ? 'text-[#F04452]' : 'text-white/30'}>
              {!bioValid ? '200자 이내로 적어 주세요' : '크루 목록과 지원할 때 함께 보여요'}
            </span>
            <span className="text-white/30 tabular-nums">{bio.length}/200</span>
          </div>
        </label>

        {/* 분야 */}
        <div className="mt-6">
          <span className="text-sm font-medium text-white/80">분야</span>
          <div className="mt-2.5 grid grid-cols-2 gap-3">
            {ALL_FIELDS.map((f) => {
              const on = fields.includes(f);
              return (
                <button
                  key={f}
                  onClick={() => toggle(setFields, f)}
                  className={`h-13 py-3.5 rounded-2xl border text-sm font-medium transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${
                    on
                      ? 'bg-white text-black border-white'
                      : 'bg-white/[0.03] text-white/70 border-white/10 hover:border-white/25 hover:text-white'
                  }`}
                >
                  {on && <Check className="w-4 h-4" strokeWidth={3} />}
                  {f}
                </button>
              );
            })}
          </div>
          {fields.length === 0 && (
            <p className="mt-2 text-xs text-[#F04452]">1개 이상 선택해 주세요</p>
          )}
        </div>

        {/* 스킬 */}
        <div className="mt-6">
          <span className="text-sm font-medium text-white/80">스킬</span>
          <div className="relative mt-2.5">
            <Search className="w-4 h-4 text-white/30 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="스킬 검색 또는 직접 추가"
              className="w-full h-12 rounded-xl bg-white/[0.04] border border-white/10 pl-11 pr-4 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#3182F6] transition-colors"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {filteredSkills.map((s) => {
              const on = skills.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => toggle(setSkills, s)}
                  className={`px-4 py-2 rounded-full border text-sm font-medium transition-all active:scale-[0.97] ${
                    on
                      ? 'bg-white text-black border-white'
                      : 'bg-white/[0.03] text-white/70 border-white/10 hover:border-white/25 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              );
            })}
            {canAddCustom && (
              <button
                onClick={() => {
                  const c = query.trim();
                  setSkills((prev) => (prev.includes(c) ? prev : [...prev, c]));
                  setQuery('');
                }}
                className="px-4 py-2 rounded-full border border-dashed border-[#3182F6]/60 text-sm font-medium text-[#7db4ff] hover:bg-[#3182F6]/10 transition-colors inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />“{query.trim()}” 추가
              </button>
            )}
          </div>
          {/* 직접 추가한 스킬 */}
          {skills.filter((s) => !SKILLS.includes(s)).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {skills
                .filter((s) => !SKILLS.includes(s))
                .map((s) => (
                  <button
                    key={s}
                    onClick={() => toggle(setSkills, s)}
                    className="px-4 py-2 rounded-full border border-white bg-white text-black text-sm font-medium inline-flex items-center gap-1.5"
                  >
                    {s}
                    <X className="w-3.5 h-3.5" />
                  </button>
                ))}
            </div>
          )}
          {skills.length === 0 && (
            <p className="mt-2 text-xs text-[#F04452]">1개 이상 선택해 주세요</p>
          )}
        </div>

        {error && <p className="mt-6 text-xs text-[#F04452]">{error}</p>}

        <button
          onClick={save}
          disabled={!canSave}
          className={`mt-8 w-full h-12 rounded-full text-sm font-semibold transition-all ${
            saved
              ? 'bg-[#00C471] text-white'
              : canSave
                ? 'bg-white text-black hover:bg-white/90 active:scale-[0.99]'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
          }`}
        >
          {saved ? '저장했어요!' : saving ? '저장하는 중…' : dirty ? '저장하기' : '변경사항 없음'}
        </button>
      </motion.div>
    </div>
  );
}
