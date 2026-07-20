import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { Users, Clock, CheckCircle2, ListChecks, Activity } from "lucide-react";
import { api } from "../../api/client";
import { useAdminSocket } from "../../hooks/useAdminSocket";

interface Overview {
  totalTeams: number;
  playingTeams: number;
  waitingTeams: number;
  completedTeams: number;
  pendingReviews: number;
  gameStatus: string;
  startedAt: string | null;
  showLiveRanking: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Chưa bắt đầu",
  RUNNING: "Đang diễn ra",
  PAUSED: "Tạm dừng",
  FINISHED: "Đã kết thúc",
  LEADERBOARD_PUBLISHED: "Đã công bố xếp hạng",
  STORY_PUBLISHED: "Đã công bố diễn biến",
};

export default function OverviewPage() {
  const [data, setData] = useState<Overview | null>(null);

  const load = useCallback(() => {
    api.get<Overview>("/admin/overview").then(setData).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);
  useAdminSocket(load);

  if (!data) return null;

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold">Tổng quan</h1>
        <span className="pill bg-purple/15 text-purple-soft border border-purple/30">
          <Activity size={13} /> {STATUS_LABEL[data.gameStatus] ?? data.gameStatus}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users size={20} />} label="Tổng số đội" value={data.totalTeams} color="purple" />
        <StatCard icon={<Activity size={20} />} label="Đang chơi" value={data.playingTeams} color="turquoise" />
        <StatCard icon={<Clock size={20} />} label="Đang chờ hồ sơ/câu 7" value={data.waitingTeams} color="yellow" />
        <StatCard icon={<CheckCircle2 size={20} />} label="Đã hoàn thành" value={data.completedTeams} color="turquoise" />
      </div>

      <div className="mt-4 grid sm:grid-cols-2 gap-4">
        <StatCard icon={<ListChecks size={20} />} label="Đáp án đang chờ chấm" value={data.pendingReviews} color="purple" wide />
        <div className="card p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-white/50 mb-1">Xếp hạng tạm thời cho Player</p>
            <p className="font-semibold">{data.showLiveRanking ? "Đang bật" : "Đang tắt"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  wide,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  color: "purple" | "turquoise" | "yellow";
  wide?: boolean;
}) {
  const colorCls =
    color === "purple" ? "text-purple-soft" : color === "turquoise" ? "text-turquoise" : "text-yellow-300";
  return (
    <div className={`card p-5 ${wide ? "" : ""}`}>
      <div className={`mb-3 ${colorCls}`}>{icon}</div>
      <p className="text-3xl font-display font-bold mb-1">{value}</p>
      <p className="text-sm text-white/50">{label}</p>
    </div>
  );
}
