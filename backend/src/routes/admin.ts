import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAdmin } from "../middleware/auth";
import { generateJoinCode } from "../utils/auth";
import { normalizeAnswer } from "../utils/normalize";
import { computeTotalScore, NON_FINAL_QUESTION_COUNT } from "../services/gameLogic";
import { onCorrectAnswer } from "./player";
import { computeLeaderboard } from "../services/leaderboard";
import { logAdminAction } from "../services/audit";
import { getIO, ROOMS, EVENTS } from "../sockets/io";

export const adminRouter = Router();
adminRouter.use(requireAdmin);

// ---------- TỔNG QUAN ----------
adminRouter.get("/overview", async (_req, res) => {
  const [teams, pendingCount, gameSession] = await Promise.all([
    prisma.team.findMany({ include: { submissions: true } }),
    prisma.submission.count({ where: { status: "PENDING_REVIEW", isDraft: false } }),
    prisma.gameSession.findFirst({ orderBy: { createdAt: "desc" } }),
  ]);

  const activeTeams = teams.filter((t) => t.isActive && !t.isDisqualified);
  res.json({
    totalTeams: teams.length,
    playingTeams: activeTeams.filter((t) => t.status === "PLAYING").length,
    waitingTeams: activeTeams.filter((t) => t.status === "WAITING_FOR_Q7").length,
    completedTeams: activeTeams.filter((t) => t.status === "COMPLETED").length,
    pendingReviews: pendingCount,
    gameStatus: gameSession?.status ?? "DRAFT",
    startedAt: gameSession?.startedAt ?? null,
    showLiveRanking: gameSession?.showLiveRanking ?? false,
  });
});

// ---------- QUẢN LÝ ĐỘI ----------
adminRouter.get("/teams", async (_req, res) => {
  const teams = await prisma.team.findMany({
    include: { submissions: true },
    orderBy: { createdAt: "asc" },
  });
  res.json({
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      joinCode: t.joinCode,
      status: t.status,
      isActive: t.isActive,
      isDisqualified: t.isDisqualified,
      totalScore: computeTotalScore(t.submissions),
      clue1Delivered: t.clue1Delivered,
      clue2Delivered: t.clue2Delivered,
      question7Unlocked: t.question7Unlocked,
      sixTasksCompletedAt: t.sixTasksCompletedAt,
      finalQuestionCompletedAt: t.finalQuestionCompletedAt,
    })),
  });
});

adminRouter.get("/teams/:teamId", async (req, res) => {
  const team = await prisma.team.findUnique({
    where: { id: req.params.teamId },
    include: { submissions: { include: { question: true }, orderBy: { submittedAt: "desc" } } },
  });
  if (!team) return res.status(404).json({ error: "Không tìm thấy đội." });
  res.json({
    team: {
      id: team.id,
      name: team.name,
      joinCode: team.joinCode,
      status: team.status,
      isActive: team.isActive,
      isDisqualified: team.isDisqualified,
      totalScore: computeTotalScore(team.submissions),
      clue1Delivered: team.clue1Delivered,
      clue1DeliveredAt: team.clue1DeliveredAt,
      clue1DeliveredBy: team.clue1DeliveredBy,
      clue2Delivered: team.clue2Delivered,
      clue2DeliveredAt: team.clue2DeliveredAt,
      clue2DeliveredBy: team.clue2DeliveredBy,
      question7Unlocked: team.question7Unlocked,
      sixTasksCompletedAt: team.sixTasksCompletedAt,
      finalQuestionCompletedAt: team.finalQuestionCompletedAt,
      manualRankOverride: team.manualRankOverride,
    },
    submissions: team.submissions
      .filter((s) => !s.isDraft)
      .map((s) => ({
        id: s.id,
        questionCode: s.question.code,
        questionTitle: s.question.title,
        answer: s.answer,
        status: s.status,
        awardedPoints: s.awardedPoints,
        adminNote: s.adminNote,
        submittedAt: s.submittedAt,
        reviewedAt: s.reviewedAt,
        reviewedBy: s.reviewedBy,
      })),
  });
});

const createTeamSchema = z.object({ name: z.string().min(1) });

