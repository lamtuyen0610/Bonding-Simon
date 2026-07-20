import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "../../api/client";
import { useAdminSocket } from "../../hooks/useAdminSocket";

interface ProgressRow {
  teamId: string;
  teamName: string;
  perQuestion: Record<string, string>;
  sixTasksProgress: string;
  clue1Delivered: boolean;
  clue2Delivered: boolean;
  question7Unlocked: boolean;
  totalScore: number;
  status: string;
}

interface ProgressData {
  questions: { code: string; title: string }[];
  rows: ProgressRow[];
}

const STATUS_DOT: Record<string, string> = {
  CORRECT: "bg-turquoise",
  PENDING_REVIEW: "bg-yellow-400",
  INCORRECT: "bg-red-400",
  RETRY_ALLOWED: "bg-orange-400",
  NOT_STARTED: "bg-white/15",
};

const FILTERS = ["ALL", "PLAYING", "WAITING_FOR_Q7", "COMPLETED"] as const;
const FILTER_LABEL: Record<(typeof FILTERS)[number], string> = {
  ALL: "Tất cả",
  PLAYING: "Đang chơi",
  WAITING_FOR_Q7: "Chờ BTC",
  COMPLETED: "Đã hoàn thành",
};

export default function ProgressTablePage() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");

  const load = useCallback(() => {
    api.get<ProgressData>("/admin/progress").then(setData).catch(() => {});
  }, []);

  useEffect(load, [load]);
  useAdminSocket(load);

  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-turquoise" size={24} />
      </div>
    );
  }

  const rows = filter === "ALL" ? data.rows : data.rows.filter((r) => r.status === filter);

  return (
    <div>
      <h1 className="text-2xl font-display font-bold mb-5">Bảng tiến độ trực tiếp</h1>

      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`pill border transition ${
              filter === f
                ? "bg-purple/20 border-purple/50 text-purple-soft"
                : "border-white/10 text-white/50 hover:text-white"
            }`}
          >
            {FILTER_LABEL[f]}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-white/10 text-left text-white/40">
              <th className="px-4 py-3 font-medium">Đội</th>
              {data.questions.map((q) => (
                <th key={q.code} className="px-3 py-3 font-medium text-center whitespace-nowrap">
                  {q.title}
                </th>
              ))}
              <th className="px-3 py-3 font-medium text-center">6 câu</th>
              <th className="px-3 py-3 font-medium text-center">Điểm</th>
              <th className="px-3 py-3 font-medium text-center">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.teamId} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-3 font-medium whitespace-nowrap">{r.teamName}</td>
                {data.questions.map((q) => (
                  <td key={q.code} className="px-3 py-3 text-center">
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_DOT[r.perQuestion[q.code]] ?? "bg-white/15"}`}
                      title={r.perQuestion[q.code]}
                    />
                  </td>
                ))}
                <td className="px-3 py-3 text-center font-mono">{r.sixTasksProgress}</td>
                <td className="px-3 py-3 text-center font-display font-bold text-turquoise">{r.totalScore}</td>
                <td className="px-3 py-3 text-center text-xs text-white/50">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
