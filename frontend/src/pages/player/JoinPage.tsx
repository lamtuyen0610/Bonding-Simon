import type { ReactNode } from "react";
import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Users, ArrowRight, Loader2, Puzzle, FileLock2, Trophy } from "lucide-react";
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
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/story/join-bg.jpg)" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-ink/80" aria-hidden="true" />

      <div className="relative min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="card p-6 sm:p-8 mb-6">
            <div className="flex justify-center mb-5">
              <Logo size="lg" />
            </div>
            <p className="text-center eyebrow mb-2">Hoạt động điều tra vụ án · Team bonding</p>
            <p className="text-center text-white/60 text-sm">
              Một vụ án bí ẩn đang chờ đội của bạn khám phá. Nhập tên đội để bắt đầu điều tra.
            </p>
          </div>

          <div className="card p-6 sm:p-8 mb-6">
            <h2 className="text-xl font-display font-bold mb-5">Luật chơi</h2>
            <div className="space-y-5">
              <Rule
                icon={<Puzzle size={18} className="text-purple-soft" />}
                title="6 nhiệm vụ điều tra, tự do lựa chọn"
                desc="Đội có thể chọn giải bất kỳ nhiệm vụ nào, không cần theo đúng thứ tự."
              />
              <Rule
                icon={<FileLock2 size={18} className="text-turquoise" />}
                title="Hồ sơ bổ sung trong quá trình phá án"
                desc="Người chơi sẽ nhận được các bộ hồ sơ bổ sung trong quá trình phá án, trong đó chứa manh mối cho các bước tiếp theo."
              />
              <Rule
                icon={<Trophy size={18} className="text-turquoise" />}
                title="Xếp hạng theo thời gian phá án"
                desc="Đội nào giải mã được toàn bộ vụ án trong thời gian NGẮN NHẤT (tính từ lúc bấm 'Bắt đầu điều tra' đến lúc giải mã thành công) sẽ xếp hạng cao nhất. Ban tổ chức sẽ công bố bảng xếp hạng và toàn bộ diễn biến vụ án khi trò chơi kết thúc."
              />
            </div>
          </div>

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
              />
            </div>

            {error && (
              <div className="border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
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
    </div>
  );
}

function Rule({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 shrink-0 border border-white/10 bg-white/5 p-2 h-fit">{icon}</div>
      <div>
        <h3 className="font-semibold text-white text-sm mb-0.5">{title}</h3>
        <p className="text-xs text-white/60 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
