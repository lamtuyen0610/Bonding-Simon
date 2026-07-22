import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
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
// QUAN TRỌNG: các chữ số ĐỨNG YÊN TẠI VỊ TRÍ CỐ ĐỊNH trên mỗi vòng — không bao giờ di
// chuyển/xoay/nghiêng. Người chơi "xoay" bằng cách kéo tay quanh vòng tròn (giống vặn
// khóa thật), và ô số nào đang nằm dưới ngón tay sẽ được tô sáng làm số đang chọn.
const RING_STYLE = [
  { outer: 200, inner: 148, textR: 174, fill: "#141311", stroke: "rgba(255,255,255,0.08)", textFill: "#8a8a86", fontSize: 26 },
  { outer: 148, inner: 100, textR: 124, fill: "#31404a", stroke: "rgba(255,255,255,0.08)", textFill: "#9aa7ac", fontSize: 21 },
  { outer: 100, inner: 56, textR: 78, fill: "#DAD5C9", stroke: "rgba(0,0,0,0.1)", textFill: "#8a8478", fontSize: 17 },
];

const HIGHLIGHT_FILL = ["#e07a4a", "#7fbfb5", "#B5502A"];

function polar(radius: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + radius * Math.sin(rad), y: CENTER - radius * Math.cos(rad) };
}

function ringPath(outerR: number, innerR: number) {
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

function normalizeAngle(a: number) {
  return ((a % 360) + 360) % 360;
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
  const highlight = HIGHLIGHT_FILL[ringIndex] ?? HIGHLIGHT_FILL[HIGHLIGHT_FILL.length - 1];
  const range = max - min + 1;
  const anglePerStep = 360 / range;
  const marks = Array.from({ length: range }, (_, i) => min + i);
  const groupRef = useRef<SVGGElement>(null);
  const [dragging, setDragging] = useState(false);

  // Xác định số gần vị trí con trỏ/ngón tay nhất (dựa theo vị trí CỐ ĐỊNH có sẵn của từng số),
  // dùng để "quét" qua các số khi kéo quanh vòng — bản thân số không di chuyển đi đâu cả.
  function valueUnderPointer(clientX: number, clientY: number) {
    const svg = groupRef.current?.ownerSVGElement;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * SIZE;
    const y = ((clientY - rect.top) / rect.height) * SIZE;
    const angle = normalizeAngle(Math.atan2(x - CENTER, -(y - CENTER)) * (180 / Math.PI));
    const step = Math.round(angle / anglePerStep) % range;
    return min + step;
  }

  function handlePointerDown(e: ReactPointerEvent) {
    if (disabled) return;
    setDragging(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const v = valueUnderPointer(e.clientX, e.clientY);
    if (v !== null) onChange(v);
  }
  function handlePointerMove(e: ReactPointerEvent) {
    if (!dragging || disabled) return;
    const v = valueUnderPointer(e.clientX, e.clientY);
    if (v !== null) onChange(v);
  }
  function stopDrag() {
    setDragging(false);
  }

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
      {marks.map((m) => {
        const angle = (m - min) * anglePerStep;
        const pos = polar(style.textR, angle);
        const selected = m === value;
        return (
          <g key={m} style={{ pointerEvents: "none" }}>
            {selected && <circle cx={pos.x} cy={pos.y} r={16} fill={highlight} opacity={0.9} />}
            <text
              x={pos.x}
              y={pos.y}
              fill={selected ? "#0a0a09" : style.textFill}
              fontSize={style.fontSize}
              fontFamily="'JetBrains Mono', monospace"
              fontWeight={selected ? 800 : 600}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {m}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export default function SafeDial({ digits, minDigit, maxDigit, onSubmit, disabled, opened }: Props) {
  const [values, setValues] = useState<number[]>(Array(digits).fill(minDigit));

  return (
    <div className="card p-6 sm:p-8 flex flex-col items-center gap-6">
      <p className="text-xs text-white/40 text-center max-w-xs">
        Kéo quanh từng vòng (giống vặn khóa thật) hoặc bấm thẳng vào số muốn chọn.
      </p>

      <div className="flex items-center justify-center">
        <div className="relative" style={{ width: "min(280px, 78vw)", aspectRatio: "1 / 1" }}>
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full select-none">
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

            {/* Núm trung tâm - đồng thời là nút xác nhận gửi mã */}
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
