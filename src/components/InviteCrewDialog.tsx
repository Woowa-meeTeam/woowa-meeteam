import { useMemo, useState } from 'react';
import { X, Send } from 'lucide-react';
import { FieldTag } from './FieldFilters';
import { api } from '../api';
import type { Project, User } from '../api';

const MAX_MESSAGE = 200;

type Props = {
  crew: User;
  /** 내가 오너인 모집 중 프로젝트들 */
  projects: Project[];
  onClose: () => void;
  onSent: () => void;
};

export default function InviteCrewDialog({ crew, projects, onClose, onSent }: Props) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const project = projects.find((p) => p.id === projectId) ?? projects[0];

  // 정원이 남은 분야만 제안할 수 있습니다. 꽉 찬 분야는 DB 도 거절해요.
  const openFields = useMemo(
    () => (project?.slots ?? []).filter((s) => s.confirmed < s.capacity),
    [project],
  );
  // 크루가 가진 분야를 먼저 권합니다 — 대개 그 자리로 부르니까요.
  const [field, setField] = useState(
    () => openFields.find((s) => crew.fields.includes(s.field))?.field ?? openFields[0]?.field ?? '',
  );
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!project || !field || !message.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.sendInvitation(project.id, crew.id, field, message);
      onSent();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`${crew.crewName} 님에게 팀원 제안`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111] p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{crew.crewName} 님에게 제안</h2>
            <p className="mt-1 text-sm text-white/60">
              수락하면 바로 팀원이 돼요
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex-shrink-0 rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {projects.length > 1 && (
          <div className="mt-6">
            <label className="text-xs font-medium text-white/70">어느 프로젝트로</label>
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setField('');
              }}
              className="mt-2 w-full h-12 rounded-2xl bg-white/[0.04] border border-white/10 px-4 text-sm text-white outline-none focus:border-[#3182F6]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#111]">
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-5">
          <label className="text-xs font-medium text-white/70">어느 자리로</label>
          {openFields.length === 0 ? (
            <p className="mt-2 rounded-2xl border border-dashed border-white/15 px-4 py-5 text-sm text-white/60">
              남은 자리가 없어요. 정원을 늘린 뒤 다시 제안해 주세요.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {openFields.map((s) => (
                <button
                  key={s.field}
                  type="button"
                  onClick={() => setField(s.field)}
                  className={`px-4 py-2.5 rounded-full border text-sm font-medium transition-all ${
                    field === s.field
                      ? 'border-[#3182F6] bg-[#3182F6]/15 text-white'
                      : 'bg-white/[0.03] text-white/70 border-white/10 hover:border-white/25'
                  }`}
                >
                  {s.field}
                  <span className="ml-1.5 text-xs opacity-60">
                    {s.confirmed}/{s.capacity}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {crew.fields.length > 0 && (
          <div className="mt-4 flex items-center gap-2 text-xs text-white/50">
            <span>크루 분야</span>
            {crew.fields.map((f) => (
              <FieldTag key={f} field={f} />
            ))}
          </div>
        )}

        <div className="mt-5">
          <label htmlFor="invite-message" className="text-xs font-medium text-white/70">
            한마디
          </label>
          <textarea
            id="invite-message"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
            rows={4}
            placeholder="어떤 점이 좋아서 함께하고 싶은지 적어주세요"
            className="mt-2 w-full rounded-2xl bg-white/[0.04] border border-white/10 px-4 py-3.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#3182F6] resize-y leading-[1.7]"
          />
          <div className="mt-1.5 text-right text-xs text-white/40">
            {message.length}/{MAX_MESSAGE}
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-2xl border border-[#ff6b6b]/30 bg-[#ff6b6b]/10 px-4 py-3 text-sm text-[#ffb3b3]">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={busy || !field || !message.trim() || openFields.length === 0}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 h-12 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 active:scale-[0.99] transition-all disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
          {busy ? '보내는 중…' : '제안 보내기'}
        </button>
      </div>
    </div>
  );
}
