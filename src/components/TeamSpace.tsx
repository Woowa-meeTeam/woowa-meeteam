import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Check, ExternalLink, Github, Link as LinkIcon, Pencil, Users } from 'lucide-react';
import { Avatar, CoverFill, HomeLogo } from './primitives';
import { api, ApiError, FIELD_SHORT } from '../api';
import type { Project, User } from '../api';

const easeOut = [0.22, 1, 0.36, 1] as const;

/** 링크 입력이 http 없이 들어와도 열리도록 */
function toHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/**
 * 팀 스페이스 — 팀이 확정되면 그 프로젝트에 자동으로 열리는 팀 전용 페이지.
 *
 * 따로 만드는 절차가 없습니다. 확정(CONFIRMED)이 곧 개설 조건이에요.
 * "우리 팀 정보 어디 있지" 싶을 때 다시 들어올 곳이라, 팀원·기술스택·링크만 모아 둡니다.
 */
export default function TeamSpace() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [me, setMe] = useState<User | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
  const [notionUrl, setNotionUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.project(id), api.me().catch(() => null)])
      .then(([p, user]) => {
        setProject(p);
        setMe(user);
        setGithubUrl(p.githubUrl ?? '');
        setNotionUrl(p.notionUrl ?? '');
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
  /** 팀이 함께 쓰는 기술 — 분야별 모집 스택을 한 곳에 모읍니다 */
  const stack = Array.from(new Set(project.slots.flatMap((s) => s.skills)));

  const saveLinks = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await api.saveTeamLinks(project.id, { githubUrl, notionUrl });
      setProject(updated);
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : '링크 저장에 실패했어요');
    } finally {
      setSaving(false);
    }
  };

  const links = [
    { key: 'github', label: 'GitHub', url: project.githubUrl, Icon: Github },
    { key: 'notion', label: 'Notion', url: project.notionUrl, Icon: LinkIcon },
  ].filter((l) => l.url);

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
        <p className="mt-2 text-sm text-white/60">우리 팀 스페이스</p>

        {/* 팀원 */}
        <section className="liquid-glass rounded-2xl p-5 mt-7">
          <h2 className="text-sm font-semibold text-white inline-flex items-center gap-1.5">
            <Users className="w-4 h-4 text-white/60" />팀원 {project.members.length + 1}명
          </h2>
          <ul className="mt-4 space-y-3">
            {project.owner && (
              <li className="flex items-center gap-3">
                <Avatar
                  name={project.owner.name}
                  avatarUrl={project.owner.avatarUrl}
                  gradient={project.owner.avatarGradient}
                  className="w-9 h-9 text-xs"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white">{project.owner.name}</div>
                  <div className="text-xs text-white/55">
                    오너{project.owner.field && ` · ${project.owner.field}`}
                  </div>
                </div>
              </li>
            )}
            {project.members.map((m, i) => (
              <li key={`${m.name}-${i}`} className="flex items-center gap-3">
                <Avatar
                  name={m.name}
                  avatarUrl={m.avatarUrl}
                  gradient={m.avatarGradient}
                  className="w-9 h-9 text-xs"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white">{m.name}</div>
                  <div className="text-xs text-white/55">{m.field}</div>
                </div>
              </li>
            ))}
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

        {/* 기술 스택 */}
        <section className="liquid-glass rounded-2xl p-5 mt-4">
          <h2 className="text-sm font-semibold text-white">기술 스택</h2>
          {stack.length === 0 ? (
            <p className="mt-3 text-sm text-white/55">
              등록된 기술 스택이 없어요. 프로젝트 수정에서 분야별 스택을 채우면 여기 모여요.
            </p>
          ) : (
            <div className="mt-3.5 flex flex-wrap gap-1.5">
              {stack.map((skill) => (
                <span
                  key={skill}
                  className="text-[11px] text-white/80 px-2.5 py-1 rounded-full border border-white/15 bg-white/[0.05]"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* 링크 모음 */}
        <section className="liquid-glass rounded-2xl p-5 mt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-white">팀 링크</h2>
            {isOwner && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors"
              >
                <Pencil className="w-3 h-3" />
                {links.length > 0 ? '수정' : '추가'}
              </button>
            )}
          </div>

          {editing ? (
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs text-white/60">GitHub</span>
                <input
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="github.com/team/repo"
                  className="mt-1.5 w-full h-12 rounded-xl bg-white/[0.05] border border-white/12 px-4 text-sm text-white placeholder:text-white/40 outline-none focus:border-[#3182F6] transition-colors"
                />
              </label>
              <label className="block">
                <span className="text-xs text-white/60">Notion</span>
                <input
                  value={notionUrl}
                  onChange={(e) => setNotionUrl(e.target.value)}
                  placeholder="notion.so/…"
                  className="mt-1.5 w-full h-12 rounded-xl bg-white/[0.05] border border-white/12 px-4 text-sm text-white placeholder:text-white/40 outline-none focus:border-[#3182F6] transition-colors"
                />
              </label>
              {saveError && <p className="text-xs text-[#F04452]">{saveError}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    setEditing(false);
                    setGithubUrl(project.githubUrl ?? '');
                    setNotionUrl(project.notionUrl ?? '');
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
                ? '저장소와 문서 링크를 넣어 두면 팀원들이 여기서 바로 찾아가요.'
                : '아직 등록된 링크가 없어요. 오너가 추가하면 여기에 모여요.'}
            </p>
          ) : (
            <div className="mt-3.5 space-y-2">
              {links.map(({ key, label, url, Icon }) => (
                <a
                  key={key}
                  href={toHref(url!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 hover:border-white/25 hover:bg-white/[0.07] transition-colors"
                >
                  <Icon className="w-4 h-4 text-white/60 flex-shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-white">{label}</span>
                    <span className="block text-xs text-white/50 truncate">{url}</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
                </a>
              ))}
            </div>
          )}
        </section>
      </motion.div>
    </div>
  );
}
