import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Crown, Medal, Award, Loader2 } from "lucide-react";
import { api, ApiError } from "../../api/client";
import { LeaderboardEntry } from "../../types";
import { useTeamAuth } from "../../contexts/TeamAuthContext";

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours} giờ ${minutes} phút ${seconds} giây`;
  if (minutes > 0) return `${minutes} phút ${seconds} giây`;
  return `${seconds} giây`;
}

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const { team } = useTeamAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ entries: LeaderboardEntry[] }>("/player/leaderboard")
      .then((res) => setEntries(res.entries))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Không thể tải bảng xếp hạng."));
  }, []);

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-10 backdrop-blur-md bg-ink/80 border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="text-white/60 hover:text-white transition">
            <ArrowLeft size={20} />
          </button>
          <span className="text-sm text-white/50">Bảng xếp hạng</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-8">
        <h1 className="text-3xl font-display font-bold text-center mb-8">
          Bảng <span className="text-turquoise">Xếp Hạng</span>
        </h1>

        {error && <div className="card p-6 text-center text-white/70">{error}</div>}

        {!entries && !error && (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-turquoise" size={28} />
          </div>
        )}

        {entries && (
          <div className="space-y-3">
            {entries.map((e) => (
              <div
                key={e.teamId}
                className={`card p-4 flex items-center gap-4 ${
                  e.teamId === team?.id ? "border-turquoise/60" : ""
                }`}
              >
                <div className="w-10 flex justify-center">
                  {e.rank === 1 ? (
                    <Crown className="text-yellow-400" size={24} />
                  ) : e.rank === 2 ? (
                    <Medal className="text-slate-300" size={22} />
                  ) : e.rank === 3 ? (
                    <Award className="text-amber-600" size={22} />
                  ) : (
                    <span className="font-mono font-bold text-white/40">{e.rank}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    {e.teamName} {e.teamId === team?.id && <span className="text-turquoise text-xs">(đội bạn)</span>}
                  </p>
                  <p className="text-xs text-white/40">
                    {e.durationMs !== null
                      ? `Hoàn thành trong ${formatDuration(e.durationMs)}`
                      : "Chưa giải mã xong"}{" "}
                    {e.isTie && "· Đồng hạng"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