adminRouter.post("/teams", async (req, res) => {
  const parsed = createTeamSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Vui lòng nhập tên đội." });

  let joinCode = generateJoinCode();
  // Đảm bảo không trùng mã (xác suất rất thấp nhưng vẫn kiểm tra)
  while (await prisma.team.findUnique({ where: { joinCode } })) {
    joinCode = generateJoinCode();
  }

  const team = await prisma.team.create({ data: { name: parsed.data.name, joinCode } });
  await logAdminAction({
    adminId: req.admin!.adminId,
    adminName: req.admin!.username,
    action: "CREATE_TEAM",
    entityType: "Team",
    entityId: team.id,
    metadata: { name: team.name },
  });
  getIO().to(ROOMS.admin).emit(EVENTS.ADMIN_PROGRESS_UPDATED, { teamId: team.id });
  res.status(201).json({ team });
});

const updateTeamSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  isDisqualified: z.boolean().optional(),
  manualRankOverride: z.number().int().nullable().optional(),
});

adminRouter.patch("/teams/:teamId", async (req, res) => {
  const parsed = updateTeamSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ." });

  const team = await prisma.team.update({ where: { id: req.params.teamId }, data: parsed.data });
  await logAdminAction({
    adminId: req.admin!.adminId,
    adminName: req.admin!.username,
    action: "UPDATE_TEAM",
    entityType: "Team",
    entityId: team.id,
    metadata: parsed.data,
  });
  getIO().to(ROOMS.admin).emit(EVENTS.ADMIN_PROGRESS_UPDATED, { teamId: team.id });
  getIO().to(ROOMS.team(team.id)).emit(EVENTS.TEAM_UPDATED, { reason: "admin_update" });
  res.json({ team });
});

adminRouter.post("/teams/:teamId/regenerate-code", async (req, res) => {
  let joinCode = generateJoinCode();
  while (await prisma.team.findUnique({ where: { joinCode } })) {
    joinCode = generateJoinCode();
  }
  const team = await prisma.team.update({ where: { id: req.params.teamId }, data: { joinCode } });
  await logAdminAction({
    adminId: req.admin!.adminId,
    action: "REGENERATE_CODE",
    entityType: "Team",
    entityId: team.id,
  });
  res.json({ team });
});

adminRouter.post("/teams/:teamId/reset", async (req, res) => {
  const teamId = req.params.teamId;
  await prisma.submission.deleteMany({ where: { teamId } });
  const team = await prisma.team.update({
    where: { id: teamId },
    data: {
      status: "PLAYING",
      clue1Delivered: false,
      clue1DeliveredAt: null,
      clue1DeliveredBy: null,
      clue2Delivered: false,
      clue2DeliveredAt: null,
      clue2DeliveredBy: null,
      question7Unlocked: false,
      question7UnlockedAt: null,
      question7UnlockedBy: null,
      sixTasksCompletedAt: null,
      finalQuestionCompletedAt: null,
      completedAt: null,
      manualRankOverride: null,
    },
  });
  await logAdminAction({
    adminId: req.admin!.adminId,
    adminName: req.admin!.username,
    action: "RESET_TEAM_PROGRESS",
    entityType: "Team",
    entityId: team.id,
  });
  getIO().to(ROOMS.team(team.id)).emit(EVENTS.TEAM_UPDATED, { reason: "reset" });
  getIO().to(ROOMS.admin).emit(EVENTS.ADMIN_PROGRESS_UPDATED, { teamId: team.id });
  res.json({ team });
});

/**
 * Xóa HẲN 1 đội, kèm toàn bộ lịch sử trả lời (Submission được xóa theo nhờ cascade
 * delete đã khai báo trong schema). Đây là thao tác không thể hoàn tác — dùng khi cần
 * dọn dữ liệu đội test/rác, khác với "Vô hiệu hóa" (chỉ ẩn, vẫn giữ dữ liệu).
 */
adminRouter.delete("/teams/:teamId", async (req, res) => {
  const team = await prisma.team.findUnique({ where: { id: req.params.teamId } });
  if (!team) return res.status(404).json({ error: "Không tìm thấy đội." });

  await prisma.team.delete({ where: { id: team.id } });

  await logAdminAction({
    adminId: req.admin!.adminId,
    adminName: req.admin!.username,
    action: "DELETE_TEAM",
    entityType: "Team",
    entityId: team.id,
    metadata: { name: team.name },
  });
  getIO().to(ROOMS.admin).emit(EVENTS.ADMIN_PROGRESS_UPDATED, {});
  res.json({ ok: true });
});

