import { Server } from "socket.io";

let ioInstance: Server | null = null;

export function setIO(io: Server) {
  ioInstance = io;
}

export function getIO(): Server {
  if (!ioInstance) {
    throw new Error("Socket.IO chưa được khởi tạo.");
  }
  return ioInstance;
}

// Tên các phòng (room) socket:
// - `team:<teamId>` : chỉ đội đó nhận cập nhật riêng (giao hồ sơ, mở câu 7, chấm điểm...)
// - `admin`         : tất cả màn hình Admin nhận cập nhật tổng quan/tiến độ theo thời gian thực
export const ROOMS = {
  team: (teamId: string) => `team:${teamId}`,
  admin: "admin",
};

export const EVENTS = {
  TEAM_UPDATED: "team:updated", // gửi lại toàn bộ trạng thái đội (dashboard tự cập nhật)
  CLUE_DELIVERED: "team:clueDelivered",
  QUESTION7_UNLOCKED: "team:question7Unlocked",
  SUBMISSION_REVIEWED: "team:submissionReviewed",
  GAME_STATE_CHANGED: "game:stateChanged",
  LEADERBOARD_PUBLISHED: "game:leaderboardPublished",
  STORY_PUBLISHED: "game:storyPublished",
  ADMIN_PROGRESS_UPDATED: "admin:progressUpdated",
  ADMIN_REVIEW_QUEUE_UPDATED: "admin:reviewQueueUpdated",
};
