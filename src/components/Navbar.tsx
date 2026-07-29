import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, ShieldCheck, X } from 'lucide-react';
import { Avatar, GithubButton, LogoMark } from './primitives';
import { api } from '../api';
import type { User } from '../api';

export default function Navbar({
  fixed = false,
  onStart,
  onMyPage,
}: {
  fixed?: boolean;
  onStart?: () => void;
  onMyPage?: () => void;
}) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null));
    // 확정된 팀이 있으면 팀 스페이스로 바로 갈 수 있게 첫 팀 id 를 들고 있습니다
    api
      .myTeams()
      .then((teams) => setMyTeamId(teams[0]?.id ?? null))
      .catch(() => setMyTeamId(null));
  }, []);

  // 랜딩 밖(프로젝트 탐색·크루 등)에서는 핸들러 없이 그냥 <Navbar /> 로 쓸 수 있게 기본 동작을 둡니다.
  const startAuth = async () => {
    try {
      const me = await api.me();
      navigate(me.onboarded ? '/my' : '/onboarding');
    } catch {
      await api.login().catch(() => navigate('/onboarding'));
    }
  };
  const handleStart = onStart ?? startAuth;
  const handleMyPage = onMyPage ?? (() => navigate('/my'));

  const links: { label: string; onClick: () => void }[] = [
    { label: '프로젝트 탐색', onClick: () => navigate('/projects') },
    { label: '크루', onClick: () => navigate('/crews') },
    { label: '부스 지도', onClick: () => navigate('/booths') },
    // 확정된 팀이 있을 때만 노출 — 없는 사람에게 빈 페이지를 보여줄 이유가 없어요
    ...(myTeamId ? [{ label: '나의 팀', onClick: () => navigate(`/teams/${myTeamId}`) }] : []),
    { label: 'FAQ', onClick: () => navigate('/faq') },
  ];

  const go = (fn: () => void) => {
    setMenuOpen(false);
    fn();
  };

  const avatarBtn = (
    <button
      onClick={handleMyPage}
      className="rounded-full ring-2 ring-transparent hover:ring-white/20 active:scale-[0.96] transition-all"
      aria-label="마이페이지"
    >
      <Avatar
        name={user?.crewName ?? '나'}
        avatarUrl={user?.avatarUrl}
        gradient={user?.avatarGradient}
        className="w-10 h-10 text-sm"
      />
    </button>
  );

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={
        fixed
          ? 'fixed inset-x-0 top-0 z-30 border-b border-white/5 bg-[#0c0c0c]/70 backdrop-blur-xl'
          : 'relative z-30'
      }
    >
      <div className="relative max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity" aria-label="홈으로">
          <LogoMark className="w-7 h-7" />
          <span className="text-[17px] font-bold tracking-tight">meeTeam</span>
        </a>

        <div className="hidden md:flex gap-8">
          {links.map((link, i) => (
            <motion.button
              key={link.label}
              type="button"
              onClick={link.onClick}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.05, ease: 'easeOut' }}
              className="text-white/70 text-sm font-medium hover:text-white transition-colors"
            >
              {link.label}
            </motion.button>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          {user ? avatarBtn : <GithubButton onClick={handleStart} />}
        </div>

        {/* 모바일 */}
        <div className="md:hidden flex items-center gap-2.5">
          {user ? (
            avatarBtn
          ) : (
            <button
              onClick={handleStart}
              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center active:scale-[0.96] transition-all"
              aria-label="시작하기"
            >
              <span className="text-xs font-bold">시작</span>
            </button>
          )}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white active:scale-[0.96] transition-all"
            aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* 모바일 드롭다운 */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="md:hidden absolute top-full right-6 mt-2 w-52 rounded-2xl bg-[#12151a] border border-white/10 shadow-2xl overflow-hidden py-2"
            >
              {links.map((link) => (
                <button
                  key={link.label}
                  onClick={() => go(link.onClick)}
                  className="w-full text-left px-5 py-3 text-sm text-white/80 hover:bg-white/5 transition-colors"
                >
                  {link.label}
                </button>
              ))}
              {user && (
                <>
                  <div className="my-1.5 h-px bg-white/10" />
                  <button
                    onClick={() => go(handleMyPage)}
                    className="w-full text-left px-5 py-3 text-sm text-white/80 hover:bg-white/5 transition-colors"
                  >
                    마이페이지
                  </button>
                  {user.isAdmin && (
                    <>
                      <button
                        onClick={() => go(() => navigate('/admin'))}
                        className="w-full text-left px-5 py-3 text-sm text-[#7db4ff] hover:bg-white/5 transition-colors inline-flex items-center gap-2"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        서비스 관리자
                      </button>
                      <button
                        onClick={() => go(() => navigate('/booths/admin'))}
                        className="w-full text-left px-5 py-3 text-sm text-[#7db4ff] hover:bg-white/5 transition-colors inline-flex items-center gap-2"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        부스 관리자
                      </button>
                    </>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  );
}
