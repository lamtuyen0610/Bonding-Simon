import { useState } from "react";
import { ChevronUp, ChevronDown, Lock, LockOpen } from "lucide-react";

interface Props {
  digits: number;
  minDigit: number;
  maxDigit: number;
  onSubmit: (code: string) => void;
  disabled?: boolean;
  opened?: boolean;
}

export default function SafeDial({ digits, minDigit, maxDigit, onSubmit, disabled, opened }: Props) {
  const [values, setValues] = useState<number[]>(Array(digits).fill(minDigit));

  function bump(index: number, delta: number) {
    if (disabled || opened) return;
    setValues((prev) => {
      const next = [...prev];
      const range = maxDigit - minDigit + 1;
      next[index] = ((((next[index] + delta - minDigit) % range) + range) % range) + minDigit;
      return next;
    });
  }

  return (
    <div className="card p-6 sm:p-8 flex flex-col items-center gap-6">
      <div className="flex items-center gap-2 text-white/60 text-sm">
        {opened ? (
          <>
            <LockOpen size={18} className="text-turquoise" /> Két sắt đã mở
          </>
        ) : (
          <>
            <Lock size={18} /> Xoay từng vòng số để tìm đúng mật mã
          </>
        )}
      </div>

      <div className="flex gap-3 sm:gap-4">
        {values.map((v, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => bump(i, 1)}
              disabled={disabled || opened}
              className="text-white/50 hover:text-turquoise transition disabled:opacity-30"
              aria-label="Tăng"
            >
              <ChevronUp size={20} />
            </button>
            <div
              className={`w-12 h-16 sm:w-14 sm:h-20 rounded-xl border-2 flex items-center justify-center font-mono text-2xl sm:text-3xl font-bold transition-colors ${
                opened ? "border-turquoise bg-turquoise/10 text-turquoise" : "border-purple/50 bg-white/5 text-white"
              }`}
            >
              {v}
            </div>
            <button
              type="button"
              onClick={() => bump(i, -1)}
              disabled={disabled || opened}
              className="text-white/50 hover:text-turquoise transition disabled:opacity-30"
              aria-label="Giảm"
            >
              <ChevronDown size={20} />
            </button>
          </div>
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
