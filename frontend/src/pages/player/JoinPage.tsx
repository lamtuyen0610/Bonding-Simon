import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Users, ArrowRight, Loader2 } from "lucide-react";
import Logo from "../../components/Logo";
import { useTeamAuth } from "../../contexts/TeamAuthContext";
import { ApiError } from "../../api/client";

export default function JoinPage() {
  const { join } = useTeamAuth();
  const navigate = useNavigate();
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!teamName.trim()) {
      setError("Vui lòng nhập tên đội.");
      return;
    }
    setLoading(true);
    try {
      await join(teamName);
      navigate("/instructions");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>
        <p className="text-center eyebrow mb-2">Hoạt động điều tra vụ án · Team bonding</p>
        <p className="text-center text-white/60 mb-8 text-sm">
          Một vụ án bí ẩn đang chờ đội của bạn khám phá. Nhập tên đội để bắt đầu điều tra.
        </p>

        <form onSubmit={handleSubmit} className="card p-6 sm:p-8 space-y-5">
          <div>
            <label className="text-sm text-white/70 mb-1.5 flex items-center gap-2">
              <Users size={15} /> Tên đội
            </label>
            <input
              className="input-field"
              placeholder="Ví dụ: Đội Thám Tử 01"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
            Bắt đầu điều tra
          </button>
        </form>

        <p className="text-center text-xs text-white/30 mt-6">
          Đặt tên đội tùy thích — đội mới sẽ được tạo tự động khi bạn bắt đầu.
        </p>
      </div>
    </div>
  );
}
