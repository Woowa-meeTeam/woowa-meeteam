import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Mail, Check, X } from 'lucide-react';
import { CoverFill } from './primitives';
import { FieldTag } from './FieldFilters';
import { api } from '../api';
import type { Invitation } from '../api';

const easeOut = [0.22, 1, 0.36, 1] as const;

const STATUS_LABEL: Record<Invitation['status'], string> = {
  PENDING: '답변 대기',
  ACCEPTED: '수락함',
  DECLINED: '거절함',
  CANCELED: '취소됨',
};

const STATUS_STYLE: Record<Invitation['status'], string> = {
  PENDING: 'border-[#FFB020]/40 text-[#ffd27d] bg-[#FFB020]/10',
  ACCEPTED: 'border-[#2ecc71]/40 text-[#7ee2a8] bg-[#2ecc71]/10',
  DECLINED: 'border-white/15 text-white/50 bg-white/[0.03]',
  CANCELED: 'border-white/15 text-white/40 bg-white/[0.03]',
};

export default function Invitations() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Invitation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = () =>
    api
      .myInvitations()
      .then(setItems)
      .catch((e) => setError(e.message));

  useEffect(() => {
    api
      .myInvitations()
      .then(setItems)
      .catch((e) => {
        // 미로그인이면 랜딩으로 — 받은 제안은 본인만 볼 수 있어요
        if (e.status === 401) navigate('/', { replace: true });
        else setError(e.message);
      });
  }, [navigate]);

  const respond = async (inv: Invitation, accept: boolean) => {
    setBusy(inv.id);
    setNotice(null);
    try {
      await api.respondInvitation(inv.id, accept);
      setNotice(
        accept
          ? `'${inv.projectTitle}' 팀에 합류했어요. 다른 지원과 제안은 정리했어요.`
          : '제안을 거절했어요.',
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const pending = items?.filter((i) => i.status === 'PENDING') ?? [];
  const past = items?.filter((i) => i.status !== 'PENDING') ?? [];

  return (
    <div className="relative z-20 min-h-screen flex flex-col">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut }}
        className="flex-1 max-w-3xl w-full mx-auto px-6 pb-20"
      >
        <h1 className="page-title">받은 제안</h1>
        <p className="mt-2 text-sm text-white/70">
          팀이 먼저 손을 내민 자리예요. 수락하면 바로 팀원이 됩니다.
        </p>

        {notice && (
          <p className="mt-6 rounded-2xl border border-[#2ecc71]/30 bg-[#2ecc71]/10 px-5 py-4 text-sm text-[#7ee2a8]">
            {notice}
          </p>
        )}
        {error && (
          <p className="mt-6 rounded-2xl border border-dashed border-white/15 px-5 py-4 text-sm text-white/70">
            {error}
          </p>
        )}

        {!items && !error && (
          <div className="mt-8 space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="liquid-glass rounded-2xl h-32 animate-pulse" />
            ))}
          </div>
        )}

        {items && items.length === 0 && (
          <p className="mt-8 text-sm text-white/60 py-14 text-center border border-dashed border-white/10 rounded-2xl">
            아직 받은 제안이 없어요
          </p>
        )}

        {pending.length > 0 && (
          <div className="mt-8 space-y-3">
            {pending.map((inv) => (
              <div key={inv.id} className="liquid-glass rounded-2xl overflow-hidden">
                <div className="relative h-24">
                  <CoverFill cover={inv.coverImage} fade={false} />
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => navigate(`/projects/${inv.projectId}`)}
                        className="text-base font-semibold text-white hover:underline text-left"
                      >
                        {inv.projectTitle}
                      </button>
                      <p className="mt-1 text-xs text-white/60">{inv.projectOwner} 님이 보냈어요</p>
                    </div>
                    <FieldTag field={inv.field} className="flex-shrink-0" />
                  </div>

                  <p className="mt-4 text-sm text-white/80 leading-[1.7] whitespace-pre-wrap">
                    {inv.message}
                  </p>

                  <div className="mt-5 flex gap-2">
                    <button
                      type="button"
                      disabled={busy === inv.id}
                      onClick={() => respond(inv, true)}
                      className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 active:scale-[0.99] transition-all disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      수락하고 합류
                    </button>
                    <button
                      type="button"
                      disabled={busy === inv.id}
                      onClick={() => respond(inv, false)}
                      className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full border border-white/15 text-sm font-medium text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      거절
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {past.length > 0 && (
          <>
            <h2 className="mt-10 mb-3 text-sm font-semibold text-white/70">지난 제안</h2>
            <div className="space-y-2">
              {past.map((inv) => (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => navigate(`/projects/${inv.projectId}`)}
                  className="w-full liquid-glass rounded-2xl px-5 py-4 flex items-center gap-3 text-left hover:bg-white/[0.06] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white truncate">
                      {inv.projectTitle}
                    </div>
                    <div className="text-xs text-white/50 mt-0.5">{inv.field}</div>
                  </div>
                  <span
                    className={`flex-shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full border ${STATUS_STYLE[inv.status]}`}
                  >
                    {STATUS_LABEL[inv.status]}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {items && items.length > 0 && (
          <p className="mt-10 text-xs text-white/50 text-center inline-flex items-center gap-1.5 w-full justify-center">
            <Mail className="w-3.5 h-3.5" />
            제안을 수락하면 다른 지원과 제안은 자동으로 정리돼요
          </p>
        )}
      </motion.div>
    </div>
  );
}
