import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';

/** 대표 이미지가 실제로 보여지는 비율. 카드·상세가 모두 이 비율을 씁니다. */
export const COVER_ASPECT = 16 / 9;
/** 저장할 이미지 크기 — 카드·상세 어디에 써도 선명하도록 넉넉하게 */
const OUTPUT_WIDTH = 1600;
const OUTPUT_HEIGHT = Math.round(OUTPUT_WIDTH / COVER_ASPECT);

const MAX_ZOOM = 4;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

type Props = {
  /** 편집할 원본 (파일 선택 시 objectURL, 기존 커버 다시 맞추기면 원격 URL) */
  src: string;
  /** 원격 이미지는 canvas 로 굽기 위해 CORS 허용이 필요합니다 */
  crossOrigin?: boolean;
  onCancel: () => void;
  onApply: (file: File) => void;
};

/**
 * 대표 이미지를 16:9 로 직접 잘라 내는 편집기.
 *
 * 잘린 결과를 그대로 구워서 저장하는 게 핵심입니다.
 * 원본을 그대로 두고 CSS 로만 맞추면, 카드·상세·화면 폭마다 보이는 영역이 달라져요.
 * 여기서 16:9 로 만들어 두면 어디서 보든 프레임과 사진 비율이 같아 잘릴 일이 없습니다.
 */
export default function CoverCropper({ src, crossOrigin = false, onCancel, onApply }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [frame, setFrame] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // 원본 크기 읽기 (canvas 로 구울 때도 이 엘리먼트를 그대로 씁니다)
  useEffect(() => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => setError('이미지를 불러오지 못했어요');
    img.src = src;
  }, [src, crossOrigin]);

  // 프레임 실제 크기 추적 (창 크기가 바뀌어도 계산이 어긋나지 않도록)
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setFrame({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 사진이 프레임을 항상 덮는 최소 배율
  const coverScale =
    natural && frame.w ? Math.max(frame.w / natural.w, frame.h / natural.h) : 1;
  const scale = coverScale * zoom;
  const shownW = natural ? natural.w * scale : 0;
  const shownH = natural ? natural.h * scale : 0;

  /** 사진이 프레임 밖으로 밀려나 빈 공간이 생기지 않도록 잡아 둡니다 */
  const clampOffset = (x: number, y: number) => ({
    x: clamp(x, frame.w - shownW, 0),
    y: clamp(y, frame.h - shownH, 0),
  });

  // 처음 열릴 때와 배율이 바뀔 때 가운데를 기준으로 다시 잡습니다
  useEffect(() => {
    if (!natural || !frame.w) return;
    setOffset((prev) => {
      if (prev.x === 0 && prev.y === 0) {
        return { x: (frame.w - shownW) / 2, y: (frame.h - shownH) / 2 };
      }
      return clampOffset(prev.x, prev.y);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural, frame.w, frame.h, scale]);

  const zoomAround = (nextZoom: number) => {
    const z = clamp(nextZoom, 1, MAX_ZOOM);
    if (!natural) return;
    // 프레임 중심을 고정한 채 확대/축소
    const nextScale = coverScale * z;
    const cx = frame.w / 2;
    const cy = frame.h / 2;
    const ratio = nextScale / scale;
    const nx = cx - (cx - offset.x) * ratio;
    const ny = cy - (cy - offset.y) * ratio;
    const nw = natural.w * nextScale;
    const nh = natural.h * nextScale;
    setZoom(z);
    setOffset({
      x: clamp(nx, frame.w - nw, 0),
      y: clamp(ny, frame.h - nh, 0),
    });
  };

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const moveDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    setOffset(clampOffset(d.ox + (e.clientX - d.px), d.oy + (e.clientY - d.py)));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const apply = () => {
    const img = imageRef.current;
    if (!img || !natural) return;
    setWorking(true);
    setError(null);

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('이 브라우저에서는 이미지를 자를 수 없어요');
      setWorking(false);
      return;
    }

    // 프레임에 보이는 영역을 원본 좌표로 되돌려 그대로 잘라 냅니다
    const sx = -offset.x / scale;
    const sy = -offset.y / scale;
    const sw = frame.w / scale;
    const sh = frame.h / scale;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

    canvas.toBlob(
      (blob) => {
        setWorking(false);
        if (!blob) {
          setError('이미지를 만들지 못했어요');
          return;
        }
        onApply(new File([blob], `cover-${Date.now()}.webp`, { type: 'image/webp' }));
      },
      'image/webp',
      0.92,
    );
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/12 bg-[#0f1218] p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">대표 이미지 맞추기</h2>
            <p className="mt-1 text-xs text-white/60">
              끌어서 옮기고, 확대해서 보여줄 부분을 정해 주세요
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-9 h-9 rounded-full border border-white/12 bg-white/5 grid place-items-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          ref={frameRef}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={(e) => zoomAround(zoom - e.deltaY * 0.0015)}
          className="relative mt-4 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-black touch-none cursor-grab active:cursor-grabbing"
        >
          {natural && (
            <img
              src={src}
              alt=""
              draggable={false}
              crossOrigin={crossOrigin ? 'anonymous' : undefined}
              className="absolute left-0 top-0 max-w-none select-none"
              style={{
                width: shownW,
                height: shownH,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
          {/* 카드에서 보이는 그대로라는 걸 알려주는 안내선 */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/20" />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => zoomAround(zoom - 0.2)}
            className="w-9 h-9 flex-shrink-0 rounded-full border border-white/12 bg-white/5 grid place-items-center text-white/70 hover:text-white transition-colors"
            aria-label="축소"
          >
            <Minus className="w-4 h-4" />
          </button>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => zoomAround(Number(e.target.value))}
            className="flex-1 accent-white"
            aria-label="확대 비율"
          />
          <button
            type="button"
            onClick={() => zoomAround(zoom + 0.2)}
            className="w-9 h-9 flex-shrink-0 rounded-full border border-white/12 bg-white/5 grid place-items-center text-white/70 hover:text-white transition-colors"
            aria-label="확대"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {error && <p className="mt-3 text-xs text-[#F04452]">{error}</p>}

        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-12 rounded-full border border-white/15 text-white/70 text-sm font-medium hover:bg-white/5 hover:text-white transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!natural || working}
            className="flex-1 h-12 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {working ? '자르는 중…' : '이대로 사용하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
