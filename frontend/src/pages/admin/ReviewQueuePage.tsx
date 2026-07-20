import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle, RotateCcw, Loader2 } from "lucide-react";
import { api, ApiError } from "../../api/client";
import { useAdminSocket } from "../../hooks/useAdminSocket";
import { useToast } from "../../contexts/ToastContext";

interface QueueItem {
  id: string;
  teamId: string;
  teamName: string;
  questionCode: string;
  questionTitle: string;
  questionPoints: number;
  answer: string;
  status: string;
  awardedPoints: number;
  adminNote: string | null;
  submittedAt: string;
}

const FILTERS = [
  { value: "PENDING_REVIEW", label: "Chờ chấm" },
  { value: "ALL", label: "Tất cả" },
  { value: "CORRECT", label: "Đúng" },
  { value: "INCORRECT", label: "Sai" },
];

export default function ReviewQueuePage() {
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [filter, setFilter] = useState("PENDING_REVIEW");
  const toast = useToast();

  const load = useCallback(() => {
    api.get<{ submissions: QueueItem[] }>(`/admin/review-queue?status=${filter}`).then((r) => setItems(r.submissions)).catch(() => {});
  }, [filter]);

  useEffect(load, [load]);
  useAdminSocket(load);

  async function review(id: string, decision: "CORRECT" | "INCORRECT" | "RETRY_ALLOWED", points?: number) {
    try {
      await api.post(`/admin/review/${id}`, { decision, awardedPoints: points });
      toast("success", "Đã cập nhật kết quả chấm.");
      load();
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Không thể chấm điểm.");
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-display font-bold mb-5">Hàng đợi chấm đáp án</h1>

      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`pill border transition ${
              filter === f.value ? "bg-purple/20 border-purple/50 text-purple-soft" : "border-white/10 text-white/50 hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!items && (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-turquoise" size={24} />
        </div>
      )}

      <div className="space-y-3">
        {items?.map((item) => (
          <ReviewCard key={item.id} item={item} onReview={review} />
        ))}
        {items && items.length === 0 && (
          <div className="card p-8 text-center text-white/50">Không có đáp án nào trong danh sách này.</div>
        )}
      </div>
    </div>
  );
}

function ReviewCard({
  item,
  onReview,
}: {
  item: QueueItem;
  onReview: (id: string, decision: "CORRECT" | "INCORRECT" | "RETRY_ALLOWED", points?: number) => void;
}) {
  const [points, setPoints] = useState(item.questionPoints);
  const isPending = item.status === "PENDING_REVIEW";

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold">{item.teamName}</p>
          <p className="text-sm text-white/50">{item.questionTitle}</p>
        </div>
        <span className="text-xs font-mono text-white/30">{new Date(item.submittedAt).toLocaleString("vi-VN")}</span>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm mb-4 break-words">{item.answer}</div>

      {isPending ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50">Điểm</span>
            <input
              type="number"
              className="input-field w-20 py-2"
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
              min={0}
            />
          </div>
          <button className="btn-primary" onClick={() => onReview(item.id, "CORRECT", points)}>
            <CheckCircle2 size={15} /> Đúng
          </button>
          <button className="btn-danger" onClick={() => onReview(item.id, "INCORRECT")}>
            <XCircle size={15} /> Sai
          </button>
          <button className="btn-secondary" onClick={() => onReview(item.id, "RETRY_ALLOWED")}>
            <RotateCcw size={15} /> Cho trả lời lại
          </button>
        </div>
      ) : (
        <span
          className={`pill ${
            item.status === "CORRECT"
              ? "bg-turquoise/15 text-turquoise border border-turquoise/30"
              : item.status === "INCORRECT"
              ? "bg-red-500/15 text-red-300 border border-red-500/30"
              : "bg-orange-500/15 text-orange-300 border border-orange-500/30"
          }`}
        >
          {item.status} {item.status === "CORRECT" && `· +${item.awardedPoints}đ`}
        </span>
      )}
    </div>
  );
}
