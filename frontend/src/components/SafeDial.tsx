import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef, useState } from "react";
import { Check } from "lucide-react";

interface Props {
  digits: number;
  minDigit: number;
  maxDigit: number;
  onSubmit: (code: string) => void;
  disabled?: boolean;
  opened?: boolean;
}

const SIZE = 400;
const CENTER = SIZE / 2;

// Bán kính vòng chữ số + bề rộng dải màu cho từng vòng, TÍNH TỪ NGOÀI VÀO TRONG.
// Vòng 1 = ngoài cùng (đen), Vòng 2 = giữa (xanh thép), Vòng 3 = trong cùng (kem).
const RING_STYLE = [
  { outer: 200, inner: 148, textR: 174, fill: "#141311", stroke: "rgba(255,255,255,0.08)", textFill: "#f4f1e8", fontSize: 30 },
  { outer: 148, inner: 100, textR: 124, fill: "#31404a", stroke: "rgba(255,255,255,0.08)", textFill: "#e7edef", fontSize: 24 },
  { outer: 100, inner: 56, textR: 78, fill: "#DAD5C9", stroke: "rgba(0,0,0,0.1)", textFill: "#141311", fontSize: 19 },
];

function polar(radius: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + radius * Math.sin(rad), y: CENTER - radius * Math.cos(rad) };
}

