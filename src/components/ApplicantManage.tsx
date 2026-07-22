import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Check, Users, X } from 'lucide-react';
import { LogoMark } from './primitives';
import { api, ApiError } from '../api';
import type { Application, Project } from '../api';

const easeOut = [0.22, 1, 0.36, 1] as const;

export default function ApplicantManage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    api
      .projectApplications(id)
      .then(({ project, applications }) => {
        setProject(project);
        setApplications(applications);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const setStatus = async (appId: string, status: 'accepted' | 'rejected' | 'pending') => {
    setActionError(null);
    try {
      // 수락/거절은 서버가 정원을 검증하고, 갱신된 프로젝트 현황을 돌려줘요 (FR-MEM-05)
      const { application, project: updated } = await api.setApplicationStatus(appId, status);
      setApplications((prev) => prev.map((a) => (a.id === appId ? application : a)));
      setProject(updated);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : '처리에 실패했어요');
    }
  };

  if (error) {
    return (
      <div className="relative z-20 min-h-screen flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm text-white/50">{error}</p>
        <button onClick={() => navigate('/my')} className="text-sm text-[#7db4ff] hover:underline">
          마이페이지로 돌아가기
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

  const isFull = (field: string) => {
    const slot = project.slots.find((s) => s.field === field);
    return slot ? slot.confirmed >= slot.capacity : true;
  };

  const pending = applications.filter((a) => a.status === 'pending');
  const decided = applications.filter((a) => a.status === 'accepted' || a.status === 'rejected');
  const accepted = applications.filter((a) => a.status === 'accepted');
  const allFull = project.slots.every((s) => s.confirmed >= s.capacity);

  return (
    <div className="relative z-20 min-h-screen flex flex-col">
      {/* top bar */}
      <div className="max-w-6xl w-full mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <LogoMark className="w-7 h-7" />
          <span className="text-[17px] font-bold tracking-tight">meeTeam</span>
        </div>
        <button
          onClick={() => navigate('/my')}
          className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="마이페이지로 돌아가기"
        >
          <X className="w-[18px] h-[18px]" />
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut }}
        className="flex-1 max-w-2xl w-full mx-auto px-6 pb-16"
      >
        <button
          onClick={() => navigate('/my')}
          className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          마이페이지
        </button>

        <h1 className="mt-6 text-3xl md:text-4xl font-semibold tracking-tight leading-[1.2]">
          지원자 관리
        </h1>
        <p className="mt-2 text-sm text-white/50">{project.title}</p>

        {/* 분야별 확정 현황 */}
        <div className="liquid-glass rounded-2xl p-5 mt-7">
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            {project.slots.map((s) => {
              const full = s.confirmed >= s.capacity;
              return (
                <div key={s.field}>
                  <div className="text-xs text-white/40">{s.field}</div>
                  <div className="mt-1 text-xl font-bold tabular-nums">
                    <span className={full ? 'text-[#7ee8b2]' : 'text-white'}>{s.confirmed}</span>
                    <span className="text-white/25"> / {s.capacity}</span>
                    {full && <span className="ml-2 text-[11px] font-semibold text-[#7ee8b2]">정원 완료</span>}
                  </div>
                </div>
              );
            })}
            <div className="ml-auto self-center">
              {allFull ? (
                <span className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-[#00C471]/40 text-[#7ee8b2] bg-[#00C471]/10">
                  ✓ 팀 구성 완료 · 모집 자동 마감
                </span>
              ) : (
                <span className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-[#3182F6]/40 text-[#7db4ff] bg-[#3182F6]/10">
                  ● 모집중 · {project.dday}
                </span>
              )}
            </div>
          </div>
        </div>

        {actionError && <p className="mt-4 text-xs text-[#F04452]">{actionError}</p>}

        {/* 대기 중 지원자 */}
        <h2 className="mt-9 text-sm font-semibold text-white/80">
          대기 중 <span className="text-white/40 font-normal">{pending.length}명</span>
        </h2>
        <div className="mt-4 space-y-3">
          {pending.length === 0 && (
            <p className="text-sm text-white/40 py-6 text-center border border-dashed border-white/10 rounded-2xl">
              대기 중인 지원자가 없어요
            </p>
          )}
          {pending.map((a) => {
            const full = isFull(a.field);
            return (
              <div key={a.id} className="liquid-glass rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-10 h-10 rounded-full bg-gradient-to-br ${a.applicant?.avatarGradient} flex items-center justify-center text-sm font-semibold text-white flex-shrink-0`}
                  >
                    {a.applicant?.name.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white">
                      {a.applicant?.name}
                      <span className="ml-2 text-xs font-normal text-[#7db4ff]">{a.field} 지원</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {a.applicant?.skills.map((s) => (
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

                <p className="mt-3.5 text-sm text-white/70 leading-[1.6] bg-white/[0.04] rounded-xl px-4 py-3">
                  “{a.message}”
                </p>

                <div className="mt-4 flex items-center gap-2.5">
                  <button
                    onClick={() => setStatus(a.id, 'rejected')}
                    className="flex-1 h-11 rounded-full border border-white/15 text-white/70 text-sm font-medium hover:bg-white/5 hover:text-white transition-colors"
                  >
                    거절
                  </button>
                  <button
                    onClick={() => !full && setStatus(a.id, 'accepted')}
                    disabled={full}
                    className={`flex-[1.6] h-11 rounded-full text-sm font-semibold transition-all ${
                      full
                        ? 'bg-white/10 text-white/30 cursor-not-allowed'
                        : 'bg-[#00C471] text-white hover:bg-[#00b368] active:scale-[0.99]'
                    }`}
                  >
                    {full ? `${a.field} 정원 마감` : '수락'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 처리 완료 */}
        {decided.length > 0 && (
          <>
            <h2 className="mt-9 text-sm font-semibold text-white/80">
              처리 완료 <span className="text-white/40 font-normal">{decided.length}명</span>
            </h2>
            <div className="mt-4 space-y-2.5">
              {decided.map((a) => (
                <div
                  key={a.id}
                  className={`liquid-glass rounded-2xl px-5 py-3.5 flex items-center gap-3 ${
                    a.status === 'rejected' ? 'opacity-50' : ''
                  }`}
                >
                  <span
                    className={`w-8 h-8 rounded-full bg-gradient-to-br ${a.applicant?.avatarGradient} flex items-center justify-center text-xs font-semibold text-white`}
                  >
                    {a.applicant?.name.slice(0, 1)}
                  </span>
                  <div className="flex-1 text-sm">
                    <span className="font-medium text-white">{a.applicant?.name}</span>
                    <span className="text-white/40 ml-2 text-xs">{a.field}</span>
                  </div>
                  {a.status === 'accepted' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-[#00C471]/40 text-[#7ee8b2] bg-[#00C471]/10">
                      <Check className="w-3 h-3" strokeWidth={3} />
                      수락됨
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-white/10 text-white/40">
                      거절됨
                    </span>
                  )}
                  <button
                    onClick={() => setStatus(a.id, 'pending')}
                    className="text-[11px] text-white/40 hover:text-white transition-colors"
                  >
                    되돌리기
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 확정 멤버 */}
        {accepted.length > 0 && (
          <div className="mt-9">
            <h2 className="text-sm font-semibold text-white/80 inline-flex items-center gap-1.5">
              <Users className="w-4 h-4 text-white/40" />
              확정된 팀 멤버 {project.members.length}명
            </h2>
            <div className="mt-3.5 flex flex-wrap gap-2.5">
              {project.members.map((m, i) => (
                <div
                  key={`${m.name}-${i}`}
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
        )}
      </motion.div>
    </div>
  );
}
