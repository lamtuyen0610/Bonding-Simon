import { ScanLine } from "lucide-react";

export default function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const textSize = size === "lg" ? "text-3xl sm:text-4xl" : size === "md" ? "text-xl" : "text-base";
  const iconSize = size === "lg" ? 22 : size === "md" ? 18 : 14;
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center border border-purple/60 bg-black/40">
        <ScanLine size={iconSize} className="text-purple" strokeWidth={2} />
      </div>
      <div className="leading-none">
        <p className="font-mono text-[9px] uppercase tracking-widest2 text-white/35 mb-1">Hồ sơ vụ án · Mật</p>
        <span className={`font-display font-bold tracking-tight text-paper ${textSize}`}>
          KHỞI <span className="text-purple">NGUỒN</span>
        </span>
      </div>
    </div>
  );
}
