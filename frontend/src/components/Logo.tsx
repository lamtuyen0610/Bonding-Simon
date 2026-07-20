import { Compass } from "lucide-react";

export default function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const textSize = size === "lg" ? "text-4xl sm:text-5xl" : size === "md" ? "text-2xl" : "text-lg";
  const iconSize = size === "lg" ? 32 : size === "md" ? 22 : 16;
  return (
    <div className="flex items-center gap-2.5">
      <div className="rounded-xl bg-gradient-to-br from-purple to-turquoise p-2 shadow-card">
        <Compass size={iconSize} className="text-ink" strokeWidth={2.5} />
      </div>
      <span className={`font-display font-bold tracking-tight ${textSize}`}>
        KHỞI <span className="text-turquoise">NGUỒN</span>
      </span>
    </div>
  );
}
