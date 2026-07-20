import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  FileStack,
  KeyRound,
  Unlock,
  RotateCcw,
  Ban,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { api, ApiError } from "../../api/client";
import { useToast } from "../../contexts/ToastContext";
import { useAdminSocket } from "../../hooks/useAdminSocket";

interface TeamDetail {
  id: string;
  name: string;
  joinCode: string;
  status: string;
  isActive: boolean;
  isDisqualified: boolean;
  totalScore: number;
  clue1Delivered: boolean;
  clue1DeliveredAt: string | null;
  clue1DeliveredBy: string | null;
  clue2Delivered: boolean;
  clue2DeliveredAt: string | null;
  clue2DeliveredBy: string | null;
  question7Unlocked: boolean;
  sixTasksCompletedAt: string | null;
  finalQuestionCompletedAt: string | null;
}

interface SubmissionRow {
  id: string;
  questionCode: string;
  questionTitle: string;
  answer: string;
  status: string;
  awardedPoints: number;
  adminNote: string | null;
  submittedAt: string;
}

export default function TeamDetailPage() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!teamId) return;
    api
      .get<{ team: TeamDetail; submissions: SubmissionRow[] }>(`/admin/teams/${teamId}`)
      .then((r) => {
        setTeam(r.team);
        setSubmissions(r.submissions);
      })
      .catch(() => {});
  }, [teamId]);

  useEffect(load, [load]);
  useAdminSocket(load);

  async function action(name: string, fn: () => Promise<unknown>, successMsg: string) {
    setBusy(name);
    try {
      await fn();
      toast("success", successMsg);
      load();
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Thao tác thất bại.");
    } finally {
      setBusy(null);
    }
  }

  if (!team) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-turquoise" size={24} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <button onClick={() => navigate("/admin/teams")} className="flex items-center gap-2 text-white/50 hover:text-white text-sm mb-5">
        <ArrowLeft size={16} /> Quay lại danh sách đội
      </button>

      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold">{team.name}</h1>
            <p className="text-xs font-mono text-white/40 mt-1">Mã đội: {team.joinCode}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/40 mb-0.5">Tổng điểm</p>
            <p className="text-2xl font-display font-bold text-turquoise">{team.totalScore}</p>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <ActionCard
          icon={<FileStack size={18} />}
          title="Tập hồ sơ số 1"
          delivered={team.clue1Delivered}
          deliveredBy={team.clue1DeliveredBy}
          disabled={team.clue1Delivered || busy === "clue1"}
          onDeliver={() => action("clue1", () => api.post(`/admin/teams/${team.id}/deliver-clue1`), "Đã giao Tập hồ sơ số 1.")}
        />
        <ActionCard
          icon={<FileStack size={18} />}
          title="Tập hồ sơ số 2"
          delivered={team.clue2Delivered}
          deliveredBy={team.clue2DeliveredBy}
          disabled={team.clue2Delivered || busy === "clue2"}
          onDeliver={() => action("clue2", () => api.post(`/admin/teams/${team.id}/deliver-clue2`), "Đã giao Tập hồ sơ số 2.")}
        />
      </div>

      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold flex items-center gap-2">
              <Unlock size={16} className="text-purple-soft" /> Câu hỏi số 7
            </p>
            <p className="text-sm text-white/50 mt-1">
              {team.question7Unlocked
                ? "Đã mở khóa cho đội này."
                : team.sixTasksCompletedAt
                ? "Đội đã hoàn thành 6/6 nhiệm vụ — đội có thể tự bấm \"Kết thúc vụ án\", hoặc Admin mở khóa hộ ở đây."
                : "Đội chưa hoàn thành đủ 6/6 nhiệm vụ."}
            </p>
          </div>
          <button
            className="btn-primary"
            disabled={!team.sixTasksCompletedAt || team.question7Unlocked || busy === "q7"}
            onClick={() => action("q7", () => api.post(`/admin/teams/${team.id}/unlock-question7`), "Đã mở khóa câu hỏi số 7.")}
          >
            {team.question7Unlocked ? "Đã mở khóa" : "Mở khóa câu hỏi số 7"}
          </button>
        </div>
      </div>

      <div className="card p-5 mb-6">
        <h2 className="font-semibold mb-4">Lịch sử trả lời</h2>
        <div className="space-y-2">
          {submissions.length === 0 && <p className="text-sm text-white/40">Chưa có đáp án nào.</p>}
          {submissions.map((s) => (
            <div key={s.id} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold">{s.questionTitle}</span>
                <span className="font-mono text-xs text-white/40">{new Date(s.submittedAt).toLocaleString("vi-VN")}</span>
              </div>
              <p className="text-white/70 break-words">{s.answer}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs">
                <span className={s.status === "CORRECT" ? "text-turquoise" : s.status === "INCORRECT" ? "text-red-300" : "text-yellow-300"}>
                  {s.status}
                </span>
                {s.status === "CORRECT" && <span className="text-white/40">+{s.awardedPoints}đ</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold mb-4">Quản trị</h2>
        <div className="flex flex-wrap gap-3">
          <button
            className="btn-secondary"
            disabled={busy === "regen"}
            onClick={() =>
              action("regen", () => api.post(`/admin/teams/${team.id}/regenerate-code`), "Đã sinh mã đội mới.")
            }
          >
            <KeyRound size={15} /> Sinh mã đội mới
          </button>
          <button
            className="btn-secondary"
            disabled={busy === "reset"}
            onClick={() => {
              if (confirm(`Đặt lại toàn bộ tiến trình của "${team.name}"? Hành động này không thể hoàn tác.`)) {
                action("reset", () => api.post(`/admin/teams/${team.id}/reset`), "Đã đặt lại tiến trình đội.");
              }
            }}
          >
            <RotateCcw size={15} /> Reset tiến trình
          </button>
          <button
            className="btn-secondary"
            disabled={busy === "active"}
            onClick={() =>
              action(
                "active",
                () => api.patch(`/admin/teams/${team.id}`, { isActive: !team.isActive }),
                team.isActive ? "Đã vô hiệu hóa đội." : "Đã kích hoạt lại đội."
              )
            }
          >
            <RefreshCw size={15} /> {team.isActive ? "Vô hiệu hóa" : "Kích hoạt lại"}
          </button>
          <button
            className="btn-danger"
            disabled={busy === "dq"}
            onClick={() =>
              action(
                "dq",
                () => api.patch(`/admin/teams/${team.id}`, { isDisqualified: !team.isDisqualified }),
                team.isDisqualified ? "Đã bỏ đánh dấu bỏ cuộc." : "Đã đánh dấu đội bỏ cuộc."
              )
            }
          >
            <Ban size={15} /> {team.isDisqualified ? "Bỏ đánh dấu bỏ cuộc" : "Đánh dấu bỏ cuộc"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  delivered,
  deliveredBy,
  disabled,
  onDeliver,
}: {
  icon: ReactNode;
  title: string;
  delivered: boolean;
  deliveredBy: string | null;
  disabled: boolean;
  onDeliver: () => void;
}) {
  return (
    <div className="card p-5">
      <p className="font-semibold flex items-center gap-2 mb-2">
        <span className="text-turquoise">{icon}</span> {title}
      </p>
      <p className="text-sm text-white/50 mb-4">
        {delivered ? `Đã giao${deliveredBy ? ` bởi ${deliveredBy}` : ""}.` : "Chưa giao cho đội."}
      </p>
      <button className="btn-primary w-full" disabled={disabled} onClick={onDeliver}>
        {delivered ? "Đã giao" : "Đã giao hồ sơ này"}
      </button>
    </div>
  );
}
