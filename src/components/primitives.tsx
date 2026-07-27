import { ChevronRight } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { ProjectStatus } from '../api';

export function GithubLogo({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/**
 * meeTeam 로고 — 두 사람(원)이 겹쳐 하나의 팀이 되는 형태.
 * 겹치는 영역이 밝게 빛나 "만나서 팀이 된다"는 의미를 담았습니다.
 */
export function LogoMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="none">
      <defs>
        <linearGradient id="mt-logo-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7db4ff" />
          <stop offset="100%" stopColor="#3182F6" />
        </linearGradient>
        <linearGradient id="mt-logo-b" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A4F4FD" />
          <stop offset="100%" stopColor="#00d2ff" />
        </linearGradient>
      </defs>
      {/* 왼쪽 원 */}
      <circle cx="12" cy="16" r="8" fill="url(#mt-logo-a)" opacity="0.9" />
      {/* 오른쪽 원 */}
      <circle cx="20" cy="16" r="8" fill="url(#mt-logo-b)" opacity="0.75" />
      {/* 겹치는 부분을 밝게 — 두 사람이 만나는 지점 */}
      <path
        d="M16 9.06A7.98 7.98 0 0 1 19.06 16 7.98 7.98 0 0 1 16 22.94 7.98 7.98 0 0 1 12.94 16 7.98 7.98 0 0 1 16 9.06Z"
        fill="#fff"
        opacity="0.92"
      />
    </svg>
  );
}

export function LogoMarkLegacy({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" fill="#fff" className={className} aria-hidden="true">
      <path d="M 0 128 C 70.692 128 128 185.308 128 256 L 64 256 C 64 220.654 35.346 192 0 192 Z M 256 192 C 220.654 192 192 220.654 192 256 L 128 256 C 128 185.308 185.308 128 256 128 Z M 128 0 C 128 70.692 70.692 128 0 128 L 0 64 C 35.346 64 64 35.346 64 0 Z M 192 0 C 192 35.346 220.654 64 256 64 L 256 128 C 185.308 128 128 70.692 128 0 Z" />
    </svg>
  );
}

export function GithubButton({
  label = 'GitHub으로 시작하기',
  full = false,
  onClick,
}: {
  label?: string;
  full?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group inline-flex items-center justify-center gap-2 rounded-full bg-white text-black font-medium text-sm px-5 py-3 transition-all hover:bg-white/90 active:scale-[0.98] ${
        full ? 'w-full' : ''
      }`}
    >
      <GithubLogo className="w-4 h-4" />
      <span>{label}</span>
      <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-[1px]" />
    </button>
  );
}

export function SectionEyebrow({
  label,
  tag,
  live = false,
}: {
  label: string;
  tag?: string;
  live?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-2 text-sm text-white/70">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          live ? 'bg-[#00C471] shadow-[0_0_8px_rgba(0,196,113,0.9)]' : 'bg-white'
        }`}
      />
      <span>{label}</span>
      {tag && (
        <span
          className={`rounded-full border px-2 py-0.5 text-xs ${
            live
              ? 'border-[#00C471]/35 bg-[#00C471]/10 text-[#8ee8b8]'
              : 'border-white/10 text-white/70'
          }`}
        >
          {tag}
        </span>
      )}
    </div>
  );
}

export const gradientStyle: CSSProperties = {
  backgroundImage:
    'linear-gradient(to right, #091020 0%, #0B2551 12.5%, #A4F4FD 32.5%, #3182F6 50%, #0B2551 67.5%, #091020 87.5%, #091020 100%)',
  backgroundSize: '200% auto',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  WebkitTextFillColor: 'transparent',
  filter: 'url(#c3-noise)',
};

/* ---------- Avatar (GitHub 사진 or 그라데이션 이니셜 폴백) ---------- */
export function Avatar({
  name,
  avatarUrl,
  gradient,
  className = 'w-9 h-9 text-xs',
}: {
  name?: string | null;
  avatarUrl?: string | null;
  gradient?: string;
  className?: string;
}) {
  const base = `rounded-full overflow-hidden flex items-center justify-center font-semibold text-white flex-shrink-0 ${className}`;
  if (avatarUrl) {
    return (
      <span className={base}>
        <img src={avatarUrl} alt={name ?? ''} className="w-full h-full object-cover" />
      </span>
    );
  }
  return <span className={`${base} bg-gradient-to-br ${gradient ?? 'from-[#3182F6] to-[#00d2ff]'}`}>{name?.slice(0, 1)}</span>;
}

