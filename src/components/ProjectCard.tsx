import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import type { Project, ProjectStatus } from '../api';
import { Avatar, CoverFill } from './primitives';
import ProjectSlots from './ProjectSlots';

const easeOut = [0.22, 1, 0.36, 1] as const;

const STATUS_LABEL: Record<ProjectStatus, string> = {
  PENDING: '승인 대기',
  REJECTED: '반려됨',
  RECRUITING: '모집중',
  CLOSED: '모집 마감',
  CONFIRMED: '팀 확정',
};

type Props = {
  project: Project;
  index: number;
  onClick: () => void;
  animateOnView?: boolean;
  /** 모집 상태 아래에 함께 세울 배지 (마이페이지의 내 지원 상태 등) */
  badge?: ReactNode;
};

export default function ProjectCard({
  project,
  index,
  onClick,
  animateOnView = false,
  badge,
}: Props) {
  const description = project.summary?.trim() || project.desc;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 18 }}
      {...(animateOnView
        ? {
            whileInView: { opacity: 1, y: 0 },
            viewport: { once: true, margin: '-60px' },
          }
        : { animate: { opacity: 1, y: 0 } })}
      transition={{ duration: 0.55, delay: (index % 6) * 0.055, ease: easeOut }}
      className={`project-card ${project.closed ? 'project-card--closed' : ''}`}
    >
      {/* 대표 이미지는 카드 폭을 그대로 채웁니다.
          예전엔 사진 비율에 따라 브라우저 창·로고 받침을 덧씌워서 카드 안에 카드가 있는 모양이었어요.
          비율이 안 맞아 잘리는 문제는 등록할 때 보여줄 위치를 직접 잡는 쪽으로 해결합니다. */}
      <div className="project-card__media">
        <CoverFill cover={project.coverImage} fade={false} />

        <div className="project-card__badges">
          <span
            className={`project-card__status project-card__status--${project.status.toLowerCase()}`}
          >
            <i aria-hidden="true" />
            {STATUS_LABEL[project.status]}
          </span>
          {badge}
        </div>

        {project.category && (
          <span className="project-card__category">{project.category}</span>
        )}
      </div>

      <div className="project-card__body">
        <div>
          <h3>{project.title}</h3>
          <p className="project-card__description">{description}</p>
        </div>

        <ProjectSlots slots={project.slots} />

        <div className="project-card__footer">
          <div className="project-card__owner">
            <Avatar
              name={project.owner?.name}
              avatarUrl={project.owner?.avatarUrl}
              gradient={project.owner?.avatarGradient}
              className="w-9 h-9 text-[11px]"
            />
            <span>
              <strong>{project.owner?.name ?? 'meeTeam 크루'}</strong>
              {project.owner?.field && <small> · {project.owner.field}</small>}
            </span>
          </div>
          <span className="project-card__arrow" aria-hidden="true">
            <ArrowRight />
          </span>
        </div>
      </div>
    </motion.button>
  );
}