function ringPath(outerR: number, innerR: number) {
  // Vòng khuyên đầy đủ 360 độ, vẽ bằng 2 nửa cung để tránh lỗi path khi góc = 360.
  const o1 = polar(outerR, 0);
  const o2 = polar(outerR, 180);
  const o3 = polar(outerR, 360);
  const i1 = polar(innerR, 0);
  const i2 = polar(innerR, 180);
  const i3 = polar(innerR, 360);
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${outerR} ${outerR} 0 0 1 ${o2.x} ${o2.y}`,
    `A ${outerR} ${outerR} 0 0 1 ${o3.x} ${o3.y}`,
    `L ${i3.x} ${i3.y}`,
    `A ${innerR} ${innerR} 0 0 0 ${i2.x} ${i2.y}`,
    `A ${innerR} ${innerR} 0 0 0 ${i1.x} ${i1.y}`,
    "Z",
  ].join(" ");
}

function RingLayer({
  ringIndex,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  ringIndex: number;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  const style = RING_STYLE[ringIndex] ?? RING_STYLE[RING_STYLE.length - 1];
  const range = max - min + 1;
  const anglePerStep = 360 / range;
  const rotation = -(value - min) * anglePerStep;
  const [dragging, setDragging] = useState(false);
  const groupRef = useRef<SVGGElement>(null);

  function svgPointFromEvent(clientX: number, clientY: number) {
    const svg = groupRef.current?.ownerSVGElement;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * SIZE;
    const y = ((clientY - rect.top) / rect.height) * SIZE;
    const dx = x - CENTER;
    const dy = y - CENTER;
    let angle = Math.atan2(dx, -dy) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    const step = Math.round(angle / anglePerStep) % range;
    return min + step;
  }

  function handlePointerDown(e: ReactPointerEvent) {
    if (disabled) return;
    e.stopPropagation();
    setDragging(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const v = svgPointFromEvent(e.clientX, e.clientY);
    if (v !== null) onChange(v);
  }
  function handlePointerMove(e: ReactPointerEvent) {
    if (!dragging || disabled) return;
    const v = svgPointFromEvent(e.clientX, e.clientY);
    if (v !== null) onChange(v);
  }
  function stopDrag() {
    setDragging(false);
  }

  const marks = Array.from({ length: range }, (_, i) => min + i);

  return (
    <g
      ref={groupRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDrag}
      onPointerLeave={stopDrag}
      style={{ cursor: disabled ? "default" : dragging ? "grabbing" : "grab", touchAction: "none" }}
    >
      <path d={ringPath(style.outer, style.inner)} fill={style.fill} stroke={style.stroke} strokeWidth={1} />
      <g
        style={{
          transform: `rotate(${rotation}deg)`,
          transformOrigin: `${CENTER}px ${CENTER}px`,
          transition: dragging ? "none" : "transform 150ms ease-out",
        }}
      >
        {marks.map((m) => {
          const angle = (m - min) * anglePerStep;
          const pos = polar(style.textR, angle);
          // Số đang ở đúng đỉnh 12 giờ (đã chọn) được xoay ngược lại để hiển thị THẲNG ĐỨNG,
          // dễ đọc; các số còn lại giữ nguyên độ nghiêng tự nhiên theo vị trí trên vòng tròn
          // (kế thừa từ phép xoay của cả nhóm <g>) — giống hiệu ứng khóa số thật.
          const localRotation = m === value ? -rotation : 0;
          return (
            <text
              key={m}
              x={pos.x}
              y={pos.y}
              fill={style.textFill}
              fontSize={style.fontSize}
              fontFamily="'JetBrains Mono', monospace"
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                transform: `rotate(${localRotation}deg)`,
                transformOrigin: `${pos.x}px ${pos.y}px`,
                transformBox: "fill-box",
              }}
            >
              {m}
            </text>
          );
        })}
      </g>
    </g>
  );
}

export default function SafeDial({ digits, minDigit, maxDigit, onSubmit, disabled, opened }: Props) {
  const [values, setValues] = useState<number[]>(Array(digits).fill(minDigit));

  return (
    <div className="card p-6 sm:p-8 flex flex-col items-center gap-6">
      <div className="relative" style={{ width: "min(100%, 360px)", aspectRatio: "1 / 1" }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full select-none">
          {/* Vạch chỉ điểm cố định ở đỉnh 12 giờ */}
          <polygon
            points={`${CENTER - 8},14 ${CENTER + 8},14 ${CENTER},30`}
            fill="#B5502A"
          />
          {Array.from({ length: Math.min(digits, RING_STYLE.length) }, (_, i) => (
            <RingLayer
              key={i}
              ringIndex={i}
              value={values[i]}
              min={minDigit}
              max={maxDigit}
              disabled={disabled || opened}
              onChange={(v) => setValues((prev) => prev.map((p, idx) => (idx === i ? v : p)))}
            />
          ))}

          {/* Núm xoay trung tâm - đồng thời là nút xác nhận gửi mã */}
          <g
            onClick={() => {
              if (!disabled && !opened) onSubmit(values.join(""));
            }}
            style={{ cursor: disabled || opened ? "default" : "pointer" }}
          >
            <circle cx={CENTER} cy={CENTER} r={50} fill="url(#safeKnobGradient)" stroke="rgba(0,0,0,0.5)" strokeWidth={2} />
            <defs>
              <radialGradient id="safeKnobGradient" cx="35%" cy="30%" r="75%">
                <stop offset="0%" stopColor="#f2f2f0" />
                <stop offset="55%" stopColor="#9a9a96" />
                <stop offset="100%" stopColor="#4a4a47" />
              </radialGradient>
            </defs>
            {opened && (
              <foreignObject x={CENTER - 16} y={CENTER - 16} width={32} height={32}>
                <div className="w-full h-full flex items-center justify-center text-turquoise">
                  <Check size={24} strokeWidth={3} />
                </div>
              </foreignObject>
            )}
          </g>
        </svg>
      </div>

      <div className="flex gap-4 sm:gap-6">
        {values.map((v, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Vòng {i + 1}</span>
            <div className="w-12 h-12 flex items-center justify-center border border-white/15 bg-white/5 font-mono text-xl font-bold text-paper">
              {v}
            </div>
          </div>
        ))}
      </div>

      <button className="btn-primary" disabled={disabled || opened} onClick={() => onSubmit(values.join(""))}>
        {opened ? "Đã mở khóa" : "Thử mở két"}
      </button>
    </div>
  );
}
