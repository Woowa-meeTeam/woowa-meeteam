import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Check, RotateCcw, ShieldCheck, Users, X } from 'lucide-react';
import { Avatar, CoverFill, HomeLogo } from './primitives';
import { api, ApiError, FEEDBACK_KIND_LABEL } from '../api';
import type { Application, Feedback, Project, User } from '../api';

const easeOut = [0.22, 1, 0.36, 1] as const;

type Stats = { crews: number; projects: number; recruiting: number; pending: number; feedbacks: number };

export default function Admin() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pending, setPending] = useState<Project[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationFilter, setApplicationFilter] = useState<'ACTIVE' | 'ALL'>('ACTIVE');
  const [filter, setFilter] = useState<'OPEN' | 'ALL'>('OPEN');
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api
      .me()
      .then(async (me) => {
        // 관리자가 아니면 페이지의 존재조차 드러내지 않고 홈으로 돌려보냅니다.
        // (실제 데이터 보호는 RLS 가 담당 — UI 를 조작해도 조회되지 않습니다)
        if (!me.isAdmin) {
          navigate('/', { replace: true });
          return;
        }
        setUser(me);
        const [s, p, f, a] = await Promise.all([
          api.adminStats(),
          api.pendingProjects(),
          api.feedbacks(),
          api.adminApplications(),
        ]);
        setStats(s);
        setPending(p);
        setFeedbacks(f);
        setApplications(a);
        setReady(true);
      })
      .catch(() => navigate('/', { replace: true }));
  }, [navigate]);

  const review = async (project: Project, approve: boolean) => {
    setError(null);
    try {
      await api.approveProject(project.id, approve);
      setPending((prev) => prev.filter((p) => p.id !== project.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '처리에 실패했어요');
    }
  };

  const toggleStatus = async (f: Feedback) => {
    const next = f.status === 'OPEN' ? 'DONE' : 'OPEN';
    setError(null);
    try {
      await api.setFeedbackStatus(f.id, next);
      setFeedbacks((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: next } : x)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '변경에 실패했어요');
    }
  };

  // 관리자 확인 전 · 비관리자(리다이렉트 중)에는 아무것도 렌더하지 않습니다
  if (!ready || !user?.isAdmin) {
    return (
      <div className="relative z-20 min-h-screen grid place-items-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  const shown = feedbacks.filter((f) => (filter === 'OPEN' ? f.status === 'OPEN' : true));
  const openCount = feedbacks.filter((f) => f.status === 'OPEN').length;
  const shownApplications = applications.filter((a) =>
    applicationFilter === 'ACTIVE' ? a.status !== 'canceled' : true,
  );
  const activeApplicationCount = applications.filter((a) => a.status !== 'canceled').length;
  const applicationGroups = Array.from(
    shownApplications.reduce((groups, application) => {
      const group = groups.get(application.projectId) ?? [];
      group.push(application);
      groups.set(application.projectId, group);
      return groups;
    }, new Map<string, Application[]>()),
  );

  return (
    <div className="relative z-20 min-h-screen flex flex-col">
      <div className="max-w-6xl w-full mx-auto px-6 py-5 flex items-center justify-between">
        <HomeLogo />
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/booths/admin')}
            className="h-10 px-4 rounded-full border border-white/10 bg-white/5 text-sm text-[#7db4ff] hover:bg-white/10 transition-colors"
          >
            부스 관리
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="홈으로"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut }}
        className="flex-1 max-w-3xl w-full mx-auto px-6 pb-20"
      >
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />홈
        </button>

        <div className="mt-6 flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-[#7db4ff]" />
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">관리자</h1>
        </div>
        <p className="mt-2 text-sm text-white/70">서비스 현황과 크루들이 보낸 의견을 확인해요</p>

        {/* 집계 */}
        {stats && (
          <div className="mt-7 grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: '크루', value: stats.crews },
              { label: '전체 프로젝트', value: stats.projects },
              { label: '승인 대기', value: stats.pending, hot: stats.pending > 0 },
              { label: '모집중', value: stats.recruiting },
              { label: '받은 의견', value: stats.feedbacks },
            ].map((s) => (
              <div key={s.label} className="liquid-glass rounded-2xl px-5 py-4">
                <div className="text-xs text-white/60">{s.label}</div>
                <div
                  className={`mt-1.5 text-2xl font-bold tabular-nums ${
                    s.hot ? 'text-[#ffd27d]' : 'text-white'
                  }`}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 승인 대기 프로젝트 */}
        <h2 className="mt-10 text-sm font-semibold text-white/80">
          승인 대기 프로젝트 <span className="text-white/60 font-normal">{pending.length}건</span>
        </h2>
        <div className="mt-4 space-y-3">
          {pending.length === 0 && (
            <p className="text-sm text-white/60 py-10 text-center border border-dashed border-white/10 rounded-2xl">
              승인 대기 중인 프로젝트가 없어요
            </p>
          )}
          {pending.map((p) => (
            <div key={p.id} className="liquid-glass rounded-2xl overflow-hidden">
              <div className="flex gap-4 p-4">
                <div className="relative w-28 h-20 rounded-xl overflow-hidden flex-shrink-0">
                  <CoverFill cover={p.coverImage} fade={false} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/projects/${p.id}`)}
                      className="text-sm font-semibold text-white hover:text-[#7db4ff] transition-colors truncate"
                    >
                      {p.title}
                    </button>
                    {p.status === 'REJECTED' && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-white/10 text-white/60">
                        반려됨
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-white/70 leading-[1.5] line-clamp-2">{p.desc}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Avatar
                      name={p.owner?.name}
                      avatarUrl={p.owner?.avatarUrl}
                      gradient={p.owner?.avatarGradient}
                      className="w-4 h-4 text-[8px]"
                    />
                    <span className="text-[11px] text-white/60">{p.owner?.name}</span>
                  </div>
                </div>
              </div>
              <div className="flex border-t border-white/10">
                <button
                  onClick={() => review(p, false)}
                  className="flex-1 py-3 text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                >
                  반려
                </button>
                <div className="w-px bg-white/10" />
                <button
                  onClick={() => review(p, true)}
                  className="flex-[2] py-3 text-xs font-semibold text-[#7ee8b2] hover:bg-[#00C471]/10 transition-colors"
                >
                  승인하고 게시
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 전체 지원 내역 */}
        <div className="mt-10 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white/80">
            <Users className="w-4 h-4 text-[#7db4ff]" />
            전체 지원 내역 <span className="text-white/60 font-normal">{shownApplications.length}건</span>
          </h2>
          <div className="flex gap-1 bg-white/[0.04] border border-white/10 rounded-full p-1">
            {(['ACTIVE', 'ALL'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setApplicationFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  applicationFilter === f ? 'bg-white text-black' : 'text-white/70 hover:text-white'
                }`}
              >
                {f === 'ACTIVE' ? `유효 ${activeApplicationCount}` : '전체'}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {applicationGroups.length === 0 && (
            <p className="text-sm text-white/60 py-10 text-center border border-dashed border-white/10 rounded-2xl">
              지원 내역이 없어요
            </p>
          )}
          {applicationGroups.map(([projectId, projectApplications]) => (
            <div key={projectId} className="liquid-glass rounded-2xl overflow-hidden">
              <div className="px-4 py-3.5 flex items-center justify-between gap-3 border-b border-white/10">
                <button
                  onClick={() => navigate(`/projects/${projectId}`)}
                  className="min-w-0 text-left text-sm font-semibold text-white hover:text-[#9dc5ff] transition-colors truncate"
                >
                  {projectApplications[0].projectTitle || '삭제된 프로젝트'}
                </button>
                <span className="flex-shrink-0 text-xs text-white/60">
                  {projectApplications.length}명 지원
                </span>
              </div>
              <div className="divide-y divide-white/10">
                {projectApplications.map((a) => {
                  const statusLabel = {
                    pending: '검토 중',
                    accepted: '수락됨',
                    rejected: '거절됨',
                    canceled: '취소됨',
                  }[a.status];
                  const statusClass = {
                    pending: 'text-[#ffd27d] border-[#FFB020]/40 bg-[#FFB020]/10',
                    accepted: 'text-[#7ee8b2] border-[#00C471]/40 bg-[#00C471]/10',
                    rejected: 'text-white/60 border-white/15 bg-white/5',
                    canceled: 'text-white/40 border-white/10 bg-white/[0.03]',
                  }[a.status];
                  return (
                    <div
                      key={a.id}
                      className={`px-4 py-3 flex items-center gap-3 ${a.status === 'canceled' ? 'opacity-55' : ''}`}
                    >
                      <Avatar
                        name={a.applicant?.name}
                        avatarUrl={a.applicant?.avatarUrl}
                        gradient={a.applicant?.avatarGradient}
                        className="w-8 h-8 text-[11px] flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-white">
                          {a.applicant?.name ?? '탈퇴한 크루'}
                          <span className="ml-2 text-[11px] font-normal text-white/55">{a.field}</span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-white/45">
                          {a.createdAt ? new Date(a.createdAt).toLocaleDateString('ko-KR') : '날짜 미상'}
                        </div>
                        <p className="mt-2 text-xs text-white/70 leading-[1.55] whitespace-pre-line bg-white/[0.04] rounded-lg px-3 py-2">
                          {a.message}
                        </p>
                      </div>
                      <span className={`flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 제보 목록 */}
        <div className="mt-10 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/80">
            크루 의견 <span className="text-white/60 font-normal">{shown.length}건</span>
          </h2>
          <div className="flex gap-1 bg-white/[0.04] border border-white/10 rounded-full p-1">
            {(['OPEN', 'ALL'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filter === f ? 'bg-white text-black' : 'text-white/70 hover:text-white'
                }`}
              >
                {f === 'OPEN' ? `미처리 ${openCount}` : '전체'}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="mt-4 text-xs text-[#F04452]">{error}</p>}

        <div className="mt-4 space-y-3">
          {shown.length === 0 && (
            <p className="text-sm text-white/60 py-12 text-center border border-dashed border-white/10 rounded-2xl">
              {filter === 'OPEN' ? '미처리 의견이 없어요 👏' : '아직 받은 의견이 없어요'}
            </p>
          )}
          {shown.map((f) => (
            <div
              key={f.id}
              className={`liquid-glass rounded-2xl p-5 ${f.status === 'DONE' ? 'opacity-55' : ''}`}
            >
              <div className="flex items-center gap-3">
                <Avatar
                  name={f.author?.name}
                  avatarUrl={f.author?.avatarUrl}
                  gradient={f.author?.avatarGradient}
                  className="w-9 h-9 text-xs"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white">
                    {f.author?.name ?? '탈퇴한 크루'}
                    <span className="ml-2 text-[11px] font-medium px-2 py-0.5 rounded-full border border-[#3182F6]/40 text-[#7db4ff] bg-[#3182F6]/10">
                      {FEEDBACK_KIND_LABEL[f.kind]}
                    </span>
                  </div>
                  <div className="text-[11px] text-white/55 mt-0.5">
                    {new Date(f.createdAt).toLocaleString('ko-KR', {
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <button
                  onClick={() => toggleStatus(f)}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full transition-all ${
                    f.status === 'OPEN'
                      ? 'bg-[#00C471] text-white hover:bg-[#00b368]'
                      : 'border border-white/15 text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {f.status === 'OPEN' ? (
                    <>
                      <Check className="w-3.5 h-3.5" strokeWidth={3} />
                      처리 완료
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      되돌리기
                    </>
                  )}
                </button>
              </div>
              <p className="mt-3.5 text-sm text-white/75 leading-[1.65] whitespace-pre-line bg-white/[0.04] rounded-xl px-4 py-3">
                {f.message}
              </p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
