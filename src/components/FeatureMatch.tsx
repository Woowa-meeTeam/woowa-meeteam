import { motion } from 'motion/react';
import { SectionEyebrow } from './primitives';

const chips = ['크루 프로필 공유', '1인 1지원', '분야별 정원 관리', '정원 충족 시 자동 마감'];

const buckets = [
  {
    name: '지원 대기',
    count: 3,
    color: '#ffffff',
    items: ['도현 — 백엔드 · Spring / JPA', '민지 — 프론트엔드 · React'],
  },
  {
    name: '수락',
    count: 2,
    color: '#A4F4FD',
    items: ['하린 — 프론트엔드 확정', '지훈 — 백엔드 확정'],
  },
  {
    name: '거절',
    count: 1,
    color: '#525252',
    items: ['정원 초과로 다음 기회에'],
  },
  {
    name: '팀 확정',
    count: 4,
    color: '#3182F6',
    items: ['오너 포함 4명 · FE 2 / BE 2', '모집 자동 마감'],
  },
];

export default function FeatureMatch() {
  return (
    <section className="relative z-20 max-w-6xl mx-auto px-6 py-16 md:py-24">
      <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-start">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <SectionEyebrow label="팀 빌딩" tag="지원 → 확정" />
          <h2 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight leading-[1.15]">
            DM 없이,
            <br />한 흐름으로 팀 확정.
          </h2>
          <p className="mt-6 text-white/60 text-base leading-[1.6] max-w-md">
            지원자의 분야와 스킬이 프로필로 함께 도착해요. 오너는 근거 있게 수락하고, 정원이 차면
            모집은 알아서 마감됩니다. 흩어진 슬랙 DM을 오가며 지원자를 놓칠 일이 없어요.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <span
                key={chip}
                className="text-xs text-white/70 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03]"
              >
                {chip}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="liquid-glass rounded-2xl p-5"
        >
          <p className="text-xs text-white/70">여행 기록 지도 서비스 · 지원자 관리</p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {buckets.map((bucket) => (
              <div key={bucket.name} className="liquid-glass rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: bucket.color }} />
                  <span className="text-xs font-medium text-white">{bucket.name}</span>
                  <span className="text-xs text-white/60">({bucket.count})</span>
                </div>
                <div className="mt-2.5 space-y-1.5">
                  {bucket.items.map((item) => (
                    <p key={item} className="text-[11px] text-white/70 leading-snug">
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
