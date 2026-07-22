import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Menu } from 'lucide-react';
import { Avatar, GithubButton, LogoMark } from './primitives';
import { api } from '../api';
import type { User } from '../api';

export default function Navbar({ onStart, onMyPage }: { onStart?: () => void; onMyPage?: () => void }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  /** 홈이면 쇼케이스로 스크롤, 다른 페이지면 홈으로 이동 후 스크롤 */
  const goToProjects = () => {
    const scroll = () =>
      document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (window.location.pathname === '/') scroll();
    else {
      navigate('/');
      setTimeout(scroll, 100);
    }
  };

  const links: { label: string; onClick: () => void }[] = [
    { label: '프로젝트 탐색', onClick: goToProjects },
    { label: '크루', onClick: () => navigate('/crews') },
    { label: '가이드', onClick: () => navigate('/') },
  ];

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null));
  }, []);

  const avatarBtn = (
    <button
      onClick={onMyPage}
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
      className="relative z-20 max-w-6xl mx-auto px-6 py-5 flex items-center justify-between"
    >
      <div className="flex items-center gap-2.5">
        <LogoMark className="w-7 h-7" />
        <span className="text-[17px] font-bold tracking-tight">meeTeam</span>
      </div>

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
        {user ? avatarBtn : <GithubButton onClick={onStart} />}
      </div>

      <div className="md:hidden flex items-center gap-2.5">
        {user ? (
          avatarBtn
        ) : (
          <button
            onClick={onStart}
            className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center active:scale-[0.96] transition-all"
            aria-label="시작하기"
          >
            <span className="text-xs font-bold">시작</span>
          </button>
        )}
        <button
          className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center"
          aria-label="메뉴 열기"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
    </motion.nav>
  );
}
