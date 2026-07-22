import { motion } from 'motion/react';
import { GithubButton, gradientStyle } from './primitives';

const easeOut = [0.22, 1, 0.36, 1] as const;

export default function Hero({ onStart }: { onStart?: () => void }) {
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

      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5, ease: easeOut }}
        className="mt-8 text-white/60 max-w-md text-base leading-[1.6]"
      >
        meeTeam은 우테코 크루들의 사이드 프로젝트 매칭 플랫폼이에요. 프로젝트를 등록하고, 지원하고,
        팀을 확정하기까지 — 흩어져 있던 팀 빌딩을 한 곳에서.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.7, ease: easeOut }}
        className="mt-10 flex flex-col items-center gap-3"
      >
        <GithubButton onClick={onStart} />
        <span className="text-xs text-white/40">우테코 크루라면 누구나 · GitHub 계정으로 3분 만에</span>
      </motion.div>
    </section>
  );
}
