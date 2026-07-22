import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  Link as LinkIcon,
  Users,
  X,
} from 'lucide-react';
import { Avatar, CoverFill, LogoMark } from './primitives';
import { api, ApiError } from '../api';
import type { Application, Project, User } from '../api';

const easeOut = [0.22, 1, 0.36, 1] as const;

type Mode = 'view' | 'apply' | 'done';

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
        if (mine) setMode('done');
      })
      .catch((e) => setLoadError(e.message));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loadError) {
    return (
      <div className="relative z-20 min-h-screen flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm text-white/50">{loadError}</p>
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
      setMode('done');
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
    <div className="relative z-20 min-h-screen flex flex-col">
      {/* top bar */}
      <div className="max-w-6xl w-full mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <LogoMark className="w-7 h-7" />
          <span className="text-[17px] font-bold tracking-tight">meeTeam</span>
        </div>
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
          className="flex-1 max-w-2xl w-full mx-auto px-6 pb-16"
        >
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            프로젝트 목록
          </button>

          {/* 대표 이미지 히어로 — 아래로 배경에 녹아듦 */}
          <div className="relative mt-5 h-48 md:h-56 rounded-3xl overflow-hidden">
            <CoverFill cover={project.coverImage} />
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-md border ${
                  project.closed
                    ? 'border-white/15 text-white/70 bg-black/30'
                    : 'border-[#3182F6]/40 text-[#cfe4ff] bg-[#3182F6]/25'
                }`}
              >
                {project.closed ? '모집 마감' : '● 모집중'}
              </span>
              {!project.closed && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#A4F4FD] tabular-nums px-2.5 py-1 rounded-full backdrop-blur-md bg-black/30">
                  <Clock3 className="w-3 h-3" />
                  마감까지 {project.dday}
                </span>
              )}
            </div>
          </div>

          <h1 className="mt-5 text-3xl md:text-4xl font-semibold tracking-tight leading-[1.2]">
            {project.title}
          </h1>

          <div className="mt-5 flex items-center gap-3">
            <Avatar
              name={project.owner?.name}
              avatarUrl={project.owner?.avatarUrl}
              gradient={project.owner?.avatarGradient}
              className="w-9 h-9 text-xs"
            />
            <div>
              <div className="text-sm font-semibold text-white">{project.owner?.name}</div>
              <div className="text-xs text-white/50">{project.owner?.field} · 프로젝트 오너</div>
            </div>
          </div>

          {/* 설명 */}
          <div className="mt-8 space-y-4 text-[15px] text-white/70 leading-[1.7]">
            {project.longDesc.map((p) => (
              <p key={p.slice(0, 20)}>{p}</p>
            ))}
          </div>

          {/* 일정 · 프로토타입 */}
          <div className="mt-8 grid sm:grid-cols-2 gap-3">
            <div className="liquid-glass rounded-2xl px-5 py-4 flex items-center gap-3">
              <CalendarDays className="w-4 h-4 text-white/40 flex-shrink-0" />
              <div>
                <div className="text-[11px] text-white/40">모임 일정</div>
                <div className="text-sm text-white/80 mt-0.5">{project.schedule}</div>
              </div>
            </div>
            {project.prototype ? (
              <div className="liquid-glass rounded-2xl px-5 py-4 flex items-center gap-3">
                <LinkIcon className="w-4 h-4 text-white/40 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] text-white/40">프로토타입</div>
                  <div className="text-sm text-[#7db4ff] mt-0.5 truncate">{project.prototype}</div>
                </div>
              </div>
            ) : (
              <div className="liquid-glass rounded-2xl px-5 py-4 flex items-center gap-3 opacity-60">
                <LinkIcon className="w-4 h-4 text-white/40 flex-shrink-0" />
                <div>
                  <div className="text-[11px] text-white/40">프로토타입</div>
                  <div className="text-sm text-white/50 mt-0.5">아직 없어요</div>
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
                      <span className={full ? 'text-white/40' : 'text-white/80 font-medium'}>
                        {s.field}
                        {full && <span className="ml-2 text-[11px] text-white/30">정원 마감</span>}
                      </span>
                      <span className="text-white/40 tabular-nums">
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
                  </div>
                );
              })}
            </div>
          </div>

          {/* 팀 멤버 */}
          <div className="mt-10">
            <h2 className="text-sm font-semibold text-white/80 inline-flex items-center gap-1.5">
              <Users className="w-4 h-4 text-white/40" />팀 멤버 {project.members.length}명
            </h2>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {project.members.map((m) => (
                <div
                  key={`${m.name}-${m.field}`}
                  className="liquid-glass rounded-full pl-1.5 pr-4 py-1.5 flex items-center gap-2.5"
                >
                  <span
                    className={`w-7 h-7 rounded-full bg-gradient-to-br ${m.avatarGradient} flex items-center justify-center text-[11px] font-semibold text-white`}
                  >
                    {m.name.slice(0, 1)}
                  </span>
                  <span className="text-xs">
                    <span className="text-white font-medium">{m.name}</span>
                    <span className="text-white/40 ml-1.5">{m.field}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-12">
            {isOwner ? (
              <button
                onClick={() => navigate(`/projects/${project.id}/applicants`)}
                className="w-full h-12 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 active:scale-[0.99] transition-all"
              >
                지원자 관리
              </button>
            ) : (
              <button
                onClick={() => canApply && setMode('apply')}
                disabled={!canApply}
                className={`w-full h-12 rounded-full text-sm font-semibold transition-all ${
                  canApply
                    ? 'bg-white text-black hover:bg-white/90 active:scale-[0.99]'
                    : 'bg-white/10 text-white/30 cursor-not-allowed'
                }`}
              >
                {project.closed ? '모집이 마감된 프로젝트예요' : '지원하기'}
              </button>
            )}
            {canApply && (
              <p className="mt-3 text-center text-xs text-white/40">
                지원하면 내 분야 · 스킬 프로필이 오너에게 공유돼요
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* ---------------- APPLY ---------------- */}
      {mode === 'apply' && (
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease: easeOut }}
          className="flex-1 flex flex-col max-w-lg w-full mx-auto px-6 pb-16"
        >
          <button
            onClick={() => setMode('view')}
            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors self-start"
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
              className="mt-2.5 w-full rounded-2xl bg-white/[0.04] border border-white/10 px-5 py-4 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#3182F6] focus:bg-white/[0.06] transition-colors resize-none leading-[1.6]"
            />
            <div className="mt-2 flex justify-between text-xs">
              <span className={message.trim().length > 100 ? 'text-[#F04452]' : 'text-white/30'}>
                {message.trim().length > 100 ? '100자 이내로 적어 주세요' : '오너에게 전달되는 메시지예요'}
              </span>
              <span className="text-white/30 tabular-nums">{message.trim().length}/100</span>
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
                    <span className="text-white/40 font-normal ml-2 text-xs">{user.fields.join(' · ')}</span>
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
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}
          >
            {submitting ? '지원하는 중…' : '지원 완료하기'}
          </button>
        </motion.div>
      )}

      {/* ---------------- DONE ---------------- */}
      {mode === 'done' && myApplication && (
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
            {myApplication.status === 'accepted' ? '팀 합류 확정!' : '지원 완료!'}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25, ease: easeOut }}
            className="mt-3 text-sm text-white/50"
          >
            {myApplication.status === 'accepted'
              ? `${project.owner?.name}님이 수락했어요. 팀에서 만나요!`
              : `${project.owner?.name}님이 확인하면 결과를 알려드릴게요.`}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35, ease: easeOut }}
            className="liquid-glass rounded-2xl p-5 mt-8 w-full text-left"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">{project.title}</span>
              {myApplication.status === 'accepted' ? (
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-[#00C471]/40 text-[#7ee8b2] bg-[#00C471]/10">
                  ✓ 수락됨
                </span>
              ) : myApplication.status === 'rejected' ? (
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-white/10 text-white/40">
                  거절됨
                </span>
              ) : (
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-[#FFB020]/40 text-[#ffd27d] bg-[#FFB020]/10">
                  대기중
                </span>
              )}
            </div>
            <div className="mt-3 text-xs text-white/50">
              {myApplication.field} 지원 · {user?.crewName}
            </div>
            <p className="mt-2.5 text-sm text-white/70 leading-[1.6] bg-white/[0.04] rounded-xl px-4 py-3">
              “{myApplication.message}”
            </p>
          </motion.div>

          {submitError && <p className="mt-4 text-xs text-[#F04452]">{submitError}</p>}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45, ease: easeOut }}
            className="mt-8 w-full flex flex-col gap-2.5"
          >
            <button
              onClick={() => navigate('/')}
              className="w-full h-12 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 active:scale-[0.99] transition-all"
            >
              다른 프로젝트 둘러보기
            </button>
            {myApplication.status === 'pending' && (
              <button
                onClick={cancelApplication}
                className="w-full h-12 rounded-full border border-white/15 text-white/70 text-sm font-medium hover:bg-white/5 hover:text-white transition-colors"
              >
                지원 취소하기
              </button>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
