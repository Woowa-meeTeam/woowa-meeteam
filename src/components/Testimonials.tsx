import { motion } from 'motion/react';

const testimonials = [
  {
    quote:
      '슬랙 공지 놓쳐서 팀을 못 구한 적이 두 번이에요. meeTeam에서는 모집 중인 프로젝트가 한눈에 보여서 바로 지원했어요.',
    name: '재문',
    role: '프론트엔드 크루',
    company: '6기',
  },
  {
    quote:
      '지원자 프로필에 분야랑 스킬이 같이 와서, 팀 구성을 감이 아니라 근거로 할 수 있었어요. 확정 버튼 하나로 끝난 것도 편했고요.',
    name: '수민',
    role: '프로젝트 오너 · 백엔드 크루',
    company: '6기',
  },
  {
    quote:
      '온보딩이 3분이면 끝나요. 크루명 정하고 스킬 고르면 바로 탐색 시작 — 토스 쓰는 느낌이라 낯설지 않았어요.',
    name: '하린',
    role: '안드로이드 크루',
    company: '7기',
  },
];

export default function Testimonials() {
  return (
    <section className="relative z-20 max-w-6xl mx-auto px-6 py-16 md:py-24 border-t border-white/10">
      <div className="grid md:grid-cols-3 gap-6">
        {testimonials.map((t, i) => (
          <motion.figure
            key={t.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="liquid-glass rounded-2xl p-6"
          >
            <blockquote className="text-sm text-white/80 leading-[1.7]">“{t.quote}”</blockquote>
            <figcaption className="mt-6 pt-5 border-t border-white/10">
              <div className="text-sm font-semibold text-white">{t.name}</div>
              <div className="text-xs text-white/50">{t.role}</div>
              <div className="text-xs text-white font-semibold tracking-wide uppercase mt-1">
                우아한테크코스 {t.company}
              </div>
            </figcaption>
          </motion.figure>
        ))}
      </div>
    </section>
  );
}
