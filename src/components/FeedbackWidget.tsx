import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, MessageSquarePlus, X } from 'lucide-react';
import { api, ApiError, FEEDBACK_KIND_LABEL } from '../api';
import type { FeedbackKind } from '../api';

const KINDS: FeedbackKind[] = ['BUG', 'IMPROVEMENT', 'FEATURE', 'ETC'];

/** 우하단 플로팅 제보 버튼 — 불편사항·개선·기능 제안 */
export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>('IMPROVEMENT');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = message.trim().length >= 5 && message.trim().length <= 1000;

  const send = async () => {
    if (!valid || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.sendFeedback({ kind, message });
      setSent(true);
      setMessage('');
      setTimeout(() => {
        setOpen(false);
        setSent(false);
      }, 1400);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 401
          ? '제보하려면 GitHub 로그인이 필요해요'
          : e instanceof ApiError
            ? e.message
            : '전송에 실패했어요',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white text-sm font-medium px-4 py-3 hover:bg-white/20 active:scale-[0.97] transition-all shadow-lg"
        aria-label="의견 보내기"
      >
        <MessageSquarePlus className="w-4 h-4" />
        <span className="hidden sm:inline">의견 보내기</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl bg-[#12151a] border border-white/10 p-6 shadow-2xl"
            >
              {sent ? (
                <div className="py-8 flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#3182F6] to-[#00d2ff] flex items-center justify-center">
                    <Check className="w-6 h-6 text-white" strokeWidth={3} />
                  </div>
                  <p className="mt-5 text-lg font-semibold text-white">고마워요!</p>
                  <p className="mt-1.5 text-sm text-white/50">
                    보내주신 의견은 관리자가 확인할게요.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-white">의견 보내기</h2>
                      <p className="mt-1 text-xs text-white/45">
                        불편했던 점이나 있었으면 하는 기능을 알려주세요
                      </p>
                    </div>
                    <button
                      onClick={() => setOpen(false)}
                      className="w-8 h-8 rounded-full text-white/50 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
                      aria-label="닫기"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {KINDS.map((k) => (
                      <button
                        key={k}
                        onClick={() => setKind(k)}
                        className={`px-3.5 py-2 rounded-full border text-xs font-medium transition-all ${
                          kind === k
                            ? 'bg-white text-black border-white'
                            : 'bg-white/[0.03] text-white/60 border-white/10 hover:border-white/30 hover:text-white'
                        }`}
                      >
                        {FEEDBACK_KIND_LABEL[k]}
                      </button>
                    ))}
                  </div>

                  <textarea
                    autoFocus
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    placeholder="예) 프로젝트 카드에서 마감일이 안 보여서 헷갈렸어요"
                    className="mt-4 w-full rounded-2xl bg-white/[0.04] border border-white/10 px-4 py-3.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-[#3182F6] transition-colors resize-none leading-[1.6]"
                  />
                  <div className="mt-2 flex justify-between text-xs">
                    <span className="text-white/30">최소 5자</span>
                    <span className="text-white/30 tabular-nums">{message.trim().length}/1000</span>
                  </div>

                  {error && <p className="mt-3 text-xs text-[#F04452]">{error}</p>}

                  <button
                    onClick={send}
                    disabled={!valid || sending}
                    className={`mt-5 w-full h-12 rounded-full text-sm font-semibold transition-all ${
                      valid && !sending
                        ? 'bg-white text-black hover:bg-white/90 active:scale-[0.99]'
                        : 'bg-white/10 text-white/30 cursor-not-allowed'
                    }`}
                  >
                    {sending ? '보내는 중…' : '보내기'}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