// ---------- BẢNG TIẾN ĐỘ TRỰC TIẾP ----------
adminRouter.get("/progress", async (_req, res) => {
  const teams = await prisma.team.findMany({
    include: { submissions: { include: { question: true } } },
    orderBy: { createdAt: "asc" },
  });
  const questions = await prisma.question.findMany({ orderBy: { order: "asc" } });

  const rows = teams.map((t) => {
    const perQuestion: Record<string, string> = {};
    for (const q of questions) {
      const subs = t.submissions.filter((s) => s.questionId === q.id && !s.isDraft);
      const latest = subs.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())[0];
      perQuestion[q.code] = latest?.status ?? "NOT_STARTED";
    }
    const completedCount = questions.filter(
      (q) => !q.isFinalQuestion && perQuestion[q.code] === "CORRECT"
    ).length;

    return {
      teamId: t.id,
      teamName: t.name,
      perQuestion,
      sixTasksProgress: `${completedCount}/${NON_FINAL_QUESTION_COUNT}`,
      clue1Delivered: t.clue1Delivered,
      clue2Delivered: t.clue2Delivered,
      question7Unlocked: t.question7Unlocked,
      totalScore: computeTotalScore(t.submissions),
      status: t.status,
    };
  });

  res.json({ questions: questions.map((q) => ({ code: q.code, title: q.title })), rows });
});

// ---------- HÀNG ĐỢI CHẤM ĐÁP ÁN ----------
adminRouter.get("/review-queue", async (req, res) => {
  const statusFilter = (req.query.status as string) || "PENDING_REVIEW";
  const where =
    statusFilter === "ALL"
      ? { isDraft: false }
      : { isDraft: false, status: statusFilter as "PENDING_REVIEW" | "CORRECT" | "INCORRECT" | "RETRY_ALLOWED" };

  const submissions = await prisma.submission.findMany({
    where,
    include: { team: true, question: true },
    orderBy: { submittedAt: "asc" },
  });

  res.json({
    submissions: submissions.map((s) => ({
      id: s.id,
      teamId: s.teamId,
      teamName: s.team.name,
      questionId: s.questionId,
      questionCode: s.question.code,
      questionTitle: s.question.title,
      questionPoints: s.question.points,
      answer: s.answer,
      status: s.status,
      awardedPoints: s.awardedPoints,
      adminNote: s.adminNote,
      submittedAt: s.submittedAt,
    })),
  });
});

const reviewSchema = z.object({
  decision: z.enum(["CORRECT", "INCORRECT", "RETRY_ALLOWED"]),
  awardedPoints: z.number().int().min(0).optional(),
  adminNote: z.string().optional(),
});

adminRouter.post("/review/:submissionId", async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ." });

  const submission = await prisma.submission.findUnique({
    where: { id: req.params.submissionId },
    include: { question: true },
  });
  if (!submission) return res.status(404).json({ error: "Không tìm thấy đáp án." });

  const awardedPoints =
    parsed.data.decision === "CORRECT"
      ? parsed.data.awardedPoints ?? submission.question.points
      : 0;

  const updated = await prisma.submission.update({
    where: { id: submission.id },
    data: {
      status: parsed.data.decision,
      awardedPoints,
      adminNote: parsed.data.adminNote,
      reviewedAt: new Date(),
      reviewedBy: req.admin!.username,
    },
  });

  if (parsed.data.decision === "CORRECT") {
    await onCorrectAnswer(submission.teamId, submission.question.code);
  }

  await logAdminAction({
    adminId: req.admin!.adminId,
    adminName: req.admin!.username,
    action: "REVIEW_SUBMISSION",
    entityType: "Submission",
    entityId: submission.id,
    metadata: { decision: parsed.data.decision, awardedPoints },
  });

  const io = getIO();
  io.to(ROOMS.team(submission.teamId)).emit(EVENTS.SUBMISSION_REVIEWED, { questionId: submission.questionId });
  io.to(ROOMS.team(submission.teamId)).emit(EVENTS.TEAM_UPDATED, { reason: "reviewed" });
  io.to(ROOMS.admin).emit(EVENTS.ADMIN_PROGRESS_UPDATED, { teamId: submission.teamId });
  io.to(ROOMS.admin).emit(EVENTS.ADMIN_REVIEW_QUEUE_UPDATED, {});

  res.json({ submission: updated });
});

