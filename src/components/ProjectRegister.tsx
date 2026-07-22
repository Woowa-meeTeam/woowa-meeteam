import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Check, ImagePlus, Link as LinkIcon, Minus, Plus, X } from 'lucide-react';
import { CoverFill, COVER_PRESETS, LogoMark } from './primitives';
import { api, ApiError } from '../api';
import type { Project } from '../api';

const easeOut = [0.22, 1, 0.36, 1] as const;

const ALL_FIELDS = ['프론트엔드', '백엔드', '안드로이드', 'iOS', '기획', '디자인'];

type Recruit = { field: string; capacity: number };

export default function ProjectRegister() {
  const navigate = useNavigate();
  const onDone = () => navigate('/my');
  const onExit = () => navigate('/');

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [prototype, setPrototype] = useState('');
  const [cover, setCover] = useState<string>('gradient:aurora');
  const [recruits, setRecruits] = useState<Recruit[]>([{ field: '프론트엔드', capacity: 1 }]);
  const [created, setCreated] = useState<Project | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Storage 에 올리고 공개 URL 을 커버로 사용합니다 (DB에 base64를 넣지 않음)
  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setServerError('이미지는 5MB 이하로 올려 주세요');
      return;
    }
    setUploading(true);
    setServerError(null);
    try {
      setCover(await api.uploadCover(file));
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : '이미지 업로드에 실패했어요');
    } finally {
      setUploading(false);
    }
  };

  const titleValid = title.trim().length >= 2 && title.trim().length <= 40;
  const descValid = desc.trim().length > 0;
  const canSubmit = titleValid && descValid && recruits.length > 0 && !saving;

  // POST /api/projects (FR-PRJ-01)
  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setServerError(null);
    try {
      const project = await api.createProject({
        title: title.trim(),
        desc: desc.trim(),
        prototype: prototype.trim() || undefined,
        coverImage: cover,
        slots: recruits,
      });
      setCreated(project);
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : '등록에 실패했어요');
    } finally {
      setSaving(false);
    }
  };

  const remainingFields = ALL_FIELDS.filter((f) => !recruits.some((r) => r.field === f));

  const addField = (field: string) =>
    setRecruits((prev) => (prev.some((r) => r.field === field) ? prev : [...prev, { field, capacity: 1 }]));

  const removeField = (field: string) => setRecruits((prev) => prev.filter((r) => r.field !== field));

  const changeCapacity = (field: string, delta: number) =>
    setRecruits((prev) =>
      prev.map((r) =>
        r.field === field ? { ...r, capacity: Math.min(9, Math.max(1, r.capacity + delta)) } : r,
      ),
    );

  const totalSlots = recruits.reduce((sum, r) => sum + r.capacity, 0);

  return (
    <div className="relative z-20 min-h-screen flex flex-col">
      {/* top bar */}
      <div className="max-w-6xl w-full mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <LogoMark className="w-7 h-7" />
          <span className="text-[17px] font-bold tracking-tight">meeTeam</span>
        </div>
        <button
          onClick={onExit}
          className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="등록 닫기"
        >
          <X className="w-[18px] h-[18px]" />
        </button>
      </div>

      {!created ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOut }}
          className="flex-1 flex flex-col max-w-lg w-full mx-auto px-6 pb-16"
        >
          <h1 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight leading-[1.25]">
            어떤 프로젝트를
            <br />
            함께 만들까요?
          </h1>
          <p className="mt-3 text-sm text-white/50">등록하면 바로 탐색 피드에 노출돼요</p>

          {/* 대표 이미지 */}
          <div className="mt-8">
            <span className="text-sm font-medium text-white/80">대표 이미지</span>
            {/* 미리보기 — 실제 카드처럼 아래가 배경에 녹아듦 */}
            <div className="relative mt-2.5 h-40 rounded-2xl overflow-hidden border border-white/10">
              <CoverFill cover={cover} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 text-xs font-semibold text-black bg-white/90 hover:bg-white rounded-full px-3.5 py-2 backdrop-blur transition-colors"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                {uploading ? '올리는 중…' : '이미지 업로드'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0])}
              />
            </div>
            {/* 프리셋 커버 */}
            <div className="mt-2.5 flex flex-wrap gap-2">
              {COVER_PRESETS.map((key) => {
                const value = `gradient:${key}`;
                const on = cover === value;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCover(value)}
                    className={`relative h-9 w-14 rounded-lg overflow-hidden border transition-all ${
                      on ? 'border-white ring-2 ring-white/30' : 'border-white/10 hover:border-white/30'
                    }`}
                    aria-label={`${key} 커버`}
                  >
                    <CoverFill cover={value} fade={false} />
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-white/30">
              사진이 없으면 프리셋 그라데이션을 골라도 배경과 잘 어울려요
            </p>
          </div>

          {/* 프로젝트명 */}
          <label className="mt-8 block">
            <span className="text-sm font-medium text-white/80">프로젝트명</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 여행 기록 지도 서비스"
              className="mt-2.5 w-full h-14 rounded-2xl bg-white/[0.04] border border-white/10 px-5 text-base text-white placeholder:text-white/30 outline-none focus:border-[#3182F6] focus:bg-white/[0.06] transition-colors"
            />
            <div className="mt-2 flex justify-between text-xs">
              <span className={title && !titleValid ? 'text-[#F04452]' : 'text-white/30'}>
                {title && !titleValid ? '2~40자로 입력해 주세요' : '한눈에 들어오는 이름이 좋아요'}
              </span>
              <span className="text-white/30 tabular-nums">{title.trim().length}/40</span>
            </div>
          </label>

          {/* 설명 */}
          <label className="mt-6 block">
            <span className="text-sm font-medium text-white/80">설명</span>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="무엇을 만들고, 어떻게 진행하나요? 마크다운을 지원해요."
              rows={5}
              className="mt-2.5 w-full rounded-2xl bg-white/[0.04] border border-white/10 px-5 py-4 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#3182F6] focus:bg-white/[0.06] transition-colors resize-none leading-[1.6]"
            />
          </label>

          {/* 프로토타입 */}
          <label className="mt-6 block">
            <span className="text-sm font-medium text-white/80">
              프로토타입 링크 <span className="text-white/35 font-normal">(선택)</span>
            </span>
            <div className="relative mt-2.5">
              <LinkIcon className="w-4 h-4 text-white/30 absolute left-5 top-1/2 -translate-y-1/2" />
              <input
                value={prototype}
                onChange={(e) => setPrototype(e.target.value)}
                placeholder="figma.com/… 또는 이미지 URL"
                className="w-full h-14 rounded-2xl bg-white/[0.04] border border-white/10 pl-12 pr-5 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#3182F6] focus:bg-white/[0.06] transition-colors"
              />
            </div>
          </label>

          {/* 모집 분야 · 인원 */}
          <div className="mt-6">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-white/80">모집 분야 · 인원</span>
              <span className="text-xs text-white/40 tabular-nums">총 {totalSlots}명 모집</span>
            </div>

            <div className="mt-2.5 space-y-2.5">
              {recruits.map((r) => (
                <div
                  key={r.field}
                  className="liquid-glass rounded-2xl px-5 py-3.5 flex items-center justify-between"
                >
                  <span className="text-sm font-medium text-white">{r.field}</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => changeCapacity(r.field, -1)}
                        disabled={r.capacity <= 1}
                        className="w-8 h-8 rounded-lg bg-white/[0.06] text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                        aria-label={`${r.field} 인원 줄이기`}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-6 text-center text-base font-semibold tabular-nums">
                        {r.capacity}
                      </span>
                      <button
                        onClick={() => changeCapacity(r.field, 1)}
                        disabled={r.capacity >= 9}
                        className="w-8 h-8 rounded-lg bg-white/[0.06] text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                        aria-label={`${r.field} 인원 늘리기`}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeField(r.field)}
                      className="ml-2 w-8 h-8 rounded-lg text-white/40 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
                      aria-label={`${r.field} 분야 제거`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {remainingFields.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {remainingFields.map((f) => (
                  <button
                    key={f}
                    onClick={() => addField(f)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-dashed border-white/25 text-sm text-white/60 hover:border-[#3182F6]/60 hover:text-[#7db4ff] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {f}
                  </button>
                ))}
              </div>
            )}
            {recruits.length === 0 && (
              <p className="mt-3 text-xs text-[#F04452]">모집 분야를 1개 이상 추가해 주세요</p>
            )}
          </div>

          {/* submit */}
          {serverError && <p className="mt-6 text-xs text-[#F04452]">{serverError}</p>}
          <button
            onClick={submit}
            disabled={!canSubmit}
            className={`mt-10 h-12 rounded-full text-sm font-semibold transition-all ${
              canSubmit
                ? 'bg-white text-black hover:bg-white/90 active:scale-[0.99]'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}
          >
            {saving ? '등록하는 중…' : '등록하기'}
          </button>
        </motion.div>
      ) : (
        /* success */
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
            등록 완료!
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25, ease: easeOut }}
            className="mt-3 text-sm text-white/50"
          >
            탐색 피드에 올라갔어요. 곧 크루들의 지원이 도착할 거예요.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35, ease: easeOut }}
            className="liquid-glass rounded-2xl overflow-hidden mt-8 w-full text-left"
          >
            <div className="relative h-24">
              <CoverFill cover={created?.coverImage ?? cover} />
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-md border border-[#3182F6]/40 text-[#cfe4ff] bg-[#3182F6]/25">
                  ● 모집중
                </span>
                <span className="text-[11px] font-semibold px-2 py-1 rounded-full backdrop-blur-md bg-black/30 text-[#A4F4FD]">
                  {created?.dday}
                </span>
              </div>
            </div>
            <div className="p-5 pt-3">
            <h3 className="text-base font-semibold text-white">{created?.title}</h3>
            <p className="mt-1.5 text-sm text-white/50 leading-[1.5] line-clamp-2">{created?.desc}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {created?.slots.map((s) => (
                <span
                  key={s.field}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-white/15 text-white/75 bg-white/[0.04] tabular-nums"
                >
                  {s.field} {s.confirmed}/{s.capacity}
                </span>
              ))}
            </div>
            </div>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45, ease: easeOut }}
            onClick={onDone}
            className="mt-8 w-full h-12 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 active:scale-[0.99] transition-all"
          >
            내 프로젝트 보러 가기
          </motion.button>
        </div>
      )}
    </div>
  );
}
