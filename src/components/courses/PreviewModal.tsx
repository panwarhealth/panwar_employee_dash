import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { RotateCw, X } from 'lucide-react';
import { layoutsFor } from '@/course/canvasLayout';
import type { CourseDoc, Layout } from '@/course/doc';
import { Player } from '@/course/Player';
import { memoryLms, type Lms } from '@/course/scorm';

interface Device {
  id: string;
  label: string;
  w: number;
  h: number;
  turns: boolean;
}

const DEVICES: Device[] = [
  { id: 'fit', label: 'Fit window', w: 0, h: 0, turns: false },
  { id: 'iphone-se', label: 'iPhone SE (375 x 667)', w: 375, h: 667, turns: true },
  { id: 'iphone-15', label: 'iPhone 15 (393 x 852)', w: 393, h: 852, turns: true },
  { id: 'iphone-15-pro-max', label: 'iPhone 15 Pro Max (430 x 932)', w: 430, h: 932, turns: true },
  { id: 'galaxy-s24', label: 'Samsung Galaxy S24 (360 x 780)', w: 360, h: 780, turns: true },
  { id: 'pixel-8', label: 'Google Pixel 8 (412 x 915)', w: 412, h: 915, turns: true },
  { id: 'ipad-mini', label: 'iPad mini (744 x 1133)', w: 744, h: 1133, turns: true },
  { id: 'ipad-air', label: 'iPad Air (820 x 1180)', w: 820, h: 1180, turns: true },
  { id: 'ipad-pro', label: 'iPad Pro 12.9" (1024 x 1366)', w: 1024, h: 1366, turns: true },
  { id: 'laptop', label: 'Laptop (1366 x 768)', w: 1366, h: 768, turns: false },
  { id: 'desktop', label: 'Desktop (1920 x 1080)', w: 1920, h: 1080, turns: false },
];

const DEVICE_KEY = 'course-editor.preview-device';

function readDevice(layout: Layout): string {
  try {
    const saved = localStorage.getItem(`${DEVICE_KEY}.${layout}`);
    if (saved && DEVICES.some((d) => d.id === saved)) return saved;
  } catch {
    return layout === 'phone' ? 'iphone-15' : 'fit';
  }
  return layout === 'phone' ? 'iphone-15' : 'fit';
}

export function PreviewModal({
  doc,
  startPageId,
  layout,
  onClose,
}: {
  doc: CourseDoc;
  startPageId: string;
  layout: Layout;
  onClose: () => void;
}) {
  const lms = useMemo<Lms>(() => {
    const mem = memoryLms(null);
    return {
      ...mem,
      load: () => mem.load() ?? { v: 1, pageId: startPageId, visited: [], answers: {} },
    };
  }, [startPageId]);
  const [deviceId, setDeviceId] = useState(() => readDevice(layout));
  const [turned, setTurned] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const el = area.current!;
    const measure = () => setRoom({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const device = DEVICES.find((d) => d.id === deviceId) ?? DEVICES[0];
  const fit = device.id === 'fit';
  const sideways = device.turns && turned;
  const w = sideways ? device.h : device.w;
  const h = sideways ? device.w : device.h;
  const scale = fit || !room.w ? 1 : Math.min(1, room.w / w, room.h / h);
  const layouts = layoutsFor(doc.screens);
  const shown: Layout = fit
    ? layout
    : layouts.includes(h > w ? 'phone' : 'desktop')
      ? h > w
        ? 'phone'
        : 'desktop'
      : layouts[0];

  const pick = (id: string) => {
    setDeviceId(id);
    setTurned(false);
    try {
      localStorage.setItem(`${DEVICE_KEY}.${layout}`, id);
    } catch {
      return;
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-white">
        <span className="mr-auto">Preview - answers and progress are not saved</span>
        <select
          value={device.id}
          onChange={(e) => pick(e.target.value)}
          className="h-9 rounded-full border-0 bg-white/15 px-3 text-sm text-white focus:outline-none [&>option]:text-ph-charcoal"
        >
          {DEVICES.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
        {device.turns && (
          <button
            type="button"
            onClick={() => setTurned((t) => !t)}
            className="flex h-9 items-center gap-1.5 rounded-full bg-white/15 px-3 hover:bg-white/25"
          >
            <RotateCw className="h-4 w-4" />
            {sideways ? 'Landscape' : 'Portrait'}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          title="Close preview (Esc)"
          className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 font-semibold text-ph-charcoal shadow-md hover:bg-ph-purple hover:text-white"
        >
          <X className="h-4 w-4" />
          Close preview
        </button>
      </div>
      <div ref={area} className="relative flex min-h-0 flex-1 justify-center">
        {fit ? (
          <div
            className={`mx-auto w-full overflow-y-auto rounded-md bg-white [&_.cp-shell]:min-h-full ${layout === 'phone' ? 'max-w-[390px]' : 'max-w-[1100px]'}`}
          >
            <Player doc={doc} lms={lms} layout={layout} />
          </div>
        ) : (
          <div style={{ width: w * scale, height: h * scale }}>
            <div
              key={`${device.id}-${sideways}`}
              className="origin-top-left overflow-y-auto rounded-md bg-white [&_.cp-shell]:min-h-full"
              style={
                {
                  width: w,
                  height: h,
                  transform: `scale(${scale})`,
                  '--cp-vh': `${h}px`,
                } as CSSProperties
              }
            >
              <Player doc={doc} lms={lms} layout={shown} />
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
