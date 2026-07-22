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
  min,
  max,
  disabled,
  onChange,
}: {
  ringIndex: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  const style = RING_STYLE[ringIndex] ?? RING_STYLE[RING_STYLE.length - 1];
  const range = max - min + 1;
  const anglePerStep = 360 / range;

  // rotation: góc xoay LIÊN TỤC (không làm tròn khi đang kéo) để cảm giác mượt như xoay khóa
  // thật. Số đang được chọn = số có vị trí gần đỉnh 12h nhất tại thời điểm hiện tại.
  const [rotation, setRotation] = useState(0);
  const [dragging, setDragging] = useState(false);
  const groupRef = useRef<SVGGElement>(null);
  const lastAngleRef = useRef<number | null>(null);

  function pointerAngle(clientX: number, clientY: number) {
    const svg = groupRef.current?.ownerSVGElement;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * SIZE;
    const y = ((clientY - rect.top) / rect.height) * SIZE;
    const dx = x - CENTER;
    const dy = y - CENTER;
    return normalizeAngle(Math.atan2(dx, -dy) * (180 / Math.PI));
  }

  function currentValue(rot: number) {
    const step = Math.round(normalizeAngle(-rot) / anglePerStep) % range;
    return min + step;
  }

  function handlePointerDown(e: ReactPointerEvent) {
    if (disabled) return;
    e.stopPropagation();
    setDragging(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    lastAngleRef.current = pointerAngle(e.clientX, e.clientY);
  }

  function handlePointerMove(e: ReactPointerEvent) {
    if (!dragging || disabled) return;
    const angle = pointerAngle(e.clientX, e.clientY);
    if (angle === null || lastAngleRef.current === null) return;
    // Chênh lệch góc giữa 2 lần di chuyển liên tiếp (xử lý cả trường hợp vòng qua mốc 0/360).
    let delta = angle - lastAngleRef.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    lastAngleRef.current = angle;
    setRotation((prev) => {
      const next = prev + delta;
      onChange(currentValue(next));
      return next;
    });
  }

  function stopDrag() {
    if (!dragging) return;
    setDragging(false);
    lastAngleRef.current = null;
    // Chốt lại đúng khớp số gần nhất khi thả tay, xoay mượt về vị trí chuẩn (không xoay vòng thừa).
    setRotation((prev) => {
      const value = currentValue(prev);
      const snapped = -(value - min) * anglePerStep;
      let diff = snapped - prev;
      diff = ((diff + 180) % 360 + 360) % 360 - 180;
      return prev + diff;
    });
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
        transform={`rotate(${rotation} ${CENTER} ${CENTER})`}
        style={{ transition: dragging ? "none" : "transform 200ms ease-out" }}
      >
        {marks.map((m) => {
          const angle = (m - min) * anglePerStep;
          const pos = polar(style.textR, angle);
          // LUÔN giữ chữ số thẳng đứng dễ đọc (không nghiêng theo vòng) — chỉ VỊ TRÍ của số
          // di chuyển quanh vòng tròn khi xoay, còn hướng chữ luôn cố định.
          const textRotation = -rotation;
          return (
            <text
              key={m}
              x={pos.x}
              y={pos.y}
              transform={`rotate(${textRotation} ${pos.x} ${pos.y})`}
              fill={style.textFill}
              fontSize={style.fontSize}
              fontFamily="'JetBrains Mono', monospace"
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="central"
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
      <div className="flex items-center justify-center">
        <div className="relative" style={{ width: "min(280px, 78vw)", aspectRatio: "1 / 1" }}>
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full select-none">
            {Array.from({ length: Math.min(digits, RING_STYLE.length) }, (_, i) => (
              <RingLayer
                key={i}
                ringIndex={i}
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

            {/* Mũi tên đỏ CỐ ĐỊNH ở đỉnh 12 giờ, chỉ rõ vị trí số đang được chọn trên mỗi vòng */}
            <polygon points={`${CENTER - 10},4 ${CENTER + 10},4 ${CENTER},26`} fill="#e0402a" stroke="#0a0a09" strokeWidth={1} />
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
