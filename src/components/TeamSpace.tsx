import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  FileText,
  Figma,
  Github,
  Globe,
  Link as LinkIcon,
  MessageCircle,
  Pencil,
  Plus,
  Slack,
  Trash2,
  Users,
} from 'lucide-react';
import { Avatar, CoverFill, HomeLogo } from './primitives';
import { FieldTag } from './FieldFilters';
import { api, ApiError, FIELD_SHORT, TEAM_LINK_KINDS, teamLinkLabel } from '../api';
import type { Project, TeamLink, User } from '../api';

const easeOut = [0.22, 1, 0.36, 1] as const;

/** 링크 입력이 http 없이 들어와도 열리도록 */
function toHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/** 링크 종류별 아이콘 — 목록에서 한눈에 구분되도록 */
const LINK_ICONS: Record<string, typeof Github> = {
  github: Github,
  notion: FileText,
  figma: Figma,
  slack: Slack,
  discord: MessageCircle,
  deploy: Globe,
  docs: FileText,
  etc: LinkIcon,
};

const placeholderFor = (type: string) =>
  TEAM_LINK_KINDS.find((k) => k.key === type)?.placeholder ?? 'example.com';

/**
 * 팀 스페이스 — 팀이 확정되면 그 프로젝트에 자동으로 열리는 팀 전용 페이지.
 *
 * 따로 만드는 절차가 없습니다. 확정(CONFIRMED)이 곧 개설 조건이에요.
 * "우리 팀 정보 어디 있지" 싶을 때 다시 들어올 곳이라, 공지·팀원·링크만 모아 둡니다.
 */
