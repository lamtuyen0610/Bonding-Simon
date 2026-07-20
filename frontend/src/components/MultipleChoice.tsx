import { Circle, CheckCircle2 } from "lucide-react";

interface Props {
  options: string[];
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function MultipleChoice({ options, value, onChange, disabled }: Props) {
  return (
    <div className="space-y-2.5">
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt)}
            className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition ${
              selected
                ? "border-purple bg-purple/15 text-white"
                : "border-white/10 bg-white/5 text-white/80 hover:border-white/25"
            } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            {selected ? (
              <CheckCircle2 size={18} className="text-purple-soft shrink-0" />
            ) : (
              <Circle size={18} className="text-white/25 shrink-0" />
            )}
            <span>{opt}</span>
          </button>
        );
      })}
    </div>
  );
}
