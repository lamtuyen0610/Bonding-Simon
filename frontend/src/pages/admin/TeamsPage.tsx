import type { MouseEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ChevronRight, Trash2, Loader2 } from "lucide-react";
import { api, ApiError } from "../../api/client";
import { useAdminSocket } from "../../hooks/useAdminSocket";
import { useToast } from "../../contexts/ToastContext";

interface TeamRow {
  id: string;
  name: string;
  joinCode: string;
  status: string;
  isActive: boolean;
  isDisqualified: boolean;
  totalScore: number;
  clue1Delivered: boolean;
  clue2Delivered: boolean;
  question7Unlocked: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  PLAYING: "Đang chơi",
  WAITING_FOR_Q7: "Chờ câu 7",
  COMPLETED: "Đã hoàn thành",
  DISQUALIFIED: "Bị loại",
  ARCHIVED: "Lưu trữ",
};

export default function TeamsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [teams, setTeams] = useState<TeamRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<{ teams: TeamRow[] }>("/admin/teams").then((r) => setTeams(r.teams)).catch(() => {});
  }, []);

  useEffect(load, [load]);
  useAdminSocket(load);

  async function createTeam() {
    if (!newName.trim()) return;
    setLoadingCreate(true);
    try {
      await api.post("/admin/teams", { name: newName.trim() });
      toast("success", "Đã tạo đội mới.");
      setNewName("");
      setCreating(false);
      load();
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Không thể tạo đội.");
    } finally {
      setLoadingCreate(false);
    }
  }

  async function deleteTeam(team: TeamRow, e: MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Xóa HẲN đội "${team.name}" khỏi hệ thống, kèm toàn bộ lịch sử trả lời? Không thể hoàn tác.`)) {
      return;
    }
    setDeletingId(team.id);
    try {
      await api.delete(`/admin/teams/${team.id}`);
      toast("success", `Đã xóa đội "${team.name}".`);
      load();
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Không thể xóa đội.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold">Quản lý đội</h1>
        <button className="btn-primary" onClick={() => setCreating((c) => !c)}>
          <Plus size={16} /> Tạo đội
        </button>
      </div>

      {creating && (
        <div className="card p-4 mb-5 flex gap-3">
          <input
            className="input-field"
            placeholder="Tên đội mới"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="btn-primary shrink-0" onClick={createTeam} disabled={loadingCreate}>
            {loadingCreate ? <Loader2 size={16} className="animate-spin" /> : "Lưu"}
          </button>
        </div>
      )}

      {!teams && (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-turquoise" size={24} />
        </div>
      )}

      <div className="space-y-2.5">
        {teams?.map((t) => (
          <div
            key={t.id}
            onClick={() => navigate(`/admin/teams/${t.id}`)}
            className="card w-full p-4 flex items-center justify-between text-left hover:border-turquoise/40 transition cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div>
                <p className="font-semibold">{t.name}</p>
                <p className="text-xs font-mono text-white/40">{t.joinCode}</p>
              </div>
              {!t.isActive && <span className="pill bg-white/10 text-white/40">Vô hiệu hóa</span>}
              {t.isDisqualified && <span className="pill bg-red-500/15 text-red-300">Bị loại</span>}
            </div>
            <div className="flex items-center gap-5">
              <span className="text-xs text-white/50">{STATUS_LABEL[t.status] ?? t.status}</span>
              <span className="font-display font-bold text-turquoise">{t.totalScore}đ</span>
              <button
                onClick={(e) => deleteTeam(t, e)}
                disabled={deletingId === t.id}
                className="text-white/30 hover:text-red-400 transition disabled:opacity-40"
                title="Xóa đội"
              >
                {deletingId === t.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              </button>
              <ChevronRight size={18} className="text-white/30" />
            </div>
          </div>
        ))}
        {teams && teams.length === 0 && (
          <div className="card p-8 text-center text-white/50">Chưa có đội nào. Hãy tạo đội đầu tiên.</div>
        )}
      </div>
    </div>
  );
}
