import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { GithubButton, gradientStyle } from './primitives';
import StatsBoard from './StatsBoard';

const easeOut = [0.22, 1, 0.36, 1] as const;

export default function Hero({
  onStart,
  loggedIn = false,
  onExplore,
}: {
  onStart?: () => void;
  loggedIn?: boolean;
  onExplore?: () => void;
}) {
  return (
    <section className="relative z-20 pt-16 md:pt-28 pb-20 text-center flex flex-col items-center px-6">
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3, ease: easeOut }}
        className="text-4xl md:text-7xl font-semibold tracking-tight leading-[1.05]"
      >
        <span className="block text-white">함께할 팀,</span>
        <span className="block animate-shiny" style={gradientStyle}>
          여기서 만나요
        </span>
      </motion.h1>

      {/* 한 줄에 한 생각씩 — 줄바꿈을 직접 잡아 가독성을 확보 */}
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5, ease: easeOut }}
        className="mt-7 text-white/60 text-[15px] md:text-lg leading-[1.7] text-balance"
      >
        <span className="block">우테코 크루들의 사이드 프로젝트 매칭 플랫폼</span>
        <span className="block mt-1.5 text-white/65 text-sm md:text-base">
          등록부터 지원, 팀 확정까지 한 곳에서
        </span>
      </motion.p>

      <StatsBoard />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.7, ease: easeOut }}
        className="mt-8 flex flex-col items-center gap-3"
      >
        {loggedIn ? (
          <button
            onClick={onExplore}
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-white text-black font-medium text-sm px-5 py-3 transition-all hover:bg-white/90 active:scale-[0.98]"
          >
            프로젝트 둘러보기
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-[2px]" />
          </button>
        ) : (
          <GithubButton onClick={onStart} />
        )}
      </motion.div>
    </section>
  );
}
