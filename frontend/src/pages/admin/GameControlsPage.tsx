import { useCallback, useEffect, useState } from "react";
import {
  Play,
  Pause,
  Square,
  Trophy,
  BookOpenCheck,
  RefreshCcw,
  Loader2,
  Eye,
  EyeOff,
  Crown,
  Medal,
  Award,
} from "lucide-react";
import { api, ApiError } from "../../api/client";
import { useToast } from "../../contexts/ToastContext";
import { useAdminSocket } from "../../hooks/useAdminSocket";
import { LeaderboardEntry } from "../../types";

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

interface GameSession {
  id: string;
  status: string;
  showLiveRanking: boolean;
  startedAt: string | null;
  leaderboardPublishedAt: string | null;
  storyPublishedAt: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Chưa bắt đầu",
  RUNNING: "Đang diễn ra",
  PAUSED: "Tạm dừng",
  FINISHED: "Đã kết thúc (chưa công bố)",
  LEADERBOARD_PUBLISHED: "Đã công bố xếp hạng",
  STORY_PUBLISHED: "Đã công bố diễn biến vụ án",
};

export default function GameControlsPage() {
  const [session, setSession] = useState<GameSession | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState("");
  const toast = useToast();

  const load = useCallback(() => {
    api.get<{ session: GameSession }>("/admin/game").then((r) => setSession(r.session)).catch(() => {});
    api.get<{ entries: LeaderboardEntry[] }>("/admin/leaderboard").then((r) => setLeaderboard(r.entries)).catch(() => {});
  }, []);

  useEffect(load, [load]);
  useAdminSocket(load);

  async function run(name: string, path: string, msg: string, body?: unknown) {
    setBusy(name);
    try {
      await api.post(path, body);
      toast("success", msg);
      load();
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Thao tác thất bại.");
    } finally {
      setBusy(null);
    }
  }

  if (!session) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-turquoise" size={24} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold mb-1">Điều khiển game</h1>
        <p className="text-sm text-white/50">
          Trạng thái hiện tại: <span className="text-turquoise font-semibold">{STATUS_LABEL[session.status] ?? session.status}</span>
        </p>
      </div>

      <div className="card p-5 flex flex-wrap gap-3">
        <button className="btn-primary" disabled={session.status === "RUNNING" || busy === "start"} onClick={() => run("start", "/admin/game/start", "Trò chơi đã bắt đầu.")}>
          <Play size={16} /> Bắt đầu game
        </button>
        <button className="btn-secondary" disabled={session.status !== "RUNNING" || busy === "pause"} onClick={() => run("pause", "/admin/game/pause", "Đã tạm dừng game.")}>
          <Pause size={16} /> Tạm dừng
        </button>
        <button className="btn-secondary" disabled={session.status !== "PAUSED" || busy === "resume"} onClick={() => run("resume", "/admin/game/resume", "Đã tiếp tục game.")}>
          <Play size={16} /> Tiếp tục
        </button>
        <button
          className="btn-secondary"
          onClick={() => run("live", "/admin/game/toggle-live-ranking", session.showLiveRanking ? "Đã tắt xếp hạng tạm thời." : "Đã bật xếp hạng tạm thời.")}
        >
          {session.showLiveRanking ? <EyeOff size={16} /> : <Eye size={16} />}
          {session.showLiveRanking ? "Tắt xếp hạng tạm thời" : "Bật xếp hạng tạm thời"}
        </button>
        <button
          className="btn-danger"
          disabled={["FINISHED", "LEADERBOARD_PUBLISHED", "STORY_PUBLISHED"].includes(session.status) || busy === "end"}
          onClick={() => {
            if (confirm("Kết thúc điều tra và khóa toàn bộ câu trả lời? Các đội sẽ không thể gửi thêm đáp án.")) {
              run("end", "/admin/game/end", "Đã kết thúc điều tra và tính điểm.");
            }
          }}
        >
          <Square size={16} /> Kết thúc điều tra và tính điểm
        </button>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold mb-3">Công bố kết quả</h2>
        <div className="flex flex-wrap gap-3">
          <button
            className="btn-primary"
            disabled={!["FINISHED", "LEADERBOARD_PUBLISHED", "STORY_PUBLISHED"].includes(session.status) || !!session.leaderboardPublishedAt || busy === "leaderboard"}
            onClick={() => run("leaderboard", "/admin/game/publish-leaderboard", "Đã công bố bảng xếp hạng.")}
          >
            <Trophy size={16} /> Công bố bảng xếp hạng
          </button>
          <button
            className="btn-primary"
            disabled={!session.leaderboardPublishedAt || !!session.storyPublishedAt || busy === "story"}
            onClick={() => run("story", "/admin/game/publish-story", "Đã công bố diễn biến vụ án.")}
          >
            <BookOpenCheck size={16} /> Công bố diễn biến vụ án
          </button>
        </div>
      </div>

      {leaderboard && leaderboard.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold mb-4">Xem trước bảng xếp hạng</h2>
          <div className="space-y-2">
            {leaderboard.map((e) => (
              <div key={e.teamId} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
                <div className="w-6 flex justify-center">
                  {e.rank === 1 ? <Crown size={16} className="text-yellow-400" /> : e.rank === 2 ? <Medal size={15} className="text-slate-300" /> : e.rank === 3 ? <Award size={15} className="text-amber-600" /> : <span className="font-mono text-xs text-white/40">{e.rank}</span>}
                </div>
                <span className="flex-1 text-sm font-medium">{e.teamName}</span>
                <span className="text-xs text-white/40">
                  {e.durationMs !== null ? formatDuration(e.durationMs) : "Chưa giải mã"}
                </span>
                <span className="text-sm font-display font-bold text-turquoise">{e.totalScore}đ</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-5 border-red-500/20">
        <h2 className="font-semibold mb-2 text-red-300">Vùng nguy hiểm</h2>
        <p className="text-sm text-white/50 mb-4">
          Đặt lại toàn bộ game sẽ xóa mọi tiến trình, đáp án và điểm số của tất cả các đội. Không thể hoàn tác.
        </p>
        <div className="flex gap-3 items-center flex-wrap">
          <input
            className="input-field w-64"
            placeholder='Gõ "XAC_NHAN_RESET" để xác nhận'
            value={resetConfirm}
            onChange={(e) => setResetConfirm(e.target.value)}
          />
          <button
            className="btn-danger"
            disabled={resetConfirm !== "XAC_NHAN_RESET" || busy === "reset"}
            onClick={() => run("reset", "/admin/game/reset", "Đã đặt lại toàn bộ game.", { confirm: resetConfirm })}
          >
            <RefreshCcw size={16} /> Reset toàn bộ game
          </button>
        </div>
      </div>
    </div>
  );
}
