import { useRef, useState } from "react";
import { Lock, LockOpen } from "lucide-react";

interface Props {
  digits: number;
  minDigit: number;
  maxDigit: number;
  onSubmit: (code: string) => void;
  disabled?: boolean;
  opened?: boolean;
}

const SIZE = 116; // đường kính vòng xoay (px)
const RADIUS = SIZE / 2 - 14; // bán kính đặt các số quanh vòng

function RotaryDial({
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const range = max - min + 1;
  const anglePerStep = 360 / range;
  const rotation = -(value - min) * anglePerStep;

  function valueFromPointer(clientX: number, clientY: number) {
    const el = ref.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    let angle = Math.atan2(dx, -dy) * (180 / Math.PI); // 0deg = 12 giờ, xoay theo chiều kim đồng hồ
    if (angle < 0) angle += 360;
    const step = Math.round(angle / anglePerStep) % range;
    return min + step;
  }

  function handleMove(clientX: number, clientY: number) {
    const v = valueFromPointer(clientX, clientY);
    if (v !== null) onChange(v);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (disabled) return;
    setDragging(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    handleMove(e.clientX, e.clientY);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging || disabled) return;
    handleMove(e.clientX, e.clientY);
  }
  function stopDrag() {
    setDragging(false);
  }

  const marks = Array.from({ length: range }, (_, i) => min + i);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDrag}
        onPointerLeave={stopDrag}
        className={`relative touch-none select-none rounded-full ${
          disabled ? "opacity-50" : dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{
          width: SIZE,
          height: SIZE,
          background: "radial-gradient(circle at 33% 28%, #33322f 0%, #0c0c0b 68%)",
          boxShadow: "0 0 0 3px rgba(255,255,255,0.07), inset 0 3px 8px rgba(0,0,0,0.7)",
        }}
      >
        {/* Vòng số xoay theo giá trị hiện tại */}
        <div
          className="absolute inset-0"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: dragging ? "none" : "transform 150ms ease-out",
          }}
        >
          {marks.map((m) => {
            const a = (m - min) * anglePerStep;
            const rad = (a * Math.PI) / 180;
            const x = SIZE / 2 + RADIUS * Math.sin(rad);
            const y = SIZE / 2 - RADIUS * Math.cos(rad);
            return (
              <span
                key={m}
                className="absolute font-mono text-[11px] text-white/45"
                style={{
                  left: x,
                  top: y,
                  transform: `translate(-50%, -50%) rotate(${-rotation}deg)`,
                }}
              >
                {m}
              </span>
            );
          })}
        </div>

        {/* Kim chỉ cố định ở đỉnh 12 giờ */}
        <div
          className="absolute left-1/2 -top-[3px] -translate-x-1/2"
          style={{
            width: 0,
            height: 0,
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderTop: "9px solid #B5502A",
          }}
        />

        {/* Số hiện tại ở tâm */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-2xl font-bold text-paper">{value}</span>
        </div>
      </div>
    </div>
  );
}

export default function SafeDial({ digits, minDigit, maxDigit, onSubmit, disabled, opened }: Props) {
  const [values, setValues] = useState<number[]>(Array(digits).fill(minDigit));

  return (
    <div className="card p-6 sm:p-8 flex flex-col items-center gap-6">
      <div className="flex items-center gap-2 text-white/60 text-xs font-mono uppercase tracking-widest">
        {opened ? (
          <>
            <LockOpen size={16} className="text-turquoise" /> Đã mở khóa
          </>
        ) : (
          <>
            <Lock size={16} /> Kéo từng vòng số để dò mật mã
          </>
        )}
      </div>

      <div className="flex gap-5 sm:gap-7">
        {values.map((v, i) => (
          <RotaryDial
            key={i}
            value={v}
            min={minDigit}
            max={maxDigit}
            disabled={disabled || opened}
            onChange={(nv) =>
              setValues((prev) => prev.map((p, idx) => (idx === i ? nv : p)))
            }
          />
        ))}
      </div>

      <button
        className="btn-primary"
        disabled={disabled || opened}
        onClick={() => onSubmit(values.join(""))}
      >
        {opened ? "Đã mở khóa" : "Thử mở két"}
      </button>
    </div>
  );
}
