import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Trophy, FileStack, Loader2, ChevronRight, Lock } from "lucide-react";
import Logo from "../../components/Logo";
import StatusBadge from "../../components/StatusBadge";
import { useTeamAuth } from "../../contexts/TeamAuthContext";
import { usePlayerState } from "../../hooks/usePlayerState";

export default function DashboardPage() {
  const { team, logout } = useTeamAuth();
  const { data, loading, error } = usePlayerState();
  const navigate = useNavigate();

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

  const nonFinal = data.questions.filter((q) => !q.isFinalQuestion);
  const finalQ = data.questions.find((q) => q.isFinalQuestion);
  const completedCount = nonFinal.filter((q) => q.status === "CORRECT").length;
  const progressPct = Math.round((completedCount / 6) * 100);

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-10 backdrop-blur-md bg-ink/80 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Logo size="sm" />
          <button onClick={logout} className="text-white/40 hover:text-white/80 transition" title="Rời khỏi">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {/* Team summary */}
        <div className="card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="eyebrow mb-1">Đội điều tra</p>
            <h1 className="text-xl sm:text-2xl font-display font-bold">{team?.name}</h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs text-white/40 mb-0.5">Điểm hiện tại</p>
              <p className="text-2xl font-display font-bold text-turquoise">{data.team.totalScore}</p>
            </div>
            {data.game.leaderboardPublished && (
              <button className="btn-secondary" onClick={() => navigate("/leaderboard")}>
                <Trophy size={16} /> Xếp hạng
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="card p-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-white/60">Tiến độ 6 nhiệm vụ đầu tiên</span>
            <span className="font-semibold text-turquoise">{completedCount}/6</span>
          </div>
          <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple to-turquoise transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Waiting banners */}
        {data.game.status === "PAUSED" && (
          <Banner tone="warn">Trò chơi đang tạm dừng. Vui lòng chờ Ban tổ chức tiếp tục.</Banner>
        )}
        <ClueBanners data={data} />

        {/* Task list */}
        <div>
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-3">
            Bảng điều tra — 6 nhiệm vụ
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {nonFinal
              .sort((a, b) => a.order - b.order)
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
                    <h3 className="font-semibold text-white leading-snug">{q.title}</h3>
                    {q.locked ? (
                      <Lock size={16} className="text-white/30 shrink-0 mt-0.5" />
                    ) : (
                      <ChevronRight size={18} className="text-white/30 shrink-0 mt-0.5 group-hover:text-turquoise transition" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <StatusBadge status={q.status} />
                    <span className="text-xs font-mono text-purple-soft">{q.points} điểm</span>
                  </div>
                </button>
              ))}
          </div>
        </div>

        {/* Question 7 */}
        {finalQ && (
          <div>
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-3">
              Câu hỏi cuối cùng
            </h2>
            <button
              onClick={() => navigate(`/question/${finalQ.id}`)}
              className="card w-full p-5 text-left border-purple/40 hover:border-purple/70 transition flex items-center justify-between"
            >
              <div>
                <h3 className="font-semibold text-lg mb-1">{finalQ.title}</h3>
                <StatusBadge status={finalQ.status} />
              </div>
              <ChevronRight size={20} className="text-purple-soft" />
            </button>
          </div>
        )}

        {completedCount === 6 && !finalQ && (
          <div className="card p-6 text-center border-purple/30">
            <FileStack className="mx-auto mb-3 text-purple-soft" size={28} />
            <p className="font-semibold mb-1">Đội của bạn đã hoàn thành 6 nhiệm vụ điều tra.</p>
            <p className="text-sm text-white/60">Hãy liên hệ Ban tổ chức để nhận câu hỏi cuối cùng.</p>
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

function ClueBanners({ data }: { data: ReturnType<typeof usePlayerState>["data"] }) {
  if (!data) return null;
  const toy = data.questions.find((q) => q.code === "TOY");
  const safe = data.questions.find((q) => q.code === "SAFE");
  const banners: JSX.Element[] = [];

  if (toy?.status === "CORRECT" && !data.team.clue1Delivered) {
    banners.push(
      <Banner key="clue1" tone="info">
        Đáp án chính xác! Hãy liên hệ Ban tổ chức để nhận <b>Tập hồ sơ số 1</b>.
      </Banner>
    );
  }
  if (safe?.status === "CORRECT" && !data.team.clue2Delivered) {
    banners.push(
      <Banner key="clue2" tone="info">
        Két sắt đã được mở! Hãy liên hệ Ban tổ chức để nhận <b>Tập hồ sơ số 2</b>.
      </Banner>
    );
  }
  if (data.team.status === "WAITING_FOR_Q7" && !data.team.question7Unlocked) {
    banners.push(
      <Banner key="q7" tone="success">
        Đội của bạn đã hoàn thành 6 nhiệm vụ điều tra. Hãy liên hệ Ban tổ chức để nhận câu hỏi cuối cùng.
      </Banner>
    );
  }
  if (banners.length === 0) return null;
  return <div className="space-y-3">{banners}</div>;
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
