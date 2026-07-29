import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Pencil, ShieldCheck, Users, X } from 'lucide-react';
import { Avatar, CoverFill, HomeLogo } from './primitives';
import ProjectCard from './ProjectCard';
import { FIELD_STYLES } from './FieldFilters';
import { api } from '../api';
import type { Application, Project, ProjectStatus, User } from '../api';

const easeOut = [0.22, 1, 0.36, 1] as const;

type Tab = 'owned' | 'applied' | 'teams' | 'liked' | 'bookmarked';

const STATUS_BADGE: Record<ProjectStatus, { label: string; cls: string }> = {
  PENDING: { label: '승인 대기', cls: 'border-[#FFB020]/40 text-[#ffd27d] bg-[#FFB020]/10' },
  REJECTED: { label: '반려됨', cls: 'border-white/10 text-white/60' },
  RECRUITING: { label: '● 모집중', cls: 'border-[#00C471]/50 text-[#9df0c4] bg-[#00C471]/15' },
  CLOSED: { label: '모집 마감', cls: 'border-white/15 text-white/60' },
  CONFIRMED: { label: '✓ 팀 확정', cls: 'border-[#00C471]/40 text-[#7ee8b2] bg-[#00C471]/10' },
};

export default function MyPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('owned');
  const [user, setUser] = useState<User | null>(null);
  const [ownedProjects, setOwnedProjects] = useState<Project[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [teams, setTeams] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([api.me(), api.myProjects(), api.myApplications(), api.myTeams(), api.projects()])
      .then(([me, owned, apps, myTeams, allProjects]) => {
        setUser(me);
        setOwnedProjects(owned);
        setApplications(apps);
        setTeams(myTeams);
        setProjects(allProjects);
        setLoaded(true);
      })
      .catch(() => navigate('/', { replace: true })); // 미로그인 → 랜딩으로
  }, [navigate]);

  if (!loaded || !user) {
    return (
      <div className="relative z-20 min-h-screen grid place-items-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  const likedProjects = projects.filter((project) => project.myLike);
  const bookmarkedProjects = projects.filter((project) => project.myBookmark);

  return (
    <div className="relative z-20 min-h-screen flex flex-col">
      {/* top bar */}
      <div className="max-w-6xl w-full mx-auto px-6 py-5 flex items-center justify-between">
        <HomeLogo />
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="홈으로 돌아가기"
        >
          <X className="w-[18px] h-[18px]" />
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut }}
        className="flex-1 max-w-5xl w-full mx-auto px-5 sm:px-6 pb-16"
      >
        <h1 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">마이페이지</h1>

        {/* 프로필 카드 */}
        <div className="liquid-glass rounded-2xl p-6 mt-7">
          {/* 넓은 화면에서는 버튼이 오른쪽에 붙고, 좁아지면 아래로 내려옵니다.
              모바일에서 한 줄에 다 넣으면 이름·아이디가 폭에 눌려 세로로 쌓여요. */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <Avatar
                name={user.crewName}
                avatarUrl={user.avatarUrl}
                gradient={user.avatarGradient}
                className="w-14 h-14 text-lg"
              />
              <div className="min-w-0">
                {/* 분야 태그는 이름 옆에 — 색은 크루 목록·상세와 같은 걸 씁니다 */}
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <span className="text-lg font-bold text-white">{user.crewName}</span>
                  {user.fields.map((f) => (
                    <span
                      key={f}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                        FIELD_STYLES[f]?.tag ?? 'border-white/20 text-white/70 bg-white/[0.06]'
                      }`}
                    >
                      {f}
                    </span>
                  ))}
                </div>
                <div className="mt-1 text-sm text-white/55 truncate">
                  github.com/{user.githubLogin}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 sm:flex-shrink-0">
              {user.isAdmin && (
                <button
                  onClick={() => navigate('/admin')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7db4ff] border border-[#3182F6]/40 bg-[#3182F6]/10 rounded-full px-3.5 py-2 hover:bg-[#3182F6]/20 transition-colors"
                >
                  <ShieldCheck className="w-3 h-3" />
                  관리자
                </button>
              )}
              <button
                onClick={() => navigate('/profile/edit')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-white/60 border border-white/15 rounded-full px-3.5 py-2 hover:bg-white/5 hover:text-white transition-colors"
              >
                <Pencil className="w-3 h-3" />
                프로필 수정
              </button>
            </div>
          </div>
          {user.bio && (
            <p className="mt-4 text-sm text-white/60 leading-[1.6] whitespace-pre-line">{user.bio}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {user.skills.map((s) => (
              <span
                key={s}
                className="text-[11px] text-white/70 px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.03]"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* 탭 — 아래 목록과 같은 폭으로 맞춰 가운데에 둡니다.
            모바일에서는 접지 않고 가로로 스크롤해요. */}
        <div className="mt-8 mx-auto w-full max-w-2xl">
          <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="inline-flex gap-1 bg-white/[0.04] border border-white/10 rounded-full p-1">
            {(
              [
                { key: 'owned', label: '등록한 프로젝트', count: ownedProjects.length },
                { key: 'applied', label: '지원한 프로젝트', count: applications.length },
                { key: 'teams', label: '나의 팀', count: teams.length },
                { key: 'liked', label: '좋아요', count: likedProjects.length },
                { key: 'bookmarked', label: '북마크', count: bookmarkedProjects.length },
              ] as { key: Tab; label: string; count: number }[]
            ).map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`whitespace-nowrap px-4 sm:px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                  tab === item.key ? 'bg-white text-black' : 'text-white/70 hover:text-white'
                }`}
              >
                {item.label} <span className="opacity-50 tabular-nums">{item.count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 등록한 프로젝트 — 관리용이라 카드보다 가로로 긴 줄이 읽기 좋아요.
            페이지가 넓어져도 본문 폭을 잡아 가운데로 모읍니다. */}
        {tab === 'owned' && (
          <div className="mt-5 mx-auto w-full max-w-2xl space-y-3">
            {ownedProjects.length === 0 && (
              <p className="text-sm text-white/60 py-8 text-center border border-dashed border-white/10 rounded-2xl">
                아직 등록한 프로젝트가 없어요
              </p>
            )}
            {ownedProjects.map((p) => (
              <div key={p.id} className="liquid-glass rounded-2xl p-5">
                {/* 대표 이미지 — 카드·상세와 같은 16:9 로, 어느 프로젝트인지 한눈에 */}
                <button
                  type="button"
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className="relative block w-full aspect-[16/9] rounded-xl overflow-hidden border border-white/10 mb-4"
                >
                  <CoverFill cover={p.coverImage} fade={false} />
                  {/* 밝은 커버 위에서도 읽히도록 어두운 받침을 깔고 그 위에 상태색을 올립니다 */}
                  <span className="absolute top-3 left-3 rounded-full bg-black/60 backdrop-blur-md">
                    <span
                      className={`block text-[11px] font-semibold px-2.5 py-1 rounded-full border ${STATUS_BADGE[p.status].cls}`}
                    >
                      {STATUS_BADGE[p.status].label}
                    </span>
                  </span>
                </button>
                {p.status === 'PENDING' && (
                  <p className="-mt-1 mb-2 text-[11px] text-white/60">
                    코치 승인을 기다리고 있어요
                  </p>
                )}
                <h3 className="text-base font-semibold text-white">{p.title}</h3>
                <p className="mt-1.5 text-sm text-white/70 leading-[1.5]">{p.desc}</p>
                <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-white/70 tabular-nums">
                    {p.slots.map((s) => `${s.field} ${s.confirmed}/${s.capacity}`).join(' · ')}
                  </span>
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={() => navigate(`/projects/${p.id}/edit`)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 text-white/70 text-xs font-medium px-3.5 py-2.5 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                      수정
                    </button>
                    <button
                      onClick={() => navigate(`/projects/${p.id}/applicants`)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white text-black text-xs font-semibold px-4 py-2.5 hover:bg-white/90 active:scale-[0.98] transition-all"
                    >
                      지원자 관리
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 지원한 프로젝트 */}
        {tab === 'applied' && (
          <div className="mt-5 mx-auto w-full max-w-2xl space-y-3">
            {applications.length === 0 && (
              <p className="text-sm text-white/60 py-8 text-center border border-dashed border-white/10 rounded-2xl">
                아직 지원한 프로젝트가 없어요
              </p>
            )}
            {applications.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(`/projects/${a.projectId}`)}
                className="w-full text-left liquid-glass rounded-2xl p-5 hover:-translate-y-0.5 transition-transform"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-white truncate">{a.projectTitle}</h3>
                    <p className="mt-1 text-xs text-white/70">
                      {a.field} 지원 · 오너 {a.projectOwner}
                    </p>
                  </div>
                  {a.status === 'pending' ? (
                    <span className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-[#FFB020]/40 text-[#ffd27d] bg-[#FFB020]/10">
                      대기중
                    </span>
                  ) : a.status === 'accepted' ? (
                    <span className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-[#00C471]/40 text-[#7ee8b2] bg-[#00C471]/10">
                      ✓ 수락됨
                    </span>
                  ) : (
                    <span className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-white/10 text-white/60">
                      거절됨
                    </span>
                  )}
                </div>
              </button>
            ))}
            {applications.length > 0 && (
              <p className="text-xs text-white/55 text-center pt-2">
                수락되면 팀 멤버로 확정되고, 대기 중에는 지원을 취소할 수 있어요
              </p>
            )}
          </div>
        )}

        {/* 나의 팀 (확정된 팀) */}
        {tab === 'teams' && (
          <div className="mt-5 mx-auto w-full max-w-2xl space-y-3">
            {teams.length === 0 && (
              <p className="text-sm text-white/60 py-10 text-center border border-dashed border-white/10 rounded-2xl">
                아직 확정된 팀이 없어요.
                <br />
                <span className="text-white/50 text-xs">
                  프로젝트에 지원하거나 직접 팀을 꾸려보세요.
                </span>
              </p>
            )}
            {teams.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/teams/${p.id}`)}
                className="w-full text-left liquid-glass rounded-2xl overflow-hidden hover:-translate-y-0.5 transition-transform"
              >
                <div className="relative h-24">
                  <CoverFill cover={p.coverImage} />
                  <span className="absolute top-3 left-3 text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-md border border-[#00C471]/40 text-[#7ee8b2] bg-[#00C471]/10">
                    ✓ 팀 확정
                  </span>
                  {p.owner?.id === user.id && (
                    <span className="absolute top-3 right-3 text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-md bg-black/30 text-white/70">
                      내 프로젝트
                    </span>
                  )}
                </div>
                <div className="p-5 pt-3">
                  <h3 className="text-base font-semibold text-white">{p.title}</h3>
                  <div className="mt-3 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-white/60" />
                    <div className="flex -space-x-1.5">
                      {p.members.slice(0, 6).map((m, i) => (
                        <Avatar
                          key={i}
                          name={m.name}
                          avatarUrl={m.avatarUrl}
                          gradient={m.avatarGradient}
                          className="w-6 h-6 text-[9px] ring-2 ring-[#0c0c0c]"
                        />
                      ))}
                    </div>
                    <span className="text-xs text-white/70 ml-1">{p.members.length}명</span>
                    <span className="ml-auto text-[11px] text-[#7db4ff]">팀 스페이스 →</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {tab === 'liked' && (
          <ReactionProjectList
            projects={likedProjects}
            emptyMessage="아직 좋아요한 프로젝트가 없어요"
            navigate={navigate}
          />
        )}

        {tab === 'bookmarked' && (
          <ReactionProjectList
            projects={bookmarkedProjects}
            emptyMessage="아직 북마크한 프로젝트가 없어요"
            navigate={navigate}
          />
        )}
      </motion.div>
    </div>
  );
}

/** 좋아요 · 북마크 — 탐색 화면과 같은 카드를 그대로 씁니다 */
function ReactionProjectList({
  projects,
  emptyMessage,
  navigate,
}: {
  projects: Project[];
  emptyMessage: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  if (projects.length === 0) {
    return (
      <p className="mt-5 mx-auto w-full max-w-2xl text-sm text-white/60 py-8 text-center border border-dashed border-white/10 rounded-2xl">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="project-card-grid mt-5">
      {projects.map((p, i) => (
        <ProjectCard
          key={p.id}
          project={p}
          index={i}
          onClick={() => navigate(`/projects/${p.id}`)}
        />
      ))}
    </div>
  );
}
