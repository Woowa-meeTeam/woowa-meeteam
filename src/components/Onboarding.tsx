import { useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Check, Plus, Search, X } from 'lucide-react';
import { HomeLogo } from './primitives';
import { api, ApiError } from '../api';

const easeOut = [0.22, 1, 0.36, 1] as const;

const FIELDS = ['백엔드', '프론트엔드', '안드로이드'];

const SKILLS = [
  'React',
  'TypeScript',
  'Next.js',
  'JavaScript',
  'Spring',
  'Kotlin',
  'Java',
  'JPA',
  'MySQL',
  'Node.js',
  'AWS',
  'Android',
  'Swift',
  'SwiftUI',
  'Figma',
  'Docker',
];

export default function Onboarding() {
  const navigate = useNavigate();
  const onDone = () => navigate('/');
  const onExit = () => navigate('/');

  const [step, setStep] = useState(0); // 0: 크루명, 1: 분야, 2: 스킬, 3: 완료
  const [direction, setDirection] = useState(1);

  const [crewName, setCrewName] = useState('');
  const [fields, setFields] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const nameValid = crewName.trim().length >= 2 && crewName.trim().length <= 20;
  const canNext = step === 0 ? nameValid : step === 1 ? fields.length > 0 : skills.length > 0;

  const filteredSkills = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SKILLS;
    return SKILLS.filter((s) => s.toLowerCase().includes(q));
  }, [query]);

  const canAddCustom =
    query.trim().length > 0 &&
    !SKILLS.some((s) => s.toLowerCase() === query.trim().toLowerCase()) &&
    !skills.some((s) => s.toLowerCase() === query.trim().toLowerCase());

  const toggle = (set: Dispatch<SetStateAction<string[]>>, value: string) => {
    set((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const go = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  // 마지막 스텝: 서버에 프로필 저장 (FR-ONB, PUT /api/me)
  const finish = async () => {
    setSaving(true);
    setServerError(null);
    try {
      await api.updateMe({ crewName: crewName.trim(), fields, skills, onboarded: true });
      go(3);
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : '프로필 저장에 실패했어요');
    } finally {
      setSaving(false);
    }
  };

  const stepMeta = [
    { title: '어떻게 불러드릴까요?', sub: '동료 크루들에게 보여질 이름이에요 (2~20자)' },
    { title: '어떤 분야의 크루인가요?', sub: '여러 개 선택할 수 있어요' },
    { title: '어떤 걸 다룰 수 있나요?', sub: '스킬은 지원할 때 프로필로 함께 공유돼요' },
  ];

  return (
    <div className="relative z-20 min-h-screen flex flex-col">
      {/* top bar */}
      <div className="max-w-6xl w-full mx-auto px-6 py-5 flex items-center justify-between">
        <HomeLogo />
        <button
          onClick={onExit}
          className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="온보딩 닫기"
        >
          <X className="w-[18px] h-[18px]" />
        </button>
      </div>

      {step < 3 ? (
        <div className="flex-1 flex flex-col max-w-lg w-full mx-auto px-6 pb-10">
          {/* progress */}
          <div className="flex items-center gap-2 mt-2 mb-10">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-1 flex-1 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#3182F6] to-[#00d2ff]"
                  initial={false}
                  animate={{ width: i < step ? '100%' : i === step ? '100%' : '0%' }}
                  transition={{ duration: 0.5, ease: easeOut }}
                  style={{ opacity: i === step ? 1 : i < step ? 0.55 : 0 }}
                />
              </div>
            ))}
            <span className="ml-2 text-xs text-white/60 tabular-nums">{step + 1} / 3</span>
          </div>

          <motion.div
            key={step}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, ease: easeOut }}
            className="flex-1 flex flex-col"
          >
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-[1.25]">
                {stepMeta[step].title}
              </h1>
              <p className="mt-3 text-sm text-white/70">{stepMeta[step].sub}</p>

              {/* step body */}
              {step === 0 && (
                <div className="mt-10">
                  <input
                    autoFocus
                    value={crewName}
                    onChange={(e) => setCrewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && canNext && go(1)}
                    placeholder="예) 재문"
                    className="w-full h-14 rounded-2xl bg-white/[0.04] border border-white/10 px-5 text-base text-white placeholder:text-white/50 outline-none focus:border-[#3182F6] focus:bg-white/[0.06] transition-colors"
                  />
                  <div className="mt-2.5 flex justify-between text-xs">
                    <span className={crewName && !nameValid ? 'text-[#F04452]' : 'text-white/50'}>
                      {crewName && !nameValid ? '2~20자로 입력해 주세요' : '실명이 아니어도 괜찮아요'}
                    </span>
                    <span className="text-white/50 tabular-nums">{crewName.trim().length}/20</span>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="mt-10 grid grid-cols-2 gap-3">
                  {FIELDS.map((f) => {
                    const on = fields.includes(f);
                    return (
                      <button
                        key={f}
                        onClick={() => toggle(setFields, f)}
                        className={`h-14 rounded-2xl border text-sm font-medium transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${
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
              )}

              {step === 2 && (
                <div className="mt-8 flex-1 flex flex-col">
                  <div className="relative">
                    <Search className="w-4 h-4 text-white/50 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="스킬 검색 또는 직접 추가"
                      className="w-full h-12 rounded-xl bg-white/[0.04] border border-white/10 pl-11 pr-4 text-sm text-white placeholder:text-white/50 outline-none focus:border-[#3182F6] transition-colors"
                    />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
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
                          const custom = query.trim();
                          setSkills((prev) => (prev.includes(custom) ? prev : [...prev, custom]));
                          setQuery('');
                        }}
                        className="px-4 py-2 rounded-full border border-dashed border-[#3182F6]/60 text-sm font-medium text-[#7db4ff] hover:bg-[#3182F6]/10 transition-colors inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />“{query.trim()}” 추가
                      </button>
                    )}
                  </div>

                  {skills.filter((s) => !SKILLS.includes(s)).length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {skills
                        .filter((s) => !SKILLS.includes(s))
                        .map((s) => (
                          <button
                            key={s}
                            onClick={() => toggle(setSkills, s)}
                            className="px-4 py-2 rounded-full border border-white bg-white text-black text-sm font-medium inline-flex items-center gap-1.5 active:scale-[0.97]"
                          >
                            {s}
                            <X className="w-3.5 h-3.5" />
                          </button>
                        ))}
                    </div>
                  )}

                  <p className="mt-5 text-xs text-white/60">
                    {skills.length > 0 ? `${skills.length}개 선택됨` : '최소 1개를 선택해 주세요'}
                  </p>
                </div>
              )}

              {/* bottom nav */}
              <div className="mt-auto pt-10">
                {serverError && <p className="mb-3 text-xs text-[#F04452]">{serverError}</p>}
                <div className="flex items-center gap-3">
                  {step > 0 && (
                    <button
                      onClick={() => go(step - 1)}
                      className="w-12 h-12 rounded-full border border-white/15 flex items-center justify-center text-white/70 hover:bg-white/5 transition-colors flex-shrink-0"
                      aria-label="이전 단계"
                    >
                      <ArrowLeft className="w-[18px] h-[18px]" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (!canNext || saving) return;
                      if (step === 2) finish();
                      else go(step + 1);
                    }}
                    disabled={!canNext || saving}
                    className={`flex-1 h-12 rounded-full text-sm font-semibold transition-all ${
                      canNext && !saving
                        ? 'bg-white text-black hover:bg-white/90 active:scale-[0.99]'
                        : 'bg-white/10 text-white/50 cursor-not-allowed'
                    }`}
                  >
                    {step === 2 ? (saving ? '저장하는 중…' : '시작하기') : '다음'}
                  </button>
                </div>
              </div>
          </motion.div>
        </div>
      ) : (
        /* completion */
        <div className="flex-1 flex flex-col items-center justify-center max-w-lg w-full mx-auto px-6 pb-16 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: easeOut }}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-[#3182F6] to-[#00d2ff] flex items-center justify-center"
          >
            <Check className="w-7 h-7 text-white" strokeWidth={3} />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: easeOut }}
            className="mt-8 text-3xl md:text-4xl font-semibold tracking-tight leading-[1.25]"
          >
            환영해요, {crewName.trim()}님!
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25, ease: easeOut }}
            className="mt-3 text-sm text-white/70"
          >
            프로필이 준비됐어요. 이제 함께할 팀을 찾아볼까요?
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35, ease: easeOut }}
            className="liquid-glass rounded-2xl p-5 mt-8 w-full text-left"
          >
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00d2ff] to-[#0B2551] flex items-center justify-center text-sm font-semibold text-white">
                {crewName.trim().slice(0, 1)}
              </span>
              <div>
                <div className="text-sm font-semibold text-white">{crewName.trim()}</div>
                <div className="text-xs text-white/70">{fields.join(' · ')}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <span
                  key={s}
                  className="text-[11px] text-white/70 px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.03]"
                >
                  {s}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45, ease: easeOut }}
            onClick={onDone}
            className="mt-8 w-full h-12 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 active:scale-[0.99] transition-all"
          >
            프로젝트 탐색하러 가기
          </motion.button>
        </div>
      )}
    </div>
  );
}
