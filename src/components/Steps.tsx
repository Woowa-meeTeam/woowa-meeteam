import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';

type ScheduleItem = {
  day: string;
  weekday: string;
  time: string;
  title: string;
  desc: string;
  tone: 'amber' | 'blue' | 'green';
  action: { label: string; to: string };
};

const schedule: ScheduleItem[] = [
  {
    day: '28',
    weekday: '화',
    time: '23:59 마감',
    title: '기획 문서 제출',
    desc: '승인받은 아이디어를 온라인 전시에 등록할 준비를 마쳐요.',
    tone: 'amber',
    action: { label: '프로젝트 등록하기', to: '/projects/new' },
  },
  {
    day: '29',
    weekday: '수',
    time: '10:00 시작',
    title: '온라인 기획 전시',
    desc: '아이디어를 공개하고 함께할 크루를 찾기 시작해요.',
    tone: 'blue',
    action: { label: '프로젝트 둘러보기', to: '/projects' },
  },
  {
    day: '30',
    weekday: '목',
    time: '15:00–17:00 · 11층',
    title: '오프라인 박람회',
    desc: '박람회에서 팀을 만나고, 기획 문서는 23:59까지 마무리해요.',
    tone: 'green',
    action: { label: '부스 지도 보기', to: '/booths' },
  },
  {
    day: '31',
    weekday: '금',
    time: '23:59 마감',
    title: '팀 결성',
    desc: '오너가 지원자를 수락하고 최종 팀을 확정해요.',
    tone: 'amber',
    action: { label: '내 프로젝트 보기', to: '/my' },
  },
];

/** 세부 절차를 사용자가 판단하기 쉬운 네 단계로 묶습니다. */
const pipeline: { sequence: string; title: string; desc: string }[] = [
  {
    sequence: '코치 승인 → 등록',
    title: '아이디어 승인',
    desc: '코치 확인 후 프로젝트를 등록해요.',
  },
  {
    sequence: '관리자 승인 → 게시',
    title: '프로젝트 공개',
    desc: '승인이 끝나면 목록에 공개돼요.',
  },
  {
    sequence: '모집 → 지원',
    title: '팀원 찾기',
    desc: '전시와 박람회에서 함께할 크루를 찾아요.',
  },
  {
    sequence: '모집 마감 → 확정',
    title: '팀 결성',
    desc: '정원을 채우고 오너가 팀을 확정해요.',
  },
];

function ScrollFocusItem({
  id,
  active,
  className,
  markerTone,
  children,
}: {
  id: string;
  active: boolean;
  className: string;
  markerTone?: ScheduleItem['tone'];
  children: ReactNode;
}) {
  return (
    <li
      data-team-flow-item={id}
      className={`team-flow__focus-row ${
        markerTone ? `team-flow__focus-row--${markerTone}` : ''
      } ${active ? 'team-flow__focus-row--active' : ''}`}
    >
      <div
        className={`${className} team-flow__focus-item ${
          active ? 'team-flow__focus-item--active' : ''
        }`}
      >
        {children}
      </div>
    </li>
  );
}

export default function Steps() {
  const navigate = useNavigate();
  const [activeFocusId, setActiveFocusId] = useState('process-0');

  useEffect(() => {
    let frame = 0;

    const updateActiveCard = () => {
      frame = 0;
      const viewportCenter = window.innerHeight / 2;
      const items = Array.from(
        document.querySelectorAll<HTMLElement>('[data-team-flow-item]'),
      );
      const closest = items.reduce<{ id: string; distance: number } | null>((best, item) => {
        const rect = item.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter);
        const id = item.dataset.teamFlowItem;
        if (!id || (best && best.distance <= distance)) return best;
        return { id, distance };
      }, null);

      if (closest) setActiveFocusId((current) => (current === closest.id ? current : closest.id));
    };

    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateActiveCard);
    };

    updateActiveCard();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section className="team-flow relative z-20">
      {/* 지원 프로세스 */}
      <section className="team-flow__chapter" aria-labelledby="support-process-title">
        <motion.div
          className="team-flow__chapter-copy"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.45 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="team-flow__chapter-number">01</span>
          <h2 id="support-process-title">지원<br />프로세스</h2>
          <p>아이디어 승인부터 팀 확정까지,<br />필요한 네 단계만 확인하세요.</p>
        </motion.div>

        <ol className="team-flow__rail">
          {pipeline.map((phase, index) => (
            <ScrollFocusItem
              key={phase.title}
              id={`process-${index}`}
              active={activeFocusId === `process-${index}`}
              className="team-flow__process-card"
            >
              <div className="team-flow__step-meta">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <span>{phase.sequence}</span>
              </div>
              <h3>{phase.title}</h3>
              <p>{phase.desc}</p>
            </ScrollFocusItem>
          ))}
        </ol>
      </section>

      {/* 주요 일정 */}
      <section className="team-flow__chapter team-flow__chapter--schedule" aria-labelledby="schedule-title">
        <motion.div
          className="team-flow__chapter-copy"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.45 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="team-flow__chapter-number">02</span>
          <h2 id="schedule-title">주요<br />일정</h2>
          <p>2026년 7월 28–31일<br />날짜별 핵심 일정이에요.</p>
        </motion.div>

        <ol className="team-flow__rail team-flow__schedule-rail">
          {schedule.map((item) => (
            <ScrollFocusItem
              key={item.day}
              id={`schedule-${item.day}`}
              active={activeFocusId === `schedule-${item.day}`}
              className={`team-flow__schedule-card team-flow__schedule-card--${item.tone}`}
              markerTone={item.tone}
            >
              <time dateTime={`2026-07-${item.day}`} className="team-flow__date">
                <span>{item.weekday}요일</span>
                <strong>{item.day}일</strong>
              </time>
              <div className="team-flow__event">
                <span>{item.time}</span>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
                <button type="button" onClick={() => navigate(item.action.to)}>
                  {item.action.label}
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </ScrollFocusItem>
          ))}
        </ol>
      </section>

      <motion.section
        className="team-flow__explore"
        initial={{ opacity: 0, y: 48, scale: 0.98 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        aria-labelledby="explore-projects-title"
      >
        <h2 id="explore-projects-title">
          혼자 고민하던 아이디어,
          <br />
          오늘 팀이 됩니다.
        </h2>
        <p>함께할 크루들이 기다리고 있어요.</p>
        <button type="button" onClick={() => navigate('/projects')}>
          프로젝트 둘러보기
          <span aria-hidden="true">›</span>
        </button>
      </motion.section>
    </section>
  );
}
