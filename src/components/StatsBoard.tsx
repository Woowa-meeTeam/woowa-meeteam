import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { api } from '../api';
import type { Project } from '../api';

const easeOut = [0.22, 1, 0.36, 1] as const;

function ShuffleNumber({ value, delay = 0 }: { value: number; delay?: number }) {
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    setDisplay('0');
    if (value === 0) return;

    let current = 0;
    let startTimer: ReturnType<typeof setTimeout> | undefined;
    let countTimer: ReturnType<typeof setTimeout> | undefined;
    const stepMs = value > 50 ? 12 : 30;

    const step = () => {
      current += 1;
      setDisplay(String(current));
      if (current < value) countTimer = setTimeout(step, stepMs);
    };

    startTimer = setTimeout(step, delay);
    return () => {
      if (startTimer) clearTimeout(startTimer);
      if (countTimer) clearTimeout(countTimer);
    };
  }, [delay, value]);

  return (
    <span className="text-2xl font-bold tabular-nums" aria-label={String(value)}>
      {display}
    </span>
  );
}

type Stats = {
  recruiting: number;
  closed: number;
  confirmed: number;
  /** 아직 채워지지 않은 자리 수 — 모집중인 프로젝트만 셉니다 */
  openSeats: number;
};

function summarize(projects: Project[]): Stats {
  const stats: Stats = { recruiting: 0, closed: 0, confirmed: 0, openSeats: 0 };
  for (const p of projects) {
    if (p.status === 'RECRUITING') {
      stats.recruiting += 1;
      for (const slot of p.slots) {
        stats.openSeats += Math.max(0, slot.capacity - slot.confirmed);
      }
    } else if (p.status === 'CLOSED') {
      stats.closed += 1;
    } else if (p.status === 'CONFIRMED') {
      stats.confirmed += 1;
    }
  }
  return stats;
}

/**
 * 지금 팀 빌딩이 어디까지 왔는지 한 줄로 보여 줍니다.
 *
 * 승인 대기(PENDING)·반려(REJECTED)는 오너와 코치에게만 보이는 상태라 세지 않습니다.
 * 보는 사람에 따라 숫자가 달라지면 "현황"이라는 말이 무색해지니까요.
 */
export default function StatsBoard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api
      .projects()
      .then((projects) => setStats(summarize(projects)))
      .catch(() => setStats(null));
  }, []);

  if (!stats) return null;

  const items = [
    { label: '모집중', value: stats.recruiting, unit: '개', tone: 'text-[#9df0c4]' },
    { label: '모집 마감', value: stats.closed, unit: '개', tone: 'text-white/80' },
    { label: '결성된 팀', value: stats.confirmed, unit: '팀', tone: 'text-[#7db4ff]' },
    { label: '남은 자리', value: stats.openSeats, unit: '명', tone: 'text-[#ffd899]' },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: easeOut }}
      className="relative z-20 w-full max-w-2xl mx-auto mt-8 px-2"
      aria-label="현재 팀 빌딩 현황"
    >
      <div className="text-center">
        <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
          <h2 className="text-sm font-semibold text-white">지금 팀 빌딩 현황</h2>
          <p className="text-xs text-white/55">
            누가 어디에 지원했는지는 공개하지 않아요. 인원수만 공개합니다.
          </p>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
          {items.map((item, index) => (
            <div key={item.label}>
              <dt className="text-xs text-white/60">{item.label}</dt>
              <dd className={`mt-1 flex items-baseline justify-center gap-1 ${item.tone}`}>
                <ShuffleNumber value={item.value} delay={index * 55} />
                <span className="text-xs text-white/50">{item.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </motion.section>
  );
}
