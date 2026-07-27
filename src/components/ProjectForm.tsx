import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Check, Eye, ImagePlus, Link as LinkIcon, Minus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { COVER_PRESETS, CoverFill, HomeLogo, StatusBadge } from './primitives';
import Markdown from './Markdown';
import { api, ApiError, FIELDS } from '../api';
import type { Project } from '../api';

const easeOut = [0.22, 1, 0.36, 1] as const;


/** 분야별로 자주 쓰는 스택을 먼저 제안하고, 직접 추가도 가능하게 */
const FIELD_SKILLS: Record<string, string[]> = {
  프론트엔드: ['React', 'TypeScript', 'Next.js', 'JavaScript', 'Vue', 'Tailwind'],
  백엔드: ['Spring', 'Java', 'Kotlin', 'Node.js', 'JPA', 'MySQL', 'AWS'],
  안드로이드: ['Kotlin', 'Jetpack Compose', 'Android', 'Retrofit'],
};

type Recruit = { field: string; capacity: number; skills: string[] };


export default function ProjectForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [desc, setDesc] = useState('');
  const [prototype, setPrototype] = useState('');
  const [cover, setCover] = useState<string>('gradient:aurora');
  const [recruits, setRecruits] = useState<Recruit[]>([
    { field: '프론트엔드', capacity: 1, skills: [] },
  ]);

  const [created, setCreated] = useState<Project | null>(null);
  /** 한 크루는 한 시점에 하나만 등록할 수 있어요 — 이미 있으면 폼 대신 안내를 보여줍니다 */
  const [existing, setExisting] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [insertingImage, setInsertingImage] = useState(false);
  const [showDescPreview, setShowDescPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [skillOpen, setSkillOpen] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  // 설명에 사진 첨부 — Storage 에 올리고 커서 위치에 ![](url) 삽입
  const onInsertImage = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setServerError('이미지는 5MB 이하로 올려 주세요');
      return;
    }
    setInsertingImage(true);
    setServerError(null);
    try {
      const url = await api.uploadImage(file);
      const md = `\n![이미지](${url})\n`;
      const el = descRef.current;
      const at = el?.selectionStart ?? desc.length;
      setDesc((prev) => prev.slice(0, at) + md + prev.slice(at));
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : '이미지 업로드에 실패했어요');
    } finally {
      setInsertingImage(false);
      if (imageRef.current) imageRef.current.value = '';
    }
  };

  // 수정 모드: 기존 값 불러오기
  useEffect(() => {
    if (!id) {
      // 새 등록 — 이미 들고 있는 프로젝트가 있으면 폼을 채우기 전에 막아줍니다.
      // (최종 차단은 DB 의 projects_one_per_owner 가 합니다)
      api
        .myProjects()
        .then((list) => {
          setExisting(list[0] ?? null);
          setLoading(false);
        })
        .catch(() => setLoading(false)); // 미로그인 등은 등록 시도 시 서버가 막아요
      return;
    }
    api
      .project(id)
      .then((p) => {
        setTitle(p.title);
        setSummary(p.summary ?? '');
        setDesc(p.longDesc.join('\n'));
        setPrototype(p.prototype ?? '');
        setCover(p.coverImage ?? 'gradient:aurora');
        setRecruits(
          p.slots.map((s) => ({ field: s.field, capacity: s.capacity, skills: s.skills })),
        );
        setLoading(false);
      })
      .catch((e) => {
        setServerError(e.message);
        setLoading(false);
      });
  }, [id]);

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

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setServerError(null);
    const payload = {
      title: title.trim(),
      summary: summary.trim() || undefined,
      desc: desc.trim(),
      prototype: prototype.trim() || undefined,
      coverImage: cover,
      slots: recruits,
    };
    try {
      const project = isEdit
        ? await api.updateProject(id!, payload)
        : await api.createProject(payload);
      if (isEdit) navigate(`/projects/${project.id}`);
      else setCreated(project);
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : '저장에 실패했어요');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id) return;
    setDeleting(true);
    setServerError(null);
    try {
      await api.deleteProject(id);
      navigate('/my');
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : '삭제에 실패했어요');
      setDeleting(false);
    }
  };

  const remainingFields = FIELDS.filter((f) => !recruits.some((r) => r.field === f));
  const addField = (field: string) =>
    setRecruits((prev) =>
      prev.some((r) => r.field === field) ? prev : [...prev, { field, capacity: 1, skills: [] }],
    );
  const removeField = (field: string) =>
    setRecruits((prev) => prev.filter((r) => r.field !== field));
  const changeCapacity = (field: string, delta: number) =>
    setRecruits((prev) =>
      prev.map((r) =>
        r.field === field ? { ...r, capacity: Math.min(9, Math.max(1, r.capacity + delta)) } : r,
      ),
    );
  const toggleSkill = (field: string, skill: string) =>
    setRecruits((prev) =>
      prev.map((r) =>
        r.field === field
          ? {
              ...r,
              skills: r.skills.includes(skill)
                ? r.skills.filter((s) => s !== skill)
                : [...r.skills, skill],
            }
          : r,
      ),
    );

  const totalSlots = recruits.reduce((sum, r) => sum + r.capacity, 0);

  if (loading) {
    return (
      <div className="relative z-20 min-h-screen grid place-items-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  /* 이미 하나 들고 있으면 새로 등록할 수 없어요 — 폐기(삭제)하고 다시 등록하는 흐름으로 안내 */
  if (!isEdit && existing) {
    return (
      <div className="project-focus-page relative z-20 min-h-screen flex flex-col">
        <div className="max-w-6xl w-full mx-auto px-6 py-5 flex items-center justify-between">
          <HomeLogo />
          <button
            onClick={() => navigate('/')}
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
          className="project-page-surface project-form-surface max-w-lg w-full mx-auto px-6 pb-16 text-center flex flex-col items-center"
        >
          <div className="w-16 h-16 rounded-full border border-[#FFB020]/40 bg-[#FFB020]/10 flex items-center justify-center">
            <Pencil className="w-6 h-6 text-[#ffd899]" />
          </div>

          <h1 className="mt-8 text-2xl md:text-3xl font-semibold tracking-tight leading-[1.25]">
            이미 진행 중인
            <br />
            아이디어가 있어요
          </h1>
          <p className="mt-3 text-sm text-white/70 leading-[1.7]">
            한 크루는 한 번에 하나의 아이디어만 들고 있을 수 있어요.
            <br />팀을 모으지 못했다면 아래 프로젝트를 삭제한 뒤 새로 등록해 주세요.
          </p>

          <div className="liquid-glass rounded-2xl overflow-hidden mt-8 w-full text-left">
            <div className="relative h-32">
              <CoverFill cover={existing.coverImage} />
              <div className="absolute top-3 left-3">
                <StatusBadge status={existing.status} />
              </div>
            </div>
            <div className="p-5 pt-3">
              <h3 className="text-base font-semibold text-white">{existing.title}</h3>
              <p className="mt-1.5 text-sm text-white/70 leading-[1.5] line-clamp-2">
                {existing.desc}
              </p>
            </div>
          </div>

          <div className="mt-8 w-full flex flex-col gap-2.5">
            <button
              onClick={() => navigate(`/projects/${existing.id}/edit`)}
              className="w-full h-12 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 active:scale-[0.99] transition-all"
            >
              기존 프로젝트 수정하기
            </button>
            <button
              onClick={() => navigate('/my')}
              className="w-full h-12 rounded-full border border-white/15 text-white/70 text-sm font-medium hover:bg-white/5 hover:text-white transition-colors"
            >
              마이페이지에서 관리하기
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="project-focus-page relative z-20 min-h-screen flex flex-col">
      <div className="max-w-6xl w-full mx-auto px-6 py-5 flex items-center justify-between">
        <HomeLogo />
        <button
          onClick={() => navigate(isEdit ? `/projects/${id}` : '/')}
          className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="닫기"
        >
          <X className="w-[18px] h-[18px]" />
        </button>
      </div>

      {!created ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOut }}
          className="project-page-surface project-form-surface flex flex-col max-w-lg w-full mx-auto px-6 pb-16"
        >
          <h1 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight leading-[1.25]">
            {isEdit ? (
              '프로젝트 수정'
            ) : (
              <>
                어떤 프로젝트를
                <br />
                함께 만들까요?
              </>
            )}
          </h1>
          <p className="mt-3 text-sm text-white/70">
            {isEdit ? '바꾸고 싶은 항목만 고치면 돼요' : '등록하면 바로 탐색 피드에 노출돼요'}
          </p>

          {/* 대표 이미지 */}
          <div className="mt-8">
            <span className="text-sm font-medium text-white/80">대표 이미지</span>
            <div className="relative mt-2.5 h-44 rounded-2xl overflow-hidden border border-white/10">
              <CoverFill cover={cover} fade={false} />
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
            <div className="mt-2.5 flex flex-wrap gap-2">
              {COVER_PRESETS.map((key) => {
                const value = `gradient:${key}`;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCover(value)}
                    className={`relative h-9 w-14 rounded-lg overflow-hidden border transition-all ${
                      cover === value
                        ? 'border-white ring-2 ring-white/30'
                        : 'border-white/10 hover:border-white/30'
                    }`}
                    aria-label={`${key} 커버`}
                  >
                    <CoverFill cover={value} fade={false} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* 프로젝트명 */}
          <label className="mt-8 block">
            <span className="text-sm font-medium text-white/80">프로젝트명</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 여행 기록 지도 서비스"
              className="mt-2.5 w-full h-14 rounded-2xl bg-white/[0.04] border border-white/10 px-5 text-base text-white placeholder:text-white/50 outline-none focus:border-[#3182F6] focus:bg-white/[0.06] transition-colors"
            />
            <div className="mt-2 flex justify-between text-xs">
              <span className={title && !titleValid ? 'text-[#F04452]' : 'text-white/50'}>
                {title && !titleValid ? '2~40자로 입력해 주세요' : '한눈에 들어오는 이름이 좋아요'}
              </span>
              <span className="text-white/50 tabular-nums">{title.trim().length}/40</span>
            </div>
          </label>

          {/* 짧은 소개 */}
          <label className="mt-6 block">
            <span className="text-sm font-medium text-white/80">
              짧은 소개 <span className="text-white/55 font-normal">(선택)</span>
            </span>
            <input
              value={summary}
              onChange={(e) => setSummary(e.target.value.slice(0, 80))}
              placeholder="예) 다녀온 여행을 지도에 기록하는 웹앱"
              className="mt-2.5 w-full h-14 rounded-2xl bg-white/[0.04] border border-white/10 px-5 text-sm text-white placeholder:text-white/50 outline-none focus:border-[#3182F6] focus:bg-white/[0.06] transition-colors"
            />
            <div className="mt-2 flex justify-between text-xs">
              <span className="text-white/50">카드에 보이는 한 줄 요약이에요</span>
              <span className="text-white/50 tabular-nums">{summary.length}/80</span>
            </div>
          </label>

          {/* 설명 (마크다운) */}
          <label className="mt-6 block">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-white/80">설명</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowDescPreview((preview) => !preview)}
                  aria-pressed={showDescPreview}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3182F6]/60 ${
                    showDescPreview
                      ? 'border-[#3182F6]/45 bg-[#3182F6]/15 text-[#a9ccff]'
                      : 'border-white/12 bg-white/[0.04] text-white/65 hover:border-white/25 hover:text-white'
                  }`}
                >
                  {showDescPreview ? (
                    <Pencil className="w-3 h-3" />
                  ) : (
                    <Eye className="w-3 h-3" />
                  )}
                  {showDescPreview ? '편집하기' : '미리보기'}
                </button>
                <button
                  type="button"
                  onClick={() => imageRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium text-[#7db4ff] hover:bg-[#3182F6]/10 hover:text-[#A4F4FD] transition-colors"
                >
                  <ImagePlus className="w-3 h-3" />
                  {insertingImage ? '올리는 중…' : '사진 첨부'}
                </button>
              </div>
              <input
                ref={imageRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onInsertImage(e.target.files?.[0])}
              />
            </div>
            {showDescPreview ? (
              <div className="project-markdown-preview mt-2.5" aria-label="설명 마크다운 미리보기">
                {desc.trim() ? (
                  <Markdown>{desc}</Markdown>
                ) : (
                  <p className="text-sm text-white/40">설명을 입력하면 여기에 미리 보여요.</p>
                )}
              </div>
            ) : (
              <textarea
                ref={descRef}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder={'## 어떤 서비스인가요\n다녀온 여행지를 지도에 기록하는 웹앱이에요.\n\n- 매주 화/목 저녁 모임\n- **완성**에 초점을 둡니다\n\n(사진 첨부 버튼으로 이미지를 넣을 수 있어요)'}
                rows={8}
                className="mt-2.5 w-full rounded-2xl bg-white/[0.04] border border-white/10 px-5 py-4 text-sm text-white placeholder:text-white/25 outline-none focus:border-[#3182F6] focus:bg-white/[0.06] transition-colors resize-y leading-[1.7] font-mono"
              />
            )}
            <span className="mt-1.5 block text-[11px] text-white/50">
              마크다운 지원 · **굵게** · ## 제목 · - 목록 · ![](이미지)
            </span>
          </label>

          {/* 프로토타입 */}
          <label className="mt-6 block">
            <span className="text-sm font-medium text-white/80">
              프로토타입 링크 <span className="text-white/55 font-normal">(선택)</span>
            </span>
            <div className="relative mt-2.5">
              <LinkIcon className="w-4 h-4 text-white/50 absolute left-5 top-1/2 -translate-y-1/2" />
              <input
                value={prototype}
                onChange={(e) => setPrototype(e.target.value)}
                placeholder="https://figma.com/..."
                className="w-full h-14 rounded-2xl bg-white/[0.04] border border-white/10 pl-12 pr-5 text-sm text-white placeholder:text-white/50 outline-none focus:border-[#3182F6] focus:bg-white/[0.06] transition-colors"
              />
            </div>
          </label>


          {/* 모집 분야 · 인원 · 스킬 */}
          <div className="mt-6">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-white/80">모집 분야 · 인원</span>
              <span className="text-xs text-white/60 tabular-nums">총 {totalSlots}명 모집</span>
            </div>

            <div className="mt-2.5 space-y-2.5">
              {recruits.map((r) => {
                const suggestions = FIELD_SKILLS[r.field] ?? [];
                const open = skillOpen === r.field;
                return (
                  <div key={r.field} className="liquid-glass rounded-2xl px-5 py-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{r.field}</span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => changeCapacity(r.field, -1)}
                            disabled={r.capacity <= 1}
                            className="w-8 h-8 rounded-lg bg-white/[0.06] text-white/70 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center transition-colors"
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
                            className="w-8 h-8 rounded-lg bg-white/[0.06] text-white/70 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center transition-colors"
                            aria-label={`${r.field} 인원 늘리기`}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeField(r.field)}
                          className="ml-1 w-8 h-8 rounded-lg text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
                          aria-label={`${r.field} 분야 제거`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* 선택된 스킬 + 토글 */}
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {r.skills.map((s) => (
                        <span
                          key={s}
                          className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-[#3182F6]/40 text-[#7db4ff] bg-[#3182F6]/10"
                        >
                          {s}
                        </span>
                      ))}
                      <button
                        onClick={() => setSkillOpen(open ? null : r.field)}
                        className="text-[11px] text-white/65 hover:text-white px-2 py-1 rounded-full border border-dashed border-white/20 hover:border-white/40 transition-colors"
                      >
                        {r.skills.length === 0 ? '＋ 원하는 기술 스택 (선택)' : open ? '닫기' : '수정'}
                      </button>
                    </div>

                    {open && (
                      <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-1.5">
                        {suggestions.map((s) => {
                          const on = r.skills.includes(s);
                          return (
                            <button
                              key={s}
                              onClick={() => toggleSkill(r.field, s)}
                              className={`text-[11px] font-medium px-2.5 py-1.5 rounded-full border transition-all ${
                                on
                                  ? 'bg-white text-black border-white'
                                  : 'bg-white/[0.03] text-white/60 border-white/10 hover:border-white/30 hover:text-white'
                              }`}
                            >
                              {on && <Check className="w-3 h-3 inline mr-1 -mt-0.5" strokeWidth={3} />}
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
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

          {serverError && <p className="mt-6 text-xs text-[#F04452]">{serverError}</p>}

          <button
            onClick={submit}
            disabled={!canSubmit}
            className={`mt-8 h-12 rounded-full text-sm font-semibold transition-all ${
              canSubmit
                ? 'bg-white text-black hover:bg-white/90 active:scale-[0.99]'
                : 'bg-white/10 text-white/50 cursor-not-allowed'
            }`}
          >
            {saving ? '저장하는 중…' : isEdit ? '수정 완료' : '등록하기'}
          </button>

          {/* 삭제 (수정 모드 전용) */}
          {isEdit && (
            <div className="mt-10 pt-6 border-t border-white/10">
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-[#F04452] transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  프로젝트 삭제
                </button>
              ) : (
                <div className="liquid-glass rounded-2xl p-5">
                  <p className="text-sm font-semibold text-white">정말 삭제할까요?</p>
                  <p className="mt-1.5 text-xs text-white/70 leading-[1.6]">
                    프로젝트와 지원 내역이 모두 사라지고 되돌릴 수 없어요.
                  </p>
                  <div className="mt-4 flex gap-2.5">
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 h-11 rounded-full border border-white/15 text-white/70 text-sm font-medium hover:bg-white/5"
                    >
                      취소
                    </button>
                    <button
                      onClick={remove}
                      disabled={deleting}
                      className="flex-1 h-11 rounded-full bg-[#F04452] text-white text-sm font-semibold hover:bg-[#d93b48] disabled:opacity-50 transition-colors"
                    >
                      {deleting ? '삭제 중…' : '삭제할게요'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      ) : (
        /* 등록 완료 */
        <div className="project-page-surface project-form-surface flex flex-col items-center justify-center max-w-lg w-full mx-auto px-6 pb-16 text-center">
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
            className="mt-8 text-3xl md:text-4xl font-semibold tracking-tight"
          >
            {isEdit ? '수정 완료!' : '등록 완료!'}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25, ease: easeOut }}
            className="mt-3 text-sm text-white/70"
          >
            {isEdit
              ? '변경사항이 저장됐어요.'
              : '코치 승인을 받으면 탐색 피드에 게시돼요. 승인 현황은 마이페이지에서 볼 수 있어요.'}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35, ease: easeOut }}
            className="liquid-glass rounded-2xl overflow-hidden mt-8 w-full text-left"
          >
            <div className="relative h-32">
              <CoverFill cover={created.coverImage} />
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                <span
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-md border ${
                    created.status === 'PENDING'
                      ? 'border-[#FFB020]/40 text-[#ffd27d] bg-black/30'
                      : 'border-[#3182F6]/40 text-[#cfe4ff] bg-[#3182F6]/25'
                  }`}
                >
                  {created.status === 'PENDING' ? '승인 대기' : '● 모집중'}
                </span>
              </div>
            </div>
            <div className="p-5 pt-3">
              <h3 className="text-base font-semibold text-white">{created.title}</h3>
              <p className="mt-1.5 text-sm text-white/70 leading-[1.5] line-clamp-2">
                {created.desc}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {created.slots.map((s) => (
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

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45, ease: easeOut }}
            className="mt-8 w-full flex flex-col gap-2.5"
          >
            <button
              onClick={() => navigate(`/projects/${created.id}`)}
              className="w-full h-12 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 active:scale-[0.99] transition-all"
            >
              프로젝트 보러 가기
            </button>
            <button
              onClick={() => navigate('/my')}
              className="w-full h-12 rounded-full border border-white/15 text-white/70 text-sm font-medium hover:bg-white/5 hover:text-white transition-colors"
            >
              마이페이지
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
