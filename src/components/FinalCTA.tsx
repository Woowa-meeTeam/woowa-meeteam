import { motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import { GithubButton } from './primitives';

export default function FinalCTA({
  onStart,
  loggedIn = false,
  onExplore,
}: {
  onStart?: () => void;
  loggedIn?: boolean;
  onExplore?: () => void;
}) {
  return (
    <section className="relative z-20 max-w-6xl mx-auto px-6 py-20 md:py-28">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="liquid-glass relative overflow-hidden rounded-3xl px-8 py-16 md:py-24 text-center"
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: 0.3,
            background: 'radial-gradient(600px circle at 50% 0%, rgba(255,255,255,0.15), transparent 70%)',
          }}
        />
        <div className="relative">
          <h2 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.1]">
            혼자 고민하던 아이디어,
            <br />
            오늘 팀이 됩니다.
          </h2>
          <p className="mt-6 text-white/60 max-w-md mx-auto text-sm leading-[1.6]">
            함께할 크루들이 기다리고 있어요.
            {!loggedIn && ' GitHub 계정만 있으면 3분 만에 시작할 수 있습니다.'}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            {!loggedIn && <GithubButton onClick={onStart} />}
            <button
              onClick={onExplore}
              className={`group inline-flex items-center gap-2 rounded-full text-sm font-medium px-5 py-3 transition-colors ${
                loggedIn
                  ? 'bg-white text-black hover:bg-white/90'
                  : 'border border-white/15 text-white hover:bg-white/5'
              }`}
            >
              프로젝트 둘러보기
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-[1px]" />
            </button>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
