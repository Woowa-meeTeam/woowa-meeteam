import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import type { Project, ProjectStatus } from '../api';
import { FIELD_SHORT } from '../api';
import { Avatar, CoverFill } from './primitives';

const easeOut = [0.22, 1, 0.36, 1] as const;

const STATUS_LABEL: Record<ProjectStatus, string> = {
  PENDING: '승인 대기',
  REJECTED: '반려됨',
  RECRUITING: '모집중',
  CLOSED: '모집 마감',
  CONFIRMED: '팀 확정',
};

const fieldTone = (field: string) => {
  if (field === '프론트엔드') return 'project-card__slot--frontend';
  if (field === '백엔드') return 'project-card__slot--backend';
  if (field === '안드로이드') return 'project-card__slot--android';
  return 'project-card__slot--default';
};

type Props = {
  project: Project;
  index: number;
  onClick: () => void;
  animateOnView?: boolean;
};

export default function ProjectCard({
  project,
  index,
  onClick,
  animateOnView = false,
}: Props) {
  const [imageShape, setImageShape] = useState<'wide' | 'compact' | null>(null);
  const isUploadedImage =
    Boolean(project.coverImage) && !project.coverImage?.startsWith('gradient:');
  const usesBrowserFrame = isUploadedImage && imageShape === 'wide';
  const usesLogoStage = isUploadedImage && imageShape === 'compact';
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
      <div className="project-card__media">
        <div
          className={`project-card__visual ${
            usesBrowserFrame ? 'project-card__visual--browser' : ''
          } ${usesLogoStage ? 'project-card__visual--logo' : ''}`}
        >
          {usesBrowserFrame && (
            <div className="project-card__browser-bar" aria-hidden="true">
              <span />
              <span />
              <span />
              <i />
            </div>
          )}
          <div className="project-card__cover">
            <CoverFill
              cover={project.coverImage}
              fade={false}
              onImageLoad={(width, height) =>
                setImageShape(width / height >= 1.25 ? 'wide' : 'compact')
              }
            />
          </div>
        </div>

        <span
          className={`project-card__status project-card__status--${project.status.toLowerCase()}`}
        >
          <i aria-hidden="true" />
          {STATUS_LABEL[project.status]}
        </span>
      </div>

      <div className="project-card__body">
        <div>
          <h3>{project.title}</h3>
          <p className="project-card__description">{description}</p>
        </div>

        <div className="project-card__slots" aria-label="모집 현황">
          {project.slots.map((slot) => (
            <span
              key={slot.field}
              className={`project-card__slot ${fieldTone(slot.field)}`}
            >
              {FIELD_SHORT[slot.field] ?? slot.field} 모집 {slot.confirmed}/{slot.capacity}
            </span>
          ))}
        </div>

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