export default function TeamSpace() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [me, setMe] = useState<User | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingLinks, setEditingLinks] = useState(false);
  const [draftLinks, setDraftLinks] = useState<TeamLink[]>([]);
  const [editingNotice, setEditingNotice] = useState(false);
  const [draftNotice, setDraftNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.project(id), api.me().catch(() => null)])
      .then(([p, user]) => {
        setProject(p);
        setMe(user);
      })
      .catch((e) => setLoadError(e.message));
  }, [id]);

  if (loadError) {
    return (
      <div className="relative z-20 min-h-screen flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm text-white/60">{loadError}</p>
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

  // 확정 전에는 아직 팀이 없습니다. 주소를 직접 쳐서 들어온 경우.
  if (!project.confirmed) {
    return (
      <div className="relative z-20 min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-base font-semibold text-white">아직 팀이 확정되지 않았어요</p>
        <p className="text-sm text-white/60 leading-[1.7]">
          팀 스페이스는 팀이 확정되면 자동으로 열려요.
          <br />
          정원을 채우고 오너가 팀을 확정하면 여기서 만나요.
        </p>
        <button
          onClick={() => navigate(`/projects/${project.id}`)}
          className="mt-2 text-sm text-[#7db4ff] hover:underline"
        >
          프로젝트 보러 가기
        </button>
      </div>
    );
  }

  const isOwner = me?.id === project.owner?.id;
  const links = project.teamLinks;

  const startEditLinks = () => {
    // 아직 하나도 없으면 빈 줄 하나를 미리 띄워 둡니다 — 바로 고르고 붙여넣도록
    setDraftLinks(links.length > 0 ? links.map((l) => ({ ...l })) : [{ type: 'github', url: '' }]);
    setSaveError(null);
    setEditingLinks(true);
  };

  const saveLinks = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await api.saveTeamLinks(project.id, draftLinks);
      setProject(updated);
      setEditingLinks(false);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : '링크 저장에 실패했어요');
    } finally {
      setSaving(false);
    }
  };

  const saveNotice = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await api.saveTeamNotice(project.id, draftNotice);
      setProject(updated);
      setEditingNotice(false);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : '공지 저장에 실패했어요');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="project-focus-page relative z-20 min-h-screen flex flex-col">
      <div className="max-w-6xl w-full mx-auto px-6 py-5 flex items-center justify-between">
        <HomeLogo />
        <button
          onClick={() => navigate('/my')}
          className="text-sm text-white/60 hover:text-white transition-colors"
        >
          마이페이지
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut }}
        className="flex-1 w-full max-w-2xl mx-auto px-5 sm:px-6 pb-16"
      >
        <button
          onClick={() => navigate(`/projects/${project.id}`)}
          className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          프로젝트 상세
        </button>

        <div className="relative mt-5 aspect-[16/9] rounded-3xl overflow-hidden border border-white/10">
          <CoverFill cover={project.coverImage} fade={false} />
          <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-3 py-1.5 text-[11px] font-semibold text-[#9df0c4] border border-[#00C471]/50">
            <Check className="w-3 h-3" strokeWidth={3} />팀 확정
          </span>
        </div>

        <h1 className="mt-5 text-2xl md:text-3xl font-semibold tracking-tight leading-[1.25]">
          {project.title}
        </h1>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/55">
          <span>우리 팀 스페이스</span>
          {project.category && (
            <>
              <span className="text-white/25">·</span>
              <span>{project.category}</span>
            </>
          )}
          <span className="text-white/25">·</span>
          <span>팀원 {project.members.length}명</span>
        </div>

        {/* 팀 공지 — 팀이 맨 위에 붙여 두는 한마디. 없으면 오너에게만 보입니다. */}
        {(project.teamNotice || isOwner) && (
          <section className="liquid-glass rounded-2xl p-5 mt-7">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white">팀 공지</h2>
              {isOwner && !editingNotice && (
                <button
                  onClick={() => {
                    setDraftNotice(project.teamNotice ?? '');
                    setSaveError(null);
                    setEditingNotice(true);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  {project.teamNotice ? '수정' : '추가'}
                </button>
              )}
            </div>

            {editingNotice ? (
              <div className="mt-4 space-y-3">
                <textarea
                  value={draftNotice}
                  onChange={(e) => setDraftNotice(e.target.value)}
                  rows={3}
                  placeholder="회의 시간, 이번 주 목표처럼 팀원이 자주 찾는 내용을 적어 두세요"
                  className="w-full rounded-xl bg-white/[0.05] border border-white/12 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-[#3182F6] transition-colors resize-none leading-[1.7]"
                />
                {saveError && <p className="text-xs text-[#F04452]">{saveError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingNotice(false);
                      setSaveError(null);
                    }}
                    className="flex-1 h-11 rounded-full border border-white/15 text-white/70 text-xs font-medium hover:bg-white/5 hover:text-white transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={saveNotice}
                    disabled={saving}
                    className="flex-1 h-11 rounded-full bg-white text-black text-xs font-semibold hover:bg-white/90 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    {saving ? '저장하는 중…' : '저장'}
                  </button>
                </div>
              </div>
            ) : project.teamNotice ? (
              <p className="mt-3 text-sm text-white/80 leading-[1.75] whitespace-pre-line">
                {project.teamNotice}
              </p>
            ) : (
              <p className="mt-3 text-sm text-white/55">
                회의 시간이나 이번 주 목표를 적어 두면 팀원이 여기서 바로 확인해요.
              </p>
            )}
          </section>
        )}

        {/* 팀원 — project_members 뷰가 오너까지 포함한 팀 전원을 내려 줍니다 */}
        <section className="liquid-glass rounded-2xl p-5 mt-4">
          <h2 className="text-sm font-semibold text-white inline-flex items-center gap-1.5">
            <Users className="w-4 h-4 text-white/60" />팀원 {project.members.length}명
          </h2>
          <ul className="mt-4 space-y-1">
            {project.members.map((m) => {
              const body = (
                <>
                  <Avatar
                    name={m.name}
                    avatarUrl={m.avatarUrl}
                    gradient={m.avatarGradient}
                    className="w-9 h-9 text-xs flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-white truncate">{m.name}</span>
                      {m.isOwner && (
                        <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-[#FFB020]/40 text-[#ffd27d] bg-[#FFB020]/10">
                          팀장
                        </span>
                      )}
                    </div>
                    {m.githubLogin && (
                      <div className="text-xs text-white/50 truncate">@{m.githubLogin}</div>
                    )}
                  </div>
                  {m.field && <FieldTag field={m.field} className="flex-shrink-0" />}
                  {m.githubLogin && (
                    <Github className="w-4 h-4 text-white/35 flex-shrink-0" />
                  )}
                </>
              );

              // GitHub 로그인을 아는 팀원은 줄 전체가 프로필로 가는 링크입니다
              return (
                <li key={m.id}>
                  {m.githubLogin ? (
                    <a
                      href={`https://github.com/${m.githubLogin}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 -mx-2 px-2 py-2 rounded-xl hover:bg-white/[0.06] transition-colors"
                    >
                      {body}
                    </a>
                  ) : (
                    <div className="flex items-center gap-3 -mx-2 px-2 py-2">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-1.5">
            {project.slots.map((s) => (
              <span
                key={s.field}
                className="text-[11px] text-white/75 px-2.5 py-1 rounded-full border border-white/15 bg-white/[0.05] tabular-nums"
              >
                {FIELD_SHORT[s.field] ?? s.field} {s.confirmed}/{s.capacity}
              </span>
            ))}
          </div>
        </section>

        {/* 팀 링크 — 팀이 쓰는 것만 골라 담습니다 */}
        <section className="liquid-glass rounded-2xl p-5 mt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-white">팀 링크</h2>
            {isOwner && !editingLinks && (
              <button
                onClick={startEditLinks}
                className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors"
              >
                <Pencil className="w-3 h-3" />
                {links.length > 0 ? '수정' : '추가'}
              </button>
            )}
          </div>

          {editingLinks ? (
            <div className="mt-4 space-y-2.5">
              {draftLinks.map((link, i) => (
                // 좁은 화면에서는 종류·삭제가 윗줄, 주소가 아랫줄 전체를 씁니다.
                // 한 줄에 다 밀어 넣으면 주소 칸이 15자밖에 안 보여 붙여넣고도 확인이 안 돼요.
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <select
                    value={link.type}
                    onChange={(e) =>
                      setDraftLinks((prev) =>
                        prev.map((l, j) => (j === i ? { ...l, type: e.target.value } : l)),
                      )
                    }
                    aria-label="링크 종류"
                    className="order-1 h-12 flex-shrink-0 rounded-xl bg-white/[0.05] border border-white/12 px-3 text-sm text-white outline-none focus:border-[#3182F6] transition-colors [&>option]:bg-[#12151a] [&>option]:text-white"
                  >
                    {TEAM_LINK_KINDS.map((k) => (
                      <option key={k.key} value={k.key}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={link.url}
                    onChange={(e) =>
                      setDraftLinks((prev) =>
                        prev.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)),
                      )
                    }
                    placeholder={placeholderFor(link.type)}
                    aria-label={`${teamLinkLabel(link.type)} URL`}
                    className="order-3 w-full sm:order-2 sm:w-auto sm:flex-1 min-w-0 h-12 rounded-xl bg-white/[0.05] border border-white/12 px-4 text-sm text-white placeholder:text-white/40 outline-none focus:border-[#3182F6] transition-colors"
                  />
                  <button
                    onClick={() => setDraftLinks((prev) => prev.filter((_, j) => j !== i))}
                    aria-label="링크 삭제"
                    className="order-2 ml-auto sm:order-3 sm:ml-0 w-10 h-10 flex-shrink-0 grid place-items-center rounded-full text-white/45 hover:text-[#F04452] hover:bg-white/5 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <button
                onClick={() => setDraftLinks((prev) => [...prev, { type: 'etc', url: '' }])}
                className="inline-flex items-center gap-1.5 text-xs text-[#7db4ff] hover:text-[#a9cbff] transition-colors pt-0.5"
              >
                <Plus className="w-3.5 h-3.5" />
                링크 추가
              </button>

              {saveError && <p className="text-xs text-[#F04452]">{saveError}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    setEditingLinks(false);
                    setSaveError(null);
                  }}
                  className="flex-1 h-11 rounded-full border border-white/15 text-white/70 text-xs font-medium hover:bg-white/5 hover:text-white transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={saveLinks}
                  disabled={saving}
                  className="flex-1 h-11 rounded-full bg-white text-black text-xs font-semibold hover:bg-white/90 active:scale-[0.99] transition-all disabled:opacity-50"
                >
                  {saving ? '저장하는 중…' : '저장'}
                </button>
              </div>
            </div>
          ) : links.length === 0 ? (
            <p className="mt-3 text-sm text-white/55">
              {isOwner
                ? '저장소·문서·디자인처럼 팀이 자주 여는 곳을 모아 두면 여기서 바로 찾아가요.'
                : '아직 등록된 링크가 없어요. 팀장이 추가하면 여기에 모여요.'}
            </p>
          ) : (
            <div className="mt-3.5 space-y-2">
              {links.map((link, i) => {
                const Icon = LINK_ICONS[link.type] ?? LinkIcon;
                return (
                  <a
                    key={`${link.type}-${i}`}
                    href={toHref(link.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 hover:border-white/25 hover:bg-white/[0.07] transition-colors"
                  >
                    <Icon className="w-4 h-4 text-white/60 flex-shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-white">
                        {teamLinkLabel(link.type)}
                      </span>
                      <span className="block text-xs text-white/50 truncate">{link.url}</span>
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
                  </a>
                );
              })}
            </div>
          )}
        </section>
      </motion.div>
    </div>
  );
}