/* ---------- 프로젝트 커버 이미지 ---------- */
export const COVER_GRADIENTS: Record<string, string> = {
  aurora: 'linear-gradient(135deg, #0B2551 0%, #3182F6 55%, #00d2ff 100%)',
  mint: 'linear-gradient(135deg, #052e2b 0%, #00C471 60%, #A4F4FD 100%)',
  ember: 'linear-gradient(135deg, #2d1200 0%, #FF8A00 55%, #be123c 100%)',
  dusk: 'linear-gradient(135deg, #17092e 0%, #6d28d9 55%, #0e7490 100%)',
  slate: 'linear-gradient(135deg, #0b1220 0%, #334155 60%, #94a3b8 100%)',
  ocean: 'linear-gradient(135deg, #041b2d 0%, #0e7490 55%, #67e8f9 100%)',
};

export const COVER_PRESETS = Object.keys(COVER_GRADIENTS);

/**
 * 커버를 부모 컨테이너에 채웁니다. `fade`가 있으면 아래쪽을 투명하게 마스킹해
 * 시네마틱 배경(고정 비디오)에 자연스럽게 녹아들게 합니다.
 */
export function CoverFill({ cover, fade = true }: { cover: string | null; fade?: boolean }) {
  if (!cover) return null;
  const isGradient = cover.startsWith('gradient:');

  // 사진은 선명하게 보여야 하므로 아래쪽 끝에서만 살짝 흐려지게 합니다.
  // (그라데이션 프리셋은 원래 장식이라 조금 더 일찍 fade 해도 자연스러움)
  const maskStyle: CSSProperties = fade
    ? (() => {
        const start = isGradient ? '55%' : '78%';
        const g = `linear-gradient(to bottom, #000 ${start}, transparent 100%)`;
        return { WebkitMaskImage: g, maskImage: g };
      })()
    : {};

  return (
    <div className="absolute inset-0 overflow-hidden" style={maskStyle} aria-hidden="true">
      {isGradient ? (
        <div
          className="absolute inset-0"
          style={{ backgroundImage: COVER_GRADIENTS[cover.slice(9)] ?? COVER_GRADIENTS.aurora }}
        />
      ) : (
        <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      {/* 뱃지 가독성을 위한 상단 그늘만 최소한으로. 사진 본체는 덮지 않습니다. */}
      <div
        className={`absolute inset-0 ${
          isGradient
            ? 'bg-gradient-to-b from-black/20 via-transparent to-[#0c0c0c]/60'
            : 'bg-gradient-to-b from-black/35 via-transparent to-[#0c0c0c]/25'
        }`}
      />
    </div>
  );
}

/** 좌상단 로고 — 누르면 홈으로 */
export function HomeLogo({ className = '' }: { className?: string }) {
  return (
    <a
      href="/"
      className={`flex items-center gap-2.5 hover:opacity-80 transition-opacity ${className}`}
      aria-label="meeTeam 홈으로"
    >
      <LogoMark className="w-7 h-7" />
      <span className="text-[17px] font-bold tracking-tight">meeTeam</span>
    </a>
  );
}

/* ---------- 프로젝트 상태 배지 ----------
 * 카드 목록에서 상태를 한 눈에 구분합니다. 승인 대기(PENDING)를 '모집 마감'으로
 * 뭉뚱그리지 않는 것이 핵심 — 오너에게만 보이는 승인 전 상태입니다.
 */
export const PROJECT_STATUS_BADGE: Record<ProjectStatus, { label: string; cls: string }> = {
  PENDING: { label: '승인 대기', cls: 'border-[#FFB020]/50 text-[#ffd899] bg-[#7a4a00]/60' },
  REJECTED: { label: '반려됨', cls: 'border-white/25 text-white/75 bg-black/55' },
  RECRUITING: { label: '● 모집중', cls: 'border-[#00C471]/60 text-[#9df0c4] bg-[#065f39]/70' },
  CLOSED: { label: '모집 마감', cls: 'border-white/25 text-white/80 bg-black/55' },
  CONFIRMED: { label: '✓ 팀 확정', cls: 'border-[#00C471]/60 text-[#9df0c4] bg-[#065f39]/70' },
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const badge = PROJECT_STATUS_BADGE[status] ?? PROJECT_STATUS_BADGE.CLOSED;
  return (
    <span
      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-md border ${badge.cls}`}
    >
      {badge.label}
    </span>
  );
}
