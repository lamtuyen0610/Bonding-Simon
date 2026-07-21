import type { ReactNode } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Trophy, Flag, Loader2, ChevronRight, Lock, Sparkles, KeyRound, PartyPopper, RotateCcw } from "lucide-react";
import Logo from "../../components/Logo";
import StatusBadge from "../../components/StatusBadge";
import { useTeamAuth } from "../../contexts/TeamAuthContext";
import { usePlayerState } from "../../hooks/usePlayerState";
import { api, ApiError } from "../../api/client";
import { useToast } from "../../contexts/ToastContext";
import { PlayerQuestion } from "../../types";

// Đếm để hiển thị thanh tiến độ (mang tính động viên, KHÔNG dùng để mở khóa gì):
// - Câu IMMEDIATE: chỉ tính khi đã trả lời ĐÚNG.
// - Câu DEFERRED (ẩn đáp án): tính khi đã "thử" (gửi ít nhất 1 lần), vì đội không được biết
//   đúng/sai để mà tự đối chiếu. Việc mở khóa Câu hỏi số 7 do SERVER quyết định (chỉ khi
//   toàn bộ 6 câu thực sự đúng), không dựa vào con số hiển thị ở đây.
function countsTowardCompletion(q: PlayerQuestion): boolean {
  if (q.revealMode === "DEFERRED") {
    return !["LOCKED", "NOT_STARTED", "DRAFT_SAVED"].includes(q.status);
  }
  return q.status === "CORRECT";
}

/**
 * Xáo trộn thứ tự hiển thị 6 nhiệm vụ theo mã đội — mỗi đội thấy 1 thứ tự "ngẫu nhiên"
 * khác nhau, nhưng thứ tự đó ỔN ĐỊNH qua các lần tải lại trang (không nhảy lung tung mỗi
 * lần refresh) vì được tạo từ chính teamId làm hạt giống (seed).
 */