// ---------- GIAO HỒ SƠ ----------
adminRouter.post("/teams/:teamId/deliver-clue1", async (req, res) => {
  const team = await prisma.team.update({
    where: { id: req.params.teamId },
    data: { clue1Delivered: true, clue1DeliveredAt: new Date(), clue1DeliveredBy: req.admin!.username },
  });
  await logAdminAction({
    adminId: req.admin!.adminId,
    adminName: req.admin!.username,
    action: "DELIVER_CLUE1",
    entityType: "Team",
    entityId: team.id,
  });
  const io = getIO();
  io.to(ROOMS.team(team.id)).emit(EVENTS.CLUE_DELIVERED, { clue: 1 });
  io.to(ROOMS.team(team.id)).emit(EVENTS.TEAM_UPDATED, { reason: "clue1" });
  io.to(ROOMS.admin).emit(EVENTS.ADMIN_PROGRESS_UPDATED, { teamId: team.id });
  res.json({ team });
});

adminRouter.post("/teams/:teamId/deliver-clue2", async (req, res) => {
  const team = await prisma.team.update({
    where: { id: req.params.teamId },
    data: { clue2Delivered: true, clue2DeliveredAt: new Date(), clue2DeliveredBy: req.admin!.username },
  });
  await logAdminAction({
    adminId: req.admin!.adminId,
    adminName: req.admin!.username,
    action: "DELIVER_CLUE2",
    entityType: "Team",
    entityId: team.id,
  });
  const io = getIO();
  io.to(ROOMS.team(team.id)).emit(EVENTS.CLUE_DELIVERED, { clue: 2 });
  io.to(ROOMS.team(team.id)).emit(EVENTS.TEAM_UPDATED, { reason: "clue2" });
  io.to(ROOMS.admin).emit(EVENTS.ADMIN_PROGRESS_UPDATED, { teamId: team.id });
  res.json({ team });
});

// ---------- MỞ KHÓA CÂU HỎI SỐ 7 ----------
adminRouter.post("/teams/:teamId/unlock-question7", async (req, res) => {
  const team = await prisma.team.findUnique({ where: { id: req.params.teamId } });
  if (!team) return res.status(404).json({ error: "Không tìm thấy đội." });
  if (!team.sixTasksCompletedAt) {
    return res.status(400).json({ error: "Đội chưa hoàn thành đủ 6/6 nhiệm vụ." });
  }

  const updated = await prisma.team.update({
    where: { id: team.id },
    data: {
      question7Unlocked: true,
      question7UnlockedAt: new Date(),
      question7UnlockedBy: req.admin!.username,
    },
  });
  await logAdminAction({
    adminId: req.admin!.adminId,
    adminName: req.admin!.username,
    action: "UNLOCK_QUESTION7",
    entityType: "Team",
    entityId: team.id,
  });
  const io = getIO();
  io.to(ROOMS.team(team.id)).emit(EVENTS.QUESTION7_UNLOCKED, {});
  io.to(ROOMS.team(team.id)).emit(EVENTS.TEAM_UPDATED, { reason: "question7" });
  io.to(ROOMS.admin).emit(EVENTS.ADMIN_PROGRESS_UPDATED, { teamId: team.id });
  res.json({ team: updated });
});

// ---------- QUẢN LÝ CÂU HỎI ----------
adminRouter.get("/questions", async (_req, res) => {
  const questions = await prisma.question.findMany({
    include: { acceptedAnswers: true },
    orderBy: { order: "asc" },
  });
  res.json({ questions });
});

const questionUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  points: z.number().int().min(0).optional(),
  order: z.number().int().optional(),
  type: z.enum(["TEXT", "SAFE_DIAL", "MULTIPLE_CHOICE"]).optional(),
  validationMode: z.enum(["AUTO", "MANUAL"]).optional(),
  revealMode: z.enum(["IMMEDIATE", "DEFERRED"]).optional(),
  successMessage: z.string().optional(),
  options: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  allowRetryDefault: z.boolean().optional(),
  acceptedAnswers: z.array(z.string()).optional(),
  safeDialConfig: z.string().optional(),
});

