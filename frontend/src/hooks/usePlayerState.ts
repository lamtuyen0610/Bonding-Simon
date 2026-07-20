import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { getSocket } from "../api/socket";
import { PlayerMeResponse } from "../types";

export function usePlayerState() {
  const [data, setData] = useState<PlayerMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<PlayerMeResponse>("/player/me");
      setData(res);
      setError(null);
    } catch {
      setError("Không thể tải dữ liệu. Kiểm tra kết nối mạng và thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const socket = getSocket();
    if (!socket) return;

    const events = [
      "team:updated",
      "team:clueDelivered",
      "team:question7Unlocked",
      "team:submissionReviewed",
      "game:stateChanged",
      "game:leaderboardPublished",
      "game:storyPublished",
    ];
    const handler = () => refresh();
    events.forEach((ev) => socket.on(ev, handler));
    socket.on("connect", handler);

    return () => {
      events.forEach((ev) => socket.off(ev, handler));
      socket.off("connect", handler);
    };
  }, [refresh]);

  return { data, loading, error, refresh };
}