function seededShuffle<T>(items: T[], seed: string): T[] {
  let state = 0;
  for (let i = 0; i < seed.length; i++) {
    state = (state * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export default function DashboardPage() {
  const { team, logout } = useTeamAuth();
  const { data, loading, error, refresh } = usePlayerState();
  const navigate = useNavigate();
  const toast = useToast();
  const [endingCase, setEndingCase] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [resetting, setResetting] = useState(false);

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-turquoise" size={28} />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-6 text-center text-white/70">{error}</div>
      </div>
    );
  }

  if (!data) return null;

  const nonFinal = seededShuffle(
    data.questions.filter((q) => !q.isFinalQuestion),
    data.team.id
  );
  const finalQ = data.questions.find((q) => q.isFinalQuestion);
  const completedCount = nonFinal.filter(countsTowardCompletion).length;
  const progressPct = Math.round((completedCount / 6) * 100);
  const canEndCase = !!data.team.sixTasksCompletedAt && !data.team.question7Unlocked;
  const finalAnswered = !!finalQ && !["LOCKED", "NOT_STARTED"].includes(finalQ.status);
  const canDecode = finalAnswered && !data.team.caseDecodedAt;
  const decoded = !!data.team.caseDecodedAt;

  async function endCase() {
    setEndingCase(true);
    try {
      await api.post("/player/end-case");
      toast("success", "Đã mở khóa câu hỏi cuối cùng!");
      await refresh();
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Không thể kết thúc vụ án. Vui lòng thử lại.");
    } finally {
      setEndingCase(false);
    }
  }

  async function decodeCase() {
    setDecoding(true);
    try {
      const res = await api.post<{ allCorrect: boolean }>("/player/decode-case");
      if (res.allCorrect) {
        toast("success", "Chính xác toàn bộ! Chúc mừng đội đã giải mã được vụ án 🎉");
      } else {
        toast(
          "error",
          "Chưa đúng hết. Hãy xem lại các câu ẩn đáp án và Câu hỏi số 7 (giờ có thể sửa lại), rồi thử Giải mã lần nữa."
        );
      }
      await refresh();
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Không thể giải mã vụ án. Vui lòng thử lại.");
    } finally {
      setDecoding(false);
    }
  }

  async function resetTeam() {
    if (
      !confirm(
        `Xóa TOÀN BỘ đáp án đã gửi của đội "${team?.name}" và chơi lại từ đầu? Hành động này không thể hoàn tác.`
      )
    ) {
      return;
    }
    setResetting(true);
    try {
      await api.post("/player/reset");
      toast("success", "Đã đặt lại tiến trình. Đội có thể bắt đầu điều tra lại từ đầu.");
      await refresh();
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Không thể đặt lại tiến trình. Vui lòng thử lại.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-10 backdrop-blur-md bg-ink/80 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-4">
            <button
              onClick={resetTeam}
              disabled={resetting}
              className="text-white/40 hover:text-purple-soft transition disabled:opacity-40"
              title="Chơi lại từ đầu"
            >
              {resetting ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />}
            </button>
            <button onClick={logout} className="text-white/40 hover:text-white/80 transition" title="Rời khỏi">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {/* Team summary */}
        <div className="card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="eyebrow mb-1">Đội điều tra</p>
            <h1 className="text-xl sm:text-2xl font-display font-bold">{team?.name}</h1>
          </div>
          {data.game.leaderboardPublished && (
            <button className="btn-secondary" onClick={() => navigate("/leaderboard")}>
              <Trophy size={16} /> Xếp hạng
            </button>
          )}
        </div>

        {decoded && (
          <div className="card p-6 text-center border-turquoise/40 bg-turquoise/5">
            <PartyPopper className="mx-auto mb-3 text-turquoise" size={28} />
            <p className="font-semibold mb-1 text-turquoise">Đội của bạn đã giải mã thành công vụ án!</p>
            <p className="text-sm text-white/60">Chờ Ban tổ chức công bố bảng xếp hạng và diễn biến đầy đủ.</p>
          </div>
        )}

        {/* Progress bar */}
        {!decoded && (
          <div className="card p-5">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white/60">Tiến độ 6 nhiệm vụ đầu tiên (đã thử)</span>
              <span className="font-semibold text-turquoise">{completedCount}/6</span>
            </div>
            <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple to-turquoise transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {completedCount === 6 && !canEndCase && !data.team.sixTasksCompletedAt && (
              <p className="mt-3 text-xs text-white/40">
                Đội đã thử đủ 6 câu, nhưng có thể còn câu chưa đúng — hệ thống không nói rõ câu nào. Hãy xem lại và
                gửi lại đáp án cho những câu chưa chắc chắn.
              </p>
            )}
          </div>
        )}

        {/* Waiting banners */}
        {data.game.status === "PAUSED" && (
          <Banner tone="warn">Trò chơi đang tạm dừng. Vui lòng chờ Ban tổ chức tiếp tục.</Banner>
        )}

        {canEndCase && (
          <div className="card p-6 text-center border-purple/40 bg-purple/5">
            <Sparkles className="mx-auto mb-3 text-purple-soft" size={28} />
            <p className="font-semibold mb-1">Đội của bạn đã hoàn thành 6 nhiệm vụ điều tra!</p>
            <p className="text-sm text-white/60 mb-4">Bấm nút bên dưới để mở khóa câu hỏi cuối cùng.</p>
            <button className="btn-primary mx-auto" onClick={endCase} disabled={endingCase}>
              {endingCase ? <Loader2 size={16} className="animate-spin" /> : <Flag size={16} />}
              Kết thúc vụ án
            </button>
          </div>
        )}

        {canDecode && (
          <div className="card p-6 text-center border-purple/40 bg-purple/5">
            <KeyRound className="mx-auto mb-3 text-purple-soft" size={28} />
            <p className="font-semibold mb-1">Đội đã trả lời xong câu hỏi cuối cùng!</p>
            <p className="text-sm text-white/60 mb-4">
              Bấm "Giải mã vụ án" để kiểm tra toàn bộ đáp án. Nếu có câu sai, đội sẽ được quay lại sửa và thử lại.
            </p>
            <button className="btn-primary mx-auto" onClick={decodeCase} disabled={decoding}>
              {decoding ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              Giải mã vụ án
            </button>
          </div>
        )}

        {/* Task list */}
        {!decoded && (
          <div>
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-3">
              Bảng điều tra — 6 nhiệm vụ
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {nonFinal
                .map((q) => (
                  <button
                    key={q.id}
                    disabled={q.locked}
                    onClick={() => navigate(`/question/${q.id}`)}
                    className={`card p-4 text-left transition group ${
                      q.locked ? "opacity-50 cursor-not-allowed" : "hover:border-turquoise/40 hover:-translate-y-0.5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-white leading-snug">{q.description || q.title}</h3>
                      {q.locked ? (
                        <Lock size={16} className="text-white/30 shrink-0 mt-0.5" />
                      ) : (
                        <ChevronRight size={18} className="text-white/30 shrink-0 mt-0.5 group-hover:text-turquoise transition" />
                      )}
                    </div>
                    {q.status !== "NOT_STARTED" && (
                      <div className="flex items-center">
                        <StatusBadge status={q.status} />
                      </div>
                    )}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Question 7 */}
        {finalQ && !decoded && (
          <div>
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-3">
              Câu hỏi cuối cùng
            </h2>
            <button
              onClick={() => navigate(`/question/${finalQ.id}`)}
              className="card w-full p-5 text-left border-purple/40 hover:border-purple/70 transition flex items-center justify-between"
            >
              <div>
                <h3 className="font-semibold text-lg mb-1">{finalQ.description || finalQ.title}</h3>
                <StatusBadge status={finalQ.status} />
              </div>
              <ChevronRight size={20} className="text-purple-soft" />
            </button>
          </div>
        )}

        {data.game.storyPublished && (
          <button className="btn-secondary w-full" onClick={() => navigate("/story")}>
            Xem diễn biến vụ án
          </button>
        )}
      </main>
    </div>
  );
}

function Banner({ tone, children }: { tone: "info" | "success" | "warn"; children: ReactNode }) {
  const cls =
    tone === "success"
      ? "border-turquoise/40 bg-turquoise/10 text-turquoise"
      : tone === "warn"
      ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
      : "border-purple/40 bg-purple/10 text-purple-soft";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}
