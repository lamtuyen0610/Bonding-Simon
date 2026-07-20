import type { ReactNode } from "react";
import { Lock, Clock, CheckCircle2, XCircle, RotateCcw, PenLine, Circle, EyeOff } from "lucide-react";
import { QuestionStatus } from "../types";

const CONFIG: Record<QuestionStatus, { label: string; cls: string; icon: ReactNode }> = {
  LOCKED: { label: "Đang khóa", cls: "bg-white/5 text-white/40 border-white/10", icon: <Lock size={13} /> },
  NOT_STARTED: { label: "Chưa bắt đầu", cls: "bg-white/5 text-white/60 border-white/10", icon: <Circle size={13} /> },
  DRAFT_SAVED: { label: "Đã lưu nháp", cls: "bg-purple/10 text-purple-soft border-purple/30", icon: <PenLine size={13} /> },
  PENDING_REVIEW: { label: "Chờ BTC kiểm tra", cls: "bg-amber-950/60 text-amber-400/90 border-amber-700/40", icon: <Clock size={13} /> },
  ANSWERED: { label: "Đã trả lời — chờ tiết lộ", cls: "bg-purple/10 text-purple-soft border-purple/30", icon: <EyeOff size={13} /> },
  CORRECT: { label: "Trả lời đúng", cls: "bg-turquoise/10 text-turquoise border-turquoise/30", icon: <CheckCircle2 size={13} /> },
  INCORRECT: { label: "Trả lời sai", cls: "bg-red-950/60 text-red-400/90 border-red-800/40", icon: <XCircle size={13} /> },
  RETRY_ALLOWED: { label: "Được trả lời lại", cls: "bg-purple/10 text-purple-soft border-purple/40", icon: <RotateCcw size={13} /> },
};

export default function StatusBadge({ status }: { status: QuestionStatus }) {
  const c = CONFIG[status];
  return (
    <span className={`pill ${c.cls}`}>
      {c.icon}
      {c.label}
    </span>
  );
}
