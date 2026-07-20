import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ScrollText, Puzzle, Trophy, FileLock2, ArrowRight } from "lucide-react";
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
              desc="Ngay khi bắt đầu, đội của bạn sẽ thấy 6 nhiệm vụ điều tra. Bạn có thể chọn giải bất kỳ nhiệm vụ nào trước, không cần theo đúng thứ tự."
            />
            <Rule
              icon={<FileLock2 size={20} className="text-turquoise" />}
              title="Một số hồ sơ do Ban tổ chức trao trực tiếp"
              desc="Khi trả lời đúng một số câu hỏi mốc, hệ thống sẽ nhắc đội liên hệ Ban tổ chức để nhận tập hồ sơ vật lý — trong đó chứa manh mối cho các bước tiếp theo."
            />
            <Rule
              icon={<ScrollText size={20} className="text-purple-soft" />}
              title="Câu hỏi số 7 là thử thách cuối cùng"
              desc="Sau khi hoàn thành đủ 6/6 nhiệm vụ, đội sẽ chờ Ban tổ chức mở khóa câu hỏi cuối cùng để khép lại vụ án."
            />
            <Rule
              icon={<Trophy size={20} className="text-turquoise" />}
              title="Tính điểm & xếp hạng"
              desc="Mỗi câu trả lời đúng được cộng điểm tương ứng. Khi trò chơi kết thúc, Ban tổ chức sẽ công bố bảng xếp hạng và toàn bộ diễn biến vụ án."
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