adminRouter.patch("/questions/:questionId", async (req, res) => {
  const parsed = questionUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ." });
  const { acceptedAnswers, options, ...rest } = parsed.data;

  const question = await prisma.question.update({
    where: { id: req.params.questionId },
    data: { ...rest, options: options ? JSON.stringify(options) : undefined },
  });

  if (acceptedAnswers) {
    await prisma.acceptedAnswer.deleteMany({ where: { questionId: question.id } });
    await prisma.acceptedAnswer.createMany({
      data: acceptedAnswers.map((a) => ({
        questionId: question.id,
        answer: a,
        normalizedAnswer: normalizeAnswer(a),
      })),
    });
  }

  await logAdminAction({
    adminId: req.admin!.adminId,
    adminName: req.admin!.username,
    action: "UPDATE_QUESTION",
    entityType: "Question",
    entityId: question.id,
    metadata: { fields: Object.keys(req.body) },
  });

  res.json({ question });
});

// ---------- ĐIỀU KHIỂN GAME ----------
async function getOrCreateSession() {
  const existing = await prisma.gameSession.findFirst({ orderBy: { createdAt: "desc" } });
  if (existing) return existing;
  return prisma.gameSession.create({ data: {} });
}

adminRouter.get("/game", async (_req, res) => {
  const session = await getOrCreateSession();
  res.json({ session });
});

adminRouter.post("/game/start", async (req, res) => {
  const session = await getOrCreateSession();
  const updated = await prisma.gameSession.update({
    where: { id: session.id },
    data: { status: "RUNNING", startedAt: session.startedAt ?? new Date() },
  });
  await logAdminAction({ adminId: req.admin!.adminId, adminName: req.admin!.username, action: "START_GAME", entityType: "GameSession", entityId: session.id });
  getIO().emit(EVENTS.GAME_STATE_CHANGED, { status: updated.status });
  res.json({ session: updated });
});

adminRouter.post("/game/pause", async (req, res) => {
  const session = await getOrCreateSession();
  const updated = await prisma.gameSession.update({ where: { id: session.id }, data: { status: "PAUSED", pausedAt: new Date() } });
  await logAdminAction({ adminId: req.admin!.adminId, adminName: req.admin!.username, action: "PAUSE_GAME", entityType: "GameSession", entityId: session.id });
  getIO().emit(EVENTS.GAME_STATE_CHANGED, { status: updated.status });
  res.json({ session: updated });
});

adminRouter.post("/game/resume", async (req, res) => {
  const session = await getOrCreateSession();
  const updated = await prisma.gameSession.update({ where: { id: session.id }, data: { status: "RUNNING", pausedAt: null } });
  await logAdminAction({ adminId: req.admin!.adminId, adminName: req.admin!.username, action: "RESUME_GAME", entityType: "GameSession", entityId: session.id });
  getIO().emit(EVENTS.GAME_STATE_CHANGED, { status: updated.status });
  res.json({ session: updated });
});

adminRouter.post("/game/toggle-live-ranking", async (req, res) => {
  const session = await getOrCreateSession();
  const updated = await prisma.gameSession.update({
    where: { id: session.id },
    data: { showLiveRanking: !session.showLiveRanking },
  });
  getIO().emit(EVENTS.GAME_STATE_CHANGED, { showLiveRanking: updated.showLiveRanking });
  res.json({ session: updated });
});

adminRouter.post("/game/end", async (req, res) => {
  const session = await getOrCreateSession();
  const updated = await prisma.gameSession.update({
    where: { id: session.id },
    data: { status: "FINISHED", endedAt: new Date() },
  });
  await logAdminAction({ adminId: req.admin!.adminId, adminName: req.admin!.username, action: "END_GAME", entityType: "GameSession", entityId: session.id });
  getIO().emit(EVENTS.GAME_STATE_CHANGED, { status: updated.status });
  res.json({ session: updated });
});

