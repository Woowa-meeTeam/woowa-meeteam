import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Pencil, ShieldCheck, Users } from 'lucide-react';
import { Avatar, CoverFill, GithubLink } from './primitives';
import ProjectCard from './ProjectCard';
import ProjectSlots from './ProjectSlots';
import { FieldTag } from './FieldFilters';
import { api } from '../api';
import type { Application, ApplicationStatus, Project, ProjectStatus, User } from '../api';

const easeOut = [0.22, 1, 0.36, 1] as const;

type Tab = 'owned' | 'applied' | 'teams' | 'liked' | 'bookmarked';

/** 내 지원이 어떻게 됐는지 — 취소한 건은 목록에 오지 않아 배지도 없습니다 */
type AppliedBadgeKey = Exclude<ApplicationStatus, 'canceled'>;

const APPLIED_BADGE: Record<AppliedBadgeKey, { label: string; cls: string }> = {
  pending: { label: '대기중', cls: 'project-card__applied--pending' },
  accepted: { label: '✓ 수락됨', cls: 'project-card__applied--accepted' },
  rejected: { label: '거절됨', cls: 'project-card__applied--rejected' },
};

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
  // 지원 목록엔 제목·오너 이름만 담겨 있어서, 카드가 필요로 하는 나머지는
  // 이미 불러온 전체 목록에서 같은 프로젝트를 찾아 씁니다.
  const appliedProjects = applications
    .map((a) => projects.find((p) => p.id === a.projectId))
    .filter((p): p is Project => p != null);
  const appliedStatus = new Map(applications.map((a) => [a.projectId, a.status]));

  return (
    <div className="relative z-20 min-h-screen flex flex-col">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut }}
        className="flex-1 max-w-6xl w-full mx-auto px-5 sm:px-6 pb-16"
      >
        <h1 className="page-title">마이페이지</h1>

        <section className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
          <div className="order-last lg:order-first">
            <div className="flex items-center gap-5">
              <h2 className="shrink-0 text-sm font-semibold tracking-[0.18em] text-white/75">
                기술 스택
              </h2>
              <span className="h-px flex-1 bg-white/15" aria-hidden="true" />
            </div>

            {user.skills.length > 0 ? (
              <div className="mt-5 grid grid-cols-2 border-y border-white/15 sm:grid-cols-3">
                {user.skills.map((skill, index) => (
                  <div
                    key={skill}
                    className="min-h-24 border-b border-r border-white/10 p-5 last:border-b-0 sm:[&:nth-last-child(-n+3)]:border-b-0"
                  >
                    <span className="text-[10px] font-medium tracking-[0.18em] text-[#7db4ff]/70">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <p className="mt-2 text-base font-medium text-white/90">{skill}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 border-y border-white/15 py-10 text-sm text-white/45">
                등록된 기술 스택이 없어요.
              </p>
            )}
          </div>

          <aside className="order-first flex flex-col items-center text-center lg:order-last lg:border-l lg:border-white/10 lg:pl-16">
            <Avatar
              name={user.crewName}
              avatarUrl={user.avatarUrl}
              gradient={user.avatarGradient}
              className="h-36 w-36 text-3xl ring-1 ring-white/20"
            />
            <h2 className="mt-6 text-2xl font-semibold tracking-tight">{user.crewName}</h2>
            {user.fields.length > 0 ? (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {user.fields.map((field) => (
                  <FieldTag key={field} field={field} />
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-white/45">분야 미설정</p>
            )}
            <GithubLink login={user.githubLogin} className="mt-5" />
            {user.bio && (
              <p className="mt-5 max-w-xs whitespace-pre-line text-sm leading-6 text-white/50">
                {user.bio}
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {user.isAdmin && (
                <button
                  onClick={() => navigate('/admin')}
                  className="inline-flex items-center gap-1.5 border-b border-[#3182F6]/50 px-1 py-2 text-xs font-medium text-[#7db4ff] transition-colors hover:border-[#7db4ff] hover:text-[#a9cbff]"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  관리자
                </button>
              )}
              <button
                onClick={() => navigate('/profile/edit')}
                className="inline-flex items-center gap-1.5 border-b border-white/20 px-1 py-2 text-xs font-medium text-white/60 transition-colors hover:border-white/50 hover:text-white"
              >
                <Pencil className="h-3.5 w-3.5" />
                프로필 수정
              </button>
            </div>
          </aside>
        </section>

        <div className="mt-14 w-full border-y border-white/10">
          <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="inline-flex min-w-max sm:flex sm:w-full sm:min-w-0">
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
                className={`relative px-5 py-5 text-sm font-medium transition-colors sm:flex-1 sm:px-3 sm:text-center ${
                  tab === item.key ? 'text-[#7db4ff]' : 'text-white/55 hover:text-white'
                }`}
              >
                {item.label}{' '}
                <span className="ml-1 text-xs opacity-50 tabular-nums">{item.count}</span>
                {/* 밑줄 하나를 layoutId 로 공유해, 탭을 옮길 때 그 자리로 미끄러집니다 */}
                {tab === item.key && (
                  <motion.span
                    layoutId="mypage-tab-indicator"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-[#7db4ff]"
                    transition={{ duration: 0.32, ease: easeOut }}
                  />
                )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 모든 프로젝트 탭은 북마크 탭과 같은 공용 카드 그리드를 사용합니다. */}
        {tab === 'owned' && (
          <div className="project-card-grid mt-8">
            {ownedProjects.length === 0 && (
              <p className="border-y border-white/10 py-14 text-center text-sm text-white/50">
                아직 등록한 프로젝트가 없어요
              </p>
            )}
            {ownedProjects.map((p) => (
              <div key={p.id} className="project-card min-h-[438px] p-5">
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
                <ProjectSlots slots={p.slots} />
                <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
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
          <>
            <ReactionProjectList
              projects={appliedProjects}
              emptyMessage="아직 지원한 프로젝트가 없어요"
              navigate={navigate}
              badgeFor={(p) => {
                // 상태 문자열은 서버 값을 그대로 소문자로 바꾼 것이라 확인 없이 믿으면 안 됩니다.
                // 모르는 값이 오면 배지만 접고 목록은 그대로 보여 줍니다.
                const status = appliedStatus.get(p.id);
                const badge = status && APPLIED_BADGE[status as AppliedBadgeKey];
                if (!badge) return null;
                return <span className={`project-card__applied ${badge.cls}`}>{badge.label}</span>;
              }}
            />
            {appliedProjects.length > 0 && (
              <p className="pt-4 text-center text-xs text-white/55">
                수락되면 팀 멤버로 확정되고, 대기 중에는 지원을 취소할 수 있어요
              </p>
            )}
          </>
        )}

        {/* 나의 팀 (확정된 팀) */}
        {tab === 'teams' && (
          <div className="project-card-grid mt-8">
            {teams.length === 0 && (
              <p className="border-y border-white/10 py-14 text-center text-sm text-white/50">
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
                className="project-card min-h-[438px] w-full overflow-hidden hover:-translate-y-0.5 transition-transform"
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

/** 좋아요 · 북마크 · 지원 — 탐색 화면과 같은 카드를 그대로 씁니다 */
function ReactionProjectList({
  projects,
  emptyMessage,
  navigate,
  badgeFor,
}: {
  projects: Project[];
  emptyMessage: string;
  navigate: ReturnType<typeof useNavigate>;
  /** 카드마다 모집 상태 아래에 덧붙일 배지 */
  badgeFor?: (project: Project) => ReactNode;
}) {
  if (projects.length === 0) {
    return (
    <p className="mt-8 w-full border-y border-white/10 py-14 text-center text-sm text-white/50">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="project-card-grid mt-8">
      {projects.map((p, i) => (
        <ProjectCard
          key={p.id}
          project={p}
          index={i}
          onClick={() => navigate(`/projects/${p.id}`)}
          badge={badgeFor?.(p)}
        />
      ))}
    </div>
  );
}
