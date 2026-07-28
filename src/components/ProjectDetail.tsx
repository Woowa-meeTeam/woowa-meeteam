import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Bookmark,
  Check,
  ExternalLink,
  Eye,
  Heart,
  Link as LinkIcon,
  MapPin,
  Pencil,
  Users,
  X,
} from 'lucide-react';
import { Avatar, CoverFill, HomeLogo } from './primitives';
import Markdown from './Markdown';
import { api, ApiError } from '../api';
import type { Application, Project, User } from '../api';

const easeOut = [0.22, 1, 0.36, 1] as const;

type Mode = 'view' | 'apply';

export default function ProjectDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [myApplication, setMyApplication] = useState<Application | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>('view');
  const [applyField, setApplyField] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = () =>
    Promise.all([
      api.project(id),
      api.me().catch(() => null),
      api.myApplications().catch(() => [] as Application[]),
    ])
      .then(([p, u, apps]) => {
        setProject(p);
        setUser(u);
        const mine = apps.find((a) => a.projectId === p.id && a.status !== 'canceled') ?? null;
        setMyApplication(mine);
        // 지원 여부와 무관하게 항상 상세(view)를 볼 수 있게 둡니다.
      })
      .catch((e) => setLoadError(e.message));

  // 상세를 열면 조회로 기록합니다. 오너 본인과 중복 조회는 DB 가 걸러내요.
  useEffect(() => {
    if (!id) return;
    api.recordView(id).catch(() => {});
  }, [id]);

  const toggleReaction = async (kind: 'LIKE' | 'BOOKMARK') => {
    if (!project) return;
    const on = kind === 'LIKE' ? project.myLike : project.myBookmark;
    // 낙관적 업데이트
    setProject((prev) =>
      prev
        ? kind === 'LIKE'
          ? { ...prev, myLike: !on, likes: prev.likes + (on ? -1 : 1) }
          : { ...prev, myBookmark: !on, bookmarks: prev.bookmarks + (on ? -1 : 1) }
        : prev,
    );
    try {
      await api.toggleReaction(project.id, kind, !on);
    } catch (e) {
      // 실패 시 롤백
      setProject((prev) =>
        prev
          ? kind === 'LIKE'
            ? { ...prev, myLike: on, likes: prev.likes + (on ? 1 : -1) }
            : { ...prev, myBookmark: on, bookmarks: prev.bookmarks + (on ? 1 : -1) }
          : prev,
      );
      if (e instanceof ApiError && e.status === 401) setSubmitError('로그인이 필요해요');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loadError) {
    return (
      <div className="relative z-20 min-h-screen flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm text-white/70">{loadError}</p>
        <button onClick={() => navigate('/')} className="text-sm text-[#7db4ff] hover:underline">
          홈으로 돌아가기
        </button>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="relative z-20 min-h-screen grid place-items-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  const isOwner = user != null && project.owner?.id === user.id;
  const openSlots = project.slots.filter((s) => s.confirmed < s.capacity);
  const canApply = !project.closed && openSlots.length > 0 && !isOwner && myApplication == null;
  const canSubmit =
    applyField !== null && message.trim().length > 0 && message.trim().length <= 100 && !submitting;

  const submitApplication = async () => {
    if (!canSubmit || !applyField) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const application = await api.apply(project.id, { field: applyField, message: message.trim() });
      setMyApplication(application);
      setMode('view');
      load(); // 지원자 수 등 최신화
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : '지원에 실패했어요');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelApplication = async () => {
    if (!myApplication) return;
    try {
      await api.cancelApplication(myApplication.id);
      setMyApplication(null);
      setApplyField(null);
      setMessage('');
      setMode('view');
      load();
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : '취소에 실패했어요');
    }
  };

  return (
    <div className="project-focus-page relative z-20 min-h-screen flex flex-col">
      {/* top bar */}
      <div className="max-w-6xl w-full mx-auto px-6 py-5 flex items-center justify-between">
        <HomeLogo />
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="목록으로 돌아가기"
        >
          <X className="w-[18px] h-[18px]" />
        </button>
      </div>

      {/* ---------------- VIEW ---------------- */}
      {mode === 'view' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOut }}
          className="project-page-surface project-detail-surface max-w-2xl w-full mx-auto px-6 pb-16"
        >
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            프로젝트 목록
          </button>

          {/* 대표 이미지 — 카드와 같은 16:9.
              높이를 고정하면 화면 폭에 따라 비율이 달라져 보이는 영역이 계속 바뀝니다.
              아래를 흐리게 지우던 fade 도 껐어요. 올린 사진이 그대로 다 보여야 합니다. */}
          <div className="project-detail-hero relative mt-5 aspect-[16/9] rounded-3xl overflow-hidden">
            <CoverFill cover={project.coverImage} fade={false} />
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-md border ${
                  project.confirmed
                    ? 'border-[#00C471]/40 text-[#7ee8b2] bg-[#00C471]/20'
                    : project.status === 'PENDING'
                      ? 'border-[#FFB020]/40 text-[#ffd27d] bg-black/30'
                      : project.closed
                        ? 'border-white/15 text-white/70 bg-black/30'
                        : 'border-[#00C471]/60 text-[#9df0c4] bg-[#065f39]/70'
                }`}
              >
                {project.confirmed
                  ? '✓ 팀 확정'
                  : project.status === 'PENDING'
                    ? '승인 대기'
                    : project.status === 'REJECTED'
                      ? '반려됨'
                      : project.closed
                        ? '모집 마감'
                        : '● 모집중'}
              </span>
            </div>
          </div>

          <h1 className="mt-5 text-3xl md:text-4xl font-semibold tracking-tight leading-[1.2]">
            {project.title}
          </h1>

          {project.summary && (
            <p className="mt-3 text-[15px] text-white/70 leading-[1.6]">{project.summary}</p>
          )}

          {/* 지원자 수 · 좋아요 · 북마크 */}
          <div className="mt-5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-white/55 px-3 py-2 rounded-full bg-white/[0.04] border border-white/10">
              <Users className="w-3.5 h-3.5" />
              지원 {project.applicants}명
            </span>
            <span
              className="inline-flex items-center gap-1.5 text-xs text-white/55 px-3 py-2 rounded-full bg-white/[0.04] border border-white/10"
              title="나를 뺀, 이 프로젝트를 열어 본 크루 수예요"
            >
              <Eye className="w-3.5 h-3.5" />
              조회 {project.views}
            </span>
            <button
              onClick={() => toggleReaction('LIKE')}
              className={`inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border transition-all active:scale-[0.96] ${
                project.myLike
                  ? 'border-[#F04452]/40 text-[#ff8a94] bg-[#F04452]/10'
                  : 'border-white/10 text-white/55 bg-white/[0.04] hover:text-white'
              }`}
              aria-pressed={project.myLike}
            >
              <Heart className="w-3.5 h-3.5" fill={project.myLike ? 'currentColor' : 'none'} />
              {project.likes}
            </button>
            <button
              onClick={() => toggleReaction('BOOKMARK')}
              className={`inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border transition-all active:scale-[0.96] ${
                project.myBookmark
                  ? 'border-[#3182F6]/40 text-[#7db4ff] bg-[#3182F6]/10'
                  : 'border-white/10 text-white/55 bg-white/[0.04] hover:text-white'
              }`}
              aria-pressed={project.myBookmark}
            >
              <Bookmark className="w-3.5 h-3.5" fill={project.myBookmark ? 'currentColor' : 'none'} />
              {project.bookmarks}
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate(`/booths?projectId=${encodeURIComponent(project.id)}`)}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#00d2ff]/25 bg-[#00d2ff]/[0.08] px-3.5 py-2 text-xs font-medium text-[#8eeaff] transition-colors hover:border-[#00d2ff]/50 hover:bg-[#00d2ff]/[0.14]"
          >
            <MapPin className="h-3.5 w-3.5" />
            부스에서 보기
          </button>

          <button
            onClick={() => project.owner && navigate(`/crews/${project.owner.id}`)}
            className="mt-5 flex items-center gap-3 text-left group"
          >
            <Avatar
              name={project.owner?.name}
              avatarUrl={project.owner?.avatarUrl}
              gradient={project.owner?.avatarGradient}
              className="w-9 h-9 text-xs"
            />
            <div>
              <div className="text-sm font-semibold text-white group-hover:text-[#7db4ff] transition-colors">
                {project.owner?.name}
              </div>
              <div className="text-xs text-white/70">{project.owner?.field} · 프로젝트 오너</div>
            </div>
          </button>

          {/* 설명 (마크다운) */}
          <div className="project-detail-copy mt-8">
            <Markdown>{project.description}</Markdown>
          </div>

          {/* 일정 · 프로토타입 */}
          <div className="mt-8">
            {project.prototype ? (
              <a
                href={/^https?:\/\//.test(project.prototype) ? project.prototype : `https://${project.prototype}`}
                target="_blank"
                rel="noopener noreferrer"
                className="liquid-glass rounded-2xl px-5 py-4 flex items-center gap-3 group hover:-translate-y-0.5 transition-transform"
              >
                <LinkIcon className="w-4 h-4 text-white/60 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-white/60">프로토타입</div>
                  <div className="text-sm text-[#7db4ff] mt-0.5 truncate group-hover:text-[#A4F4FD] transition-colors">
                    {project.prototype}
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-white/50 group-hover:text-white/60 flex-shrink-0 transition-colors" />
              </a>
            ) : (
              <div className="liquid-glass rounded-2xl px-5 py-4 flex items-center gap-3 opacity-60">
                <LinkIcon className="w-4 h-4 text-white/60 flex-shrink-0" />
                <div>
                  <div className="text-[11px] text-white/60">프로토타입</div>
                  <div className="text-sm text-white/70 mt-0.5">아직 없어요</div>
                </div>
              </div>
            )}
          </div>

          {/* 모집 현황 */}
          <div className="mt-10">
            <h2 className="text-sm font-semibold text-white/80">모집 현황</h2>
            <div className="mt-4 space-y-4">
              {project.slots.map((s) => {
                const ratio = (s.confirmed / s.capacity) * 100;
                const full = s.confirmed >= s.capacity;
                return (
                  <div key={s.field}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className={full ? 'text-white/60' : 'text-white/80 font-medium'}>
                        {s.field}
                        {full && <span className="ml-2 text-[11px] text-white/50">정원 마감</span>}
                      </span>
                      <span className="text-white/60 tabular-nums">
                        {s.confirmed} / {s.capacity}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          full ? 'bg-white/25' : 'bg-gradient-to-r from-[#3182F6] to-[#00d2ff]'
                        }`}
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                    {s.skills.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {s.skills.map((sk) => (
                          <span
                            key={sk}
                            className="text-[11px] text-white/60 px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.03]"
                          >
                            {sk}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 팀 멤버 */}
          <div className="mt-10">
            <h2 className="text-sm font-semibold text-white/80 inline-flex items-center gap-1.5">
              <Users className="w-4 h-4 text-white/60" />팀 멤버 {project.members.length}명
            </h2>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {project.members.map((m) => (
                <div
                  key={`${m.name}-${m.field}`}
                  className="liquid-glass rounded-full pl-1.5 pr-4 py-1.5 flex items-center gap-2.5"
                >
                  <Avatar
                    name={m.name}
                    avatarUrl={m.avatarUrl}
                    gradient={m.avatarGradient}
                    className="w-7 h-7 text-[11px]"
                  />
                  <span className="text-xs">
                    <span className="text-white font-medium">{m.name}</span>
                    <span className="text-white/60 ml-1.5">{m.field}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-12">
            {isOwner ? (
              <div className="flex gap-2.5">
                <button
                  onClick={() => navigate(`/projects/${project.id}/edit`)}
                  className="h-12 px-5 rounded-full border border-white/15 text-white/80 text-sm font-medium hover:bg-white/5 hover:text-white transition-colors inline-flex items-center gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  수정
                </button>
                <button
                  onClick={() => navigate(`/projects/${project.id}/applicants`)}
                  className="flex-1 h-12 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 active:scale-[0.99] transition-all"
                >
                  지원자 관리
                </button>
              </div>
            ) : myApplication ? (
              /* 이미 지원함 — 상태 배너 + 취소 */
              <div className="liquid-glass rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">
                    {myApplication.field} 지원
                  </span>
                  {myApplication.status === 'accepted' ? (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-[#00C471]/40 text-[#7ee8b2] bg-[#00C471]/10">
                      ✓ 수락됨
                    </span>
                  ) : myApplication.status === 'rejected' ? (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-white/10 text-white/60">
                      거절됨
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-[#FFB020]/40 text-[#ffd27d] bg-[#FFB020]/10">
                      대기중
                    </span>
                  )}
                </div>
                <p className="mt-2.5 text-sm text-white/70 leading-[1.6] bg-white/[0.04] rounded-xl px-4 py-3">
                  “{myApplication.message}”
                </p>
                {myApplication.status === 'pending' && (
                  <button
                    onClick={cancelApplication}
                    className="mt-3 w-full h-11 rounded-full border border-white/15 text-white/70 text-sm font-medium hover:bg-white/5 hover:text-white transition-colors"
                  >
                    지원 취소하기
                  </button>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={() => canApply && setMode('apply')}
                  disabled={!canApply}
                  className={`w-full h-12 rounded-full text-sm font-semibold transition-all ${
                    canApply
                      ? 'bg-white text-black hover:bg-white/90 active:scale-[0.99]'
                      : 'bg-white/10 text-white/50 cursor-not-allowed'
                  }`}
                >
                  {project.confirmed
                    ? '팀이 확정된 프로젝트예요'
                    : project.status === 'PENDING'
                      ? '코치 승인 대기 중인 프로젝트예요'
                      : project.closed
                        ? '모집이 마감된 프로젝트예요'
                        : '지원하기'}
                </button>
                {canApply && (
                  <p className="mt-3 text-center text-xs text-white/60">
                    지원하면 내 분야 · 스킬 프로필이 오너에게 공유돼요
                  </p>
                )}
              </>
            )}
            {submitError && <p className="mt-3 text-center text-xs text-[#F04452]">{submitError}</p>}
          </div>
        </motion.div>
      )}

      {/* ---------------- APPLY ---------------- */}
      {mode === 'apply' && (
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease: easeOut }}
          className="project-page-surface project-form-surface flex flex-col max-w-lg w-full mx-auto px-6 pb-16"
        >
          <button
            onClick={() => setMode('view')}
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors self-start"
          >
            <ArrowLeft className="w-4 h-4" />
            {project.title}
          </button>

          <h1 className="mt-6 text-3xl font-semibold tracking-tight leading-[1.25]">
            함께할 준비,
            <br />
            됐나요?
          </h1>

          {/* 지원 분야 */}
          <div className="mt-8">
            <span className="text-sm font-medium text-white/80">지원 분야</span>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {openSlots.map((s) => {
                const on = applyField === s.field;
                return (
                  <button
                    key={s.field}
                    onClick={() => setApplyField(s.field)}
                    className={`px-4 py-2.5 rounded-full border text-sm font-medium transition-all active:scale-[0.97] tabular-nums ${
                      on
                        ? 'bg-white text-black border-white'
                        : 'bg-white/[0.03] text-white/70 border-white/10 hover:border-white/25 hover:text-white'
                    }`}
                  >
                    {on && <Check className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" strokeWidth={3} />}
                    {s.field} · {s.capacity - s.confirmed}자리
                  </button>
                );
              })}
            </div>
          </div>

          {/* 한 줄 각오 */}
          <label className="mt-7 block">
            <span className="text-sm font-medium text-white/80">한 줄 각오</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="예) REST API 설계 경험이 있어요. 함께 성장하고 싶습니다!"
              rows={3}
              className="mt-2.5 w-full rounded-2xl bg-white/[0.04] border border-white/10 px-5 py-4 text-sm text-white placeholder:text-white/50 outline-none focus:border-[#3182F6] focus:bg-white/[0.06] transition-colors resize-none leading-[1.6]"
            />
            <div className="mt-2 flex justify-between text-xs">
              <span className={message.trim().length > 100 ? 'text-[#F04452]' : 'text-white/50'}>
                {message.trim().length > 100 ? '100자 이내로 적어 주세요' : '오너에게 전달되는 메시지예요'}
              </span>
              <span className="text-white/50 tabular-nums">{message.trim().length}/100</span>
            </div>
          </label>

          {/* 함께 공유되는 프로필 */}
          {user && (
            <div className="mt-7">
              <span className="text-sm font-medium text-white/80">함께 공유되는 프로필</span>
              <div className="liquid-glass rounded-2xl p-4 mt-2.5 flex items-center gap-3">
                <Avatar
                  name={user.crewName}
                  avatarUrl={user.avatarUrl}
                  gradient={user.avatarGradient}
                  className="w-10 h-10 text-sm"
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">
                    {user.crewName}
                    <span className="text-white/60 font-normal ml-2 text-xs">{user.fields.join(' · ')}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {user.skills.map((s) => (
                      <span
                        key={s}
                        className="text-[10px] text-white/60 px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.03]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {submitError && <p className="mt-4 text-xs text-[#F04452]">{submitError}</p>}

          <button
            onClick={submitApplication}
            disabled={!canSubmit}
            className={`mt-9 h-12 rounded-full text-sm font-semibold transition-all ${
              canSubmit
                ? 'bg-white text-black hover:bg-white/90 active:scale-[0.99]'
                : 'bg-white/10 text-white/50 cursor-not-allowed'
            }`}
          >
            {submitting ? '지원하는 중…' : '지원 완료하기'}
          </button>
        </motion.div>
      )}

    </div>
  );
}
