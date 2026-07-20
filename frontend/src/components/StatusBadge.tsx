import type { ReactNode } from "react";
import { Lock, Clock, CheckCircle2, XCircle, RotateCcw, PenLine, Circle } from "lucide-react";
import { QuestionStatus } from "../types";

const CONFIG: Record<QuestionStatus, { label: string; cls: string; icon: ReactNode }> = {
  LOCKED: { label: "Đang khóa", cls: "bg-white/5 text-white/40 border border-white/10", icon: <Lock size={13} /> },
  NOT_STARTED: { label: "Chưa bắt đầu", cls: "bg-white/5 text-white/60 border border-white/10", icon: <Circle size={13} /> },
  DRAFT_SAVED: { label: "Đã lưu nháp", cls: "bg-purple/15 text-purple-soft border border-purple/30", icon: <PenLine size={13} /> },
  PENDING_REVIEW: { label: "Chờ BTC kiểm tra", cls: "bg-yellow-500/15 text-yellow-300 border border-yellow-500/30", icon: <Clock size={13} /> },
  CORRECT: { label: "Trả lời đúng", cls: "bg-turquoise/15 text-turquoise border border-turquoise/30", icon: <CheckCircle2 size={13} /> },
  INCORRECT: { label: "Trả lời sai", cls: "bg-red-500/15 text-red-300 border border-red-500/30", icon: <XCircle size={13} /> },
  RETRY_ALLOWED: { label: "Được trả lời lại", cls: "bg-orange-500/15 text-orange-300 border border-orange-500/30", icon: <RotateCcw size={13} /> },
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