adminRouter.post("/game/publish-leaderboard", async (req, res) => {
  const session = await getOrCreateSession();
  const updated = await prisma.gameSession.update({
    where: { id: session.id },
    data: { status: "LEADERBOARD_PUBLISHED", leaderboardPublishedAt: new Date() },
  });
  await logAdminAction({ adminId: req.admin!.adminId, adminName: req.admin!.username, action: "PUBLISH_LEADERBOARD", entityType: "GameSession", entityId: session.id });
  getIO().emit(EVENTS.LEADERBOARD_PUBLISHED, {});
  getIO().emit(EVENTS.GAME_STATE_CHANGED, { status: updated.status });
  res.json({ session: updated });
});

adminRouter.post("/game/publish-story", async (req, res) => {
  const session = await getOrCreateSession();
  const updated = await prisma.gameSession.update({
    where: { id: session.id },
    data: { status: "STORY_PUBLISHED", storyPublishedAt: new Date() },
  });
  await logAdminAction({ adminId: req.admin!.adminId, adminName: req.admin!.username, action: "PUBLISH_STORY", entityType: "GameSession", entityId: session.id });
  getIO().emit(EVENTS.STORY_PUBLISHED, {});
  getIO().emit(EVENTS.GAME_STATE_CHANGED, { status: updated.status });
  res.json({ session: updated });
});

adminRouter.get("/leaderboard", async (_req, res) => {
  const entries = await computeLeaderboard();
  res.json({ entries });
});

const resetGameSchema = z.object({ confirm: z.literal("XAC_NHAN_RESET") });

adminRouter.post("/game/reset", async (req, res) => {
  const parsed = resetGameSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Cần xác nhận bằng cách gửi confirm: "XAC_NHAN_RESET".' });
  }
  await prisma.submission.deleteMany({});
  await prisma.team.updateMany({
    data: {
      status: "PLAYING",
      totalScore: 0,
      clue1Delivered: false,
      clue1DeliveredAt: null,
      clue2Delivered: false,
      clue2DeliveredAt: null,
      question7Unlocked: false,
      question7UnlockedAt: null,
      sixTasksCompletedAt: null,
      finalQuestionCompletedAt: null,
      completedAt: null,
      manualRankOverride: null,
    },
  });
  const session = await getOrCreateSession();
  const updated = await prisma.gameSession.update({
    where: { id: session.id },
    data: {
      status: "DRAFT",
      startedAt: null,
      pausedAt: null,
      endedAt: null,
      leaderboardPublishedAt: null,
      storyPublishedAt: null,
    },
  });
  await logAdminAction({ adminId: req.admin!.adminId, adminName: req.admin!.username, action: "RESET_GAME", entityType: "GameSession", entityId: session.id });
  getIO().emit(EVENTS.GAME_STATE_CHANGED, { status: updated.status });
  res.json({ session: updated });
});

// ---------- QUẢN LÝ DIỄN BIẾN VỤ ÁN ----------
adminRouter.get("/story-chapters", async (_req, res) => {
  const chapters = await prisma.storyChapter.findMany({ orderBy: { order: "asc" } });
  res.json({ chapters });
});

const chapterSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  order: z.number().int(),
  presenterNote: z.string().optional(),
  imageUrl: z.string().optional(),
});

adminRouter.post("/story-chapters", async (req, res) => {
  const parsed = chapterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ." });
  const chapter = await prisma.storyChapter.create({ data: parsed.data });
  await logAdminAction({ adminId: req.admin!.adminId, action: "CREATE_CHAPTER", entityType: "StoryChapter", entityId: chapter.id });
  res.status(201).json({ chapter });
});

adminRouter.patch("/story-chapters/:chapterId", async (req, res) => {
  const parsed = chapterSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ." });
  const chapter = await prisma.storyChapter.update({ where: { id: req.params.chapterId }, data: parsed.data });
  await logAdminAction({ adminId: req.admin!.adminId, action: "UPDATE_CHAPTER", entityType: "StoryChapter", entityId: chapter.id });
  res.json({ chapter });
});

adminRouter.delete("/story-chapters/:chapterId", async (req, res) => {
  await prisma.storyChapter.delete({ where: { id: req.params.chapterId } });
  await logAdminAction({ adminId: req.admin!.adminId, action: "DELETE_CHAPTER", entityType: "StoryChapter", entityId: req.params.chapterId });
  res.json({ ok: true });
});

// ---------- NHẬT KÝ HOẠT ĐỘNG ----------
adminRouter.get("/audit-log", async (_req, res) => {
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  res.json({ logs });
});
