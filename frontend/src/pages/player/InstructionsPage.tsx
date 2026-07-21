import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Puzzle, Trophy, FileLock2, ArrowRight } from "lucide-react";
import Logo from "../../components/Logo";
import { useTeamAuth } from "../../contexts/TeamAuthContext";

export default function InstructionsPage() {
  const { team } = useTeamAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="flex justify-center mb-6">
          <Logo />
        </div>
        <div className="card p-6 sm:p-8">
          <p className="eyebrow mb-1">Chào mừng, {team?.name}</p>
          <h1 className="text-2xl sm:text-3xl font-display font-bold mb-6">Luật chơi</h1>

          <div className="space-y-5">
            <Rule
              icon={<Puzzle size={20} className="text-purple-soft" />}
              title="6 nhiệm vụ điều tra, tự do lựa chọn"
              desc="Đội có thể chọn giải bất kỳ nhiệm vụ nào, không cần theo đúng thứ tự."
            />
            <Rule
              icon={<FileLock2 size={20} className="text-turquoise" />}
              title="Hồ sơ bổ sung trong quá trình phá án"
              desc="Người chơi sẽ nhận được các bộ hồ sơ bổ sung trong quá trình phá án, trong đó chứa manh mối cho các bước tiếp theo."
            />
            <Rule
              icon={<Trophy size={20} className="text-turquoise" />}
              title="Tính điểm & xếp hạng"
              desc="Khi trò chơi kết thúc, Ban tổ chức sẽ công bố bảng xếp hạng (theo thứ tự đội giải mã vụ án thành công) và toàn bộ diễn biến vụ án."
            />
          </div>

          <button className="btn-primary w-full mt-8" onClick={() => navigate("/dashboard")}>
            Bắt đầu <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Rule({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="mt-0.5 shrink-0 rounded-lg bg-white/5 border border-white/10 p-2.5 h-fit">{icon}</div>
      <div>
        <h3 className="font-semibold text-white mb-1">{title}</h3>
        <p className="text-sm text-white/60 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
