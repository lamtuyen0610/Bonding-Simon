import { useEffect } from "react";
import { getSocket } from "../api/socket";

const ADMIN_EVENTS = ["admin:progressUpdated", "admin:reviewQueueUpdated", "game:stateChanged"];

/**
 * Gọi lại `onUpdate` mỗi khi có sự kiện realtime liên quan tới Admin,
 * để các màn hình như Tổng quan/Tiến độ/Hàng đợi tự cập nhật không cần refresh.
 */
export function useAdminSocket(onUpdate: () => void) {
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = () => onUpdate();
    ADMIN_EVENTS.forEach((ev) => socket.on(ev, handler));
    socket.on("connect", handler);
    return () => {
      ADMIN_EVENTS.forEach((ev) => socket.off(ev, handler));
      socket.off("connect", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
