import type { Slot } from '../api';
import { FIELD_SHORT } from '../api';

const fieldTone = (field: string) => {
  if (field === '프론트엔드') return 'project-card__slot--frontend';
  if (field === '백엔드') return 'project-card__slot--backend';
  if (field === '안드로이드') return 'project-card__slot--android';
  return 'project-card__slot--default';
};

/** 모집 현황은 카드가 어디에 놓이든 같은 모양이어야 해서 한 곳에 둡니다 */
export default function ProjectSlots({ slots }: { slots: Slot[] }) {
  return (
    <div className="project-card__slots" aria-label="모집 현황">
      {slots.map((slot) => (
        <span key={slot.field} className={`project-card__slot ${fieldTone(slot.field)}`}>
          {FIELD_SHORT[slot.field] ?? slot.field} 모집 {slot.confirmed}/{slot.capacity}
        </span>
      ))}
    </div>
  );
}
