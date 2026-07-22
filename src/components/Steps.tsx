import { Check } from 'lucide-react';

type Step = {
  label: string;
  title: string;
  desc: string;
  features: string[];
  highlight?: boolean;
};

const steps: Step[] = [
  {
    label: 'STEP 1',
    title: '등록',
    desc: '아이디어가 있다면 3분 만에 모집 글을 올려요.',
    features: [
      '프로젝트명 · 설명 입력',
      'Figma 프로토타입 첨부',
      '분야별 모집 인원 설정',
      '마크다운 설명 지원',
      '등록 즉시 탐색 피드에 노출',
    ],
  },
  {
    label: 'STEP 2',
    title: '지원',
    desc: '마음에 드는 프로젝트에 각오 한 줄과 함께 지원해요.',
    features: [
      '한 줄 각오 메시지 작성',
      '분야 · 스킬 프로필 자동 공유',
      '프로젝트당 1회 지원',
      '확정 전까지 지원 취소 가능',
      '지원 상태 실시간 확인',
    ],
  },
  {
    label: 'STEP 3',
    title: '확정',
    desc: '오너가 수락하면 팀 멤버로 확정 — 바로 시작해요.',
    features: [
      '지원자 프로필 보고 수락 · 거절',
      '분야 정원 내 수락 보장',
      '확정 멤버 팀 페이지 표시',
      '정원 충족 시 자동 마감',
      '팀 구성 완료 알림',
    ],
    highlight: true,
  },
];

export default function Steps() {
  return (
    <section className="c3-pricing-section relative z-20">
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="c3-noise-watermark">
          <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves={2} stitchTiles="stitch" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.075" />
          </feComponentTransfer>
          <feComposite in2="SourceGraphic" operator="in" result="noise" />
          <feBlend in="SourceGraphic" in2="noise" mode="overlay" />
        </filter>
      </svg>

      <div className="c3-watermark-container">
        <div className="c3-watermark-main">
          <span className="c3-watermark-line-1">등록, 지원,</span>
          <span className="c3-watermark-line-2">그리고 확정</span>
        </div>
      </div>

      <div className="c3-grid">
        {steps.map((step) => (
          <div key={step.title} className={`c3-card ${step.highlight ? 'c3-card-pro' : ''}`}>
            <div className="c3-tier-small">{step.label}</div>
            <div className="c3-tier-large">{step.title}</div>
            <p className="c3-desc">{step.desc}</p>
            <ul className="c3-list">
              {step.features.map((f) => (
                <li key={f}>
                  <span className="c3-check">
                    <Check className="w-3.5 h-3.5" color="#fff" strokeWidth={3} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <button className="c3-btn">자세히 보기</button>
          </div>
        ))}
      </div>
    </section>
  );
}
