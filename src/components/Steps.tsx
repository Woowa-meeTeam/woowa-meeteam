import { Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type Step = {
  /** 요일 · 시간 */
  label: string;
  title: string;
  desc: string;
  features: string[];
  highlight?: boolean;
  /** '자세히 보기' 목적지 — 'explore' 는 쇼케이스로 스크롤 */
  action: { label: string; to: string };
};

/** 달력 한 칸 = 하루. 요일 순서(월~일)대로 두 주에 걸쳐 놓습니다. */
type CalendarEvent = { label: string; time?: string; deadline?: boolean };
type CalendarDay = {
  /** ISO 날짜 — '오늘' 표시를 런타임에 계산하기 위해 */
  iso: string;
  day: number;
  weekday: string;
  weekend?: boolean;
  /** 이 주의 하이라이트 (오프라인 박람회) */
  key?: boolean;
  events: CalendarEvent[];
};

const calendar: CalendarDay[] = [
  { iso: '2026-07-27', day: 27, weekday: '월', events: [] },
  {
    iso: '2026-07-28',
    day: 28,
    weekday: '화',
    events: [{ label: '기획 문서 1차 제출', time: '23:59까지', deadline: true }],
  },
  {
    iso: '2026-07-29',
    day: 29,
    weekday: '수',
    events: [
      { label: '온라인 기획 전시 시작', time: '10:00 ~' },
      { label: '구인 · 구직 시작' },
    ],
  },
  {
    iso: '2026-07-30',
    day: 30,
    weekday: '목',
    key: true,
    events: [
      { label: '오프라인 프로젝트 박람회', time: '15:00 ~ 17:00 · 11층' },
      { label: '기획 문서 제출 마감', time: '23:59까지', deadline: true },
    ],
  },
  {
    iso: '2026-07-31',
    day: 31,
    weekday: '금',
    events: [{ label: '팀 결성 마감', time: '23:59까지', deadline: true }],
  },
  { iso: '2026-08-01', day: 1, weekday: '토', weekend: true, events: [] },
  { iso: '2026-08-02', day: 2, weekday: '일', weekend: true, events: [] },
  {
    iso: '2026-08-03',
    day: 3,
    weekday: '월',
    events: [{ label: '4주차 커리큘럼 시작' }],
  },
];

const steps: Step[] = [
  {
    label: '수요일 10:00 ~ 금요일 23:59',
    title: '온라인 기획 전시',
    desc: '내 아이디어를 올려 홍보하고, 함께할 사람을 찾는 구인·구직이 여기서 시작돼요.',
    features: [
      '코치에게 승인받은 아이디어를 등록',
      '서비스 관리자 승인 후 목록에 게시',
      '분야별 모집 인원 · 원하는 스택 공개',
      '마음에 드는 아이디어에 바로 지원',
      '박람회 전에 미리 찜해 두기',
    ],
    action: { label: '프로젝트 등록하기', to: '/projects/new' },
  },
  {
    label: '목요일 15:00 ~ 17:00 · 11층',
    title: '오프라인 박람회',
    desc: '부스를 자유롭게 돌며 아이디어 이야기를 듣고, 함께하고 싶은 팀을 고르는 자리예요.',
    features: [
      '11층 부스에서 진행 (12층 확장 가능)',
      '부스 지도로 팀 위치 미리 확인',
      '구인자는 하고 싶은 주제를 어필',
      '구직자는 발표를 듣고 아이디어 선택',
      '온라인에서 본 팀을 직접 만나기',
    ],
    highlight: true,
    action: { label: '부스 지도 보기', to: '/booths' },
  },
  {
    label: '금요일 23:59 마감',
    title: '팀 결성',
    desc: '오너가 지원자를 수락해 정원을 채우고 팀을 확정하면 끝. 월요일부터 4주차가 시작돼요.',
    features: [
      '지원자 프로필 · 각오를 보고 수락',
      '분야 정원이 다 차면 팀 확정',
      '확정되면 한 크루는 한 팀에만 소속',
      '미선택 지원자는 자동으로 마감 처리',
      '8/3(월) 4주차 커리큘럼 시작',
    ],
    action: { label: '내 프로젝트 보기', to: '/my' },
  },
];

/** 아이디어 하나가 팀이 되기까지 거치는 단계 */
const pipeline: { step: string; who: string }[] = [
  { step: '코치 승인', who: '아이디어를 코치에게 확인받아요' },
  { step: 'meeTeam 등록', who: '크루가 프로젝트를 등록해요' },
  { step: '관리자 승인 · 게시', who: '서비스 관리자가 승인하면 공개돼요' },
  { step: '모집', who: '전시·박람회에서 팀원을 찾아요' },
  { step: '지원', who: '함께하고 싶은 크루가 지원해요' },
  { step: '모집 마감', who: '정원이 차면 모집을 닫아요' },
  { step: '팀 결성', who: '오너가 팀을 확정하면 완료' },
];

const rules: { title: string; body: string }[] = [
  {
    title: '아이디어는 여러 번, 하지만 한 번에 하나만',
    body:
      '아이디어는 몇 번이든 제출할 수 있지만 한 타임에는 하나만 들고 있을 수 있어요. 하나로 크루를 모아 보고, 모이지 않으면 폐기한 뒤 다른 아이디어로 다시 승인·피드백을 받아 재도전하면 돼요.',
  },
  {
    title: '한 크루는 하나의 확정 팀에만',
    body:
      '팀이 확정되면 다른 프로젝트에 낸 지원은 자동으로 정리되고, 이미 팀이 있으면 새로 지원하거나 수락될 수 없어요.',
  },
  {
    title: '지원은 프로젝트당 한 번',
    body:
      '확정되기 전까지는 지원을 취소하고 다시 지원할 수 있어요. 내 분야 · 스킬 프로필은 지원과 함께 오너에게 전달돼요.',
  },
];

/** 로컬 기준 오늘 날짜를 'YYYY-MM-DD' 로 (toISOString 은 UTC 라 하루 밀릴 수 있어요) */
function localIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function Steps() {
  const navigate = useNavigate();
  const todayIso = localIsoDate(new Date());

  const go = (to: string) => {
    if (to === 'explore') {
      document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    navigate(to);
  };

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
          <span className="c3-watermark-line-1">팀 빌딩은</span>
          <span className="c3-watermark-line-2">이렇게 흘러가요</span>
        </div>
        <p className="mt-6 text-sm md:text-base text-white/75 leading-[1.7]">
          아이디어를 등록해 승인을 받고, 온라인 전시에서 팀원을 모으고, 박람회에서 직접 이야기를 나눈 뒤,
          <br className="hidden md:block" />
          금요일 자정까지 팀을 결성하는 흐름이에요.
        </p>
      </div>

      {/* 이번 주 일정 달력 */}
      <div className="w-full max-w-[1100px] mt-12 px-1">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-semibold tracking-tight text-white">2026년 7~8월 일정</h3>
          <div className="flex items-center gap-3 text-[11px] text-white/60">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00C471]" />
              진행
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#FFB020]" />
              마감
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {calendar.map((d) => {
            const isToday = d.iso === todayIso;
            return (
              <div
                key={d.iso}
                className={`rounded-2xl border p-3 min-h-[132px] flex flex-col text-left transition-colors ${
                  d.key
                    ? 'border-[#00C471]/45 bg-[#065f39]/25'
                    : d.weekend
                      ? 'border-white/8 bg-white/[0.02]'
                      : 'border-white/12 bg-white/[0.05]'
                } ${isToday ? 'ring-1 ring-white/60' : ''}`}
              >
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`text-xl font-bold tabular-nums leading-none ${
                      d.weekend ? 'text-white/40' : 'text-white'
                    }`}
                  >
                    {d.day}
                  </span>
                  <span
                    className={`text-[11px] font-medium ${
                      d.weekday === '토' ? 'text-[#7db4ff]' : d.weekday === '일' ? 'text-[#ff8f9c]' : 'text-white/60'
                    }`}
                  >
                    {d.weekday}
                  </span>
                  {isToday && (
                    <span className="ml-auto text-[10px] font-semibold text-black bg-white rounded-full px-1.5 py-0.5">
                      오늘
                    </span>
                  )}
                </div>

                <div className="mt-2.5 flex flex-col gap-1.5">
                  {d.events.map((e) => (
                    <div
                      key={e.label}
                      className={`rounded-lg px-2 py-1.5 border-l-2 ${
                        e.deadline
                          ? 'border-l-[#FFB020] bg-[#FFB020]/10'
                          : 'border-l-[#00C471] bg-[#00C471]/10'
                      }`}
                    >
                      <p className="text-[11px] font-semibold text-white leading-[1.35]">{e.label}</p>
                      {e.time && (
                        <p
                          className={`mt-0.5 text-[10px] tabular-nums leading-tight ${
                            e.deadline ? 'text-[#ffd899]' : 'text-white/65'
                          }`}
                        >
                          {e.time}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
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
            <button className="c3-btn" onClick={() => go(step.action.to)}>
              {step.action.label}
            </button>
          </div>
        ))}
      </div>

      {/* 아이디어 → 팀 파이프라인 */}
      <div className="w-full max-w-[1100px] mt-20 px-1">
        <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-center">
          아이디어 하나가 팀이 되기까지
        </h3>
        <p className="mt-3 text-sm text-white/70 text-center leading-[1.7]">
          meeTeam 안에서 프로젝트는 아래 순서대로 움직여요.
        </p>

        <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {pipeline.map((p, i) => (
            <li key={p.step} className="liquid-glass rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-white/15 text-[11px] font-bold text-white grid place-items-center tabular-nums">
                  {i + 1}
                </span>
                <span className="text-sm font-semibold text-white">{p.step}</span>
              </div>
              <p className="mt-2 text-xs text-white/70 leading-[1.6]">{p.who}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* 규칙 */}
      <div className="w-full max-w-[1100px] mt-14 px-1">
        <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-center">
          꼭 알아야 할 규칙
        </h3>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {rules.map((r) => (
            <div key={r.title} className="liquid-glass rounded-2xl p-5">
              <h4 className="text-sm font-semibold text-white leading-snug">{r.title}</h4>
              <p className="mt-2.5 text-[13px] text-white/70 leading-[1.7]">{r.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
