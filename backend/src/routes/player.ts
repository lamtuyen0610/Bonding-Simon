import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../db";
import { requireTeam } from "../middleware/auth";
import { normalizeAnswer } from "../utils/normalize";
import {
  computeQuestionStateForTeam,
  computeTotalScore,
  maybeAdvanceToWaitingForFinal,
} from "../services/gameLogic";
import { getIO, ROOMS, EVENTS } from "../sockets/io";
import { computeLeaderboard } from "../services/leaderboard";

export const playerRouter = Router();
playerRouter.use(requireTeam);

const answerRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.ANSWER_RATE_LIMIT_PER_MINUTE || 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.team?.teamId || req.ip || "unknown",
  message: { error: "Đội của bạn đang gửi đáp án quá nhanh. Vui lòng thử lại sau ít phút." },
});

/**
 * Trạng thái tổng hợp của Dashboard: điểm, tiến trình, danh sách câu hỏi (đã lọc theo khóa),
 * trạng thái nhận hồ sơ, trạng thái game. KHÔNG bao giờ trả đáp án đúng.
 */
playerRouter.get("/me", async (req, res) => {
  const teamId = req.team!.teamId;
  const team = await prisma.team.findUnique({ where: { id: teamId }, include: { submissions: true } });
  if (!team) return res.status(404).json({ error: "Không tìm thấy đội." });

  const gameSession = await prisma.gameSession.findFirst({ orderBy: { createdAt: "desc" } });
  const questions = await prisma.question.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
  });

  // Câu hỏi số 7 hoàn toàn ẩn khỏi payload cho đến khi Admin mở khóa,
  // không chỉ "locked" - để không thể dò ra nội dung qua devtools.
  const visibleQuestions = questions.filter((q) => !q.isFinalQuestion || team.question7Unlocked);

  const questionStates = visibleQuestions.map((q) =>
    computeQuestionStateForTeam(q, team, team.submissions)
  );

  res.json({
    team: {
      id: team.id,
      name: team.name,
      status: team.status,
      totalScore: computeTotalScore(team.submissions),
      clue1Delivered: team.clue1Delivered,
      clue2Delivered: team.clue2Delivered,
      question7Unlocked: team.question7Unlocked,
      sixTasksCompletedAt: team.sixTasksCompletedAt,
      finalQuestionCompletedAt: team.finalQuestionCompletedAt,
    },
    game: {
      status: gameSession?.status ?? "DRAFT",
      showLiveRanking: gameSession?.showLiveRanking ?? false,
      leaderboardPublished: !!gameSession?.leaderboardPublishedAt,
      storyPublished: !!gameSession?.storyPublishedAt,
    },
    questions: questionStates,
  });
});

const draftSchema = z.object({ questionId: z.string(), answer: z.string() });

playerRouter.post("/answers/draft", async (req, res) => {
  const parsed = draftSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ." });
  const teamId = req.team!.teamId;
  const { questionId, answer } = parsed.data;

  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question || !question.isActive) return res.status(404).json({ error: "Không tìm thấy câu hỏi." });

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return res.status(404).json({ error: "Không tìm thấy đội." });

  if (question.isFinalQuestion && !team.question7Unlocked) {
    return res.status(403).json({ error: "Câu hỏi số 7 chưa được mở khóa." });
  }

  // Xóa nháp cũ, lưu nháp mới (mỗi câu chỉ giữ 1 bản nháp gần nhất)
  await prisma.submission.deleteMany({ where: { teamId, questionId, isDraft: true } });
  await prisma.submission.create({
    data: { teamId, questionId, answer, isDraft: true, status: "PENDING_REVIEW" },
  });

  res.json({ ok: true });
});

const submitSchema = z.object({ questionId: z.string(), answer: z.string().min(1, "Vui lòng nhập đáp án.") });

playerRouter.post("/answers/submit", answerRateLimit, async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Dữ liệu không hợp lệ." });
  }
  const teamId = req.team!.teamId;
  const { questionId, answer } = parsed.data;

  const gameSession = await prisma.gameSession.findFirst({ orderBy: { createdAt: "desc" } });
  if (!gameSession || gameSession.status === "FINISHED" || gameSession.status === "LEADERBOARD_PUBLISHED" || gameSession.status === "STORY_PUBLISHED") {
    return res.status(403).json({ error: "Trò chơi đã kết thúc, không thể gửi thêm đáp án." });
  }
  if (gameSession.status === "PAUSED") {
    return res.status(403).json({ error: "Trò chơi đang tạm dừng. Vui lòng chờ Ban tổ chức tiếp tục." });
  }
  if (gameSession.status === "DRAFT") {
    return res.status(403).json({ error: "Trò chơi chưa bắt đầu." });
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { acceptedAnswers: true },
  });
  if (!question || !question.isActive) return res.status(404).json({ error: "Không tìm thấy câu hỏi." });

  const team = await prisma.team.findUnique({ where: { id: teamId }, include: { submissions: true } });
  if (!team) return res.status(404).json({ error: "Không tìm thấy đội." });

  if (team.isDisqualified) {
    return res.status(403).json({ error: "Đội của bạn không còn tham gia trò chơi." });
  }

  // Chặn bỏ qua bước: kiểm tra khóa ở backend, không tin tưởng frontend.
  if (question.isFinalQuestion && !team.question7Unlocked) {
    return res.status(403).json({ error: "Câu hỏi số 7 chưa được mở khóa cho đội của bạn." });
  }
  if (question.prerequisiteStage === "CLUE1" && !team.clue1Delivered) {
    return res.status(403).json({ error: "Bạn cần nhận Tập hồ sơ số 1 trước khi trả lời câu hỏi này." });
  }
  if (question.prerequisiteStage === "CLUE2" && !team.clue2Delivered) {
    return res.status(403).json({ error: "Bạn cần nhận Tập hồ sơ số 2 trước khi trả lời câu hỏi này." });
  }

  const existingReal = team.submissions.filter((s) => s.questionId === questionId && !s.isDraft);
  const lastCorrect = existingReal.find((s) => s.status === "CORRECT");
  if (lastCorrect) {
    return res.status(409).json({ error: "Câu hỏi này đã được trả lời đúng và không thể gửi lại." });
  }
  const lastAny = existingReal.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())[0];
  if (lastAny && lastAny.status === "PENDING_REVIEW") {
    return res.status(409).json({ error: "Đáp án trước của bạn đang chờ Ban tổ chức kiểm tra." });
  }
  if (lastAny && lastAny.status === "INCORRECT") {
    return res.status(403).json({ error: "Đáp án đã sai và chưa được phép trả lời lại." });
  }

  // Xóa nháp sau khi gửi chính thức
  await prisma.submission.deleteMany({ where: { teamId, questionId, isDraft: true } });

  let status: "PENDING_REVIEW" | "CORRECT" | "INCORRECT" = "PENDING_REVIEW";
  let awardedPoints = 0;
  let reviewedAt: Date | null = null;

  if (question.validationMode === "AUTO") {
    const normalized = normalizeAnswer(answer);
    const isCorrect = question.acceptedAnswers.some((a) => a.normalizedAnswer === normalized);
    status = isCorrect ? "CORRECT" : "INCORRECT";
    awardedPoints = isCorrect ? question.points : 0;
    reviewedAt = new Date();
  }

  const submission = await prisma.submission.create({
    data: {
      teamId,
      questionId,
      answer,
      status,
      awardedPoints,
      reviewedAt: reviewedAt ?? undefined,
      reviewedBy: status !== "PENDING_REVIEW" ? "system:auto" : undefined,
    },
  });

    if (status === "CORRECT") {
    await onCorrectAnswer(teamId, question.code);
  }

  const io = getIO();
  io.to(ROOMS.team(teamId)).emit(EVENTS.TEAM_UPDATED, { reason: "submission", questionId });
  io.to(ROOMS.admin).emit(EVENTS.ADMIN_PROGRESS_UPDATED, { teamId });
  if (status === "PENDING_REVIEW") {
    io.to(ROOMS.admin).emit(EVENTS.ADMIN_REVIEW_QUEUE_UPDATED, { teamId });
  }

  res.json({
    submission: {
      id: submission.id,
      status: submission.status,
      awardedPoints: submission.awardedPoints,
    },
  });
});

/**
 * Xử lý các hệ quả khi 1 đáp án được xác nhận đúng (tự động hoặc do Admin chấm):
 * - Câu TOY đúng -> đội đủ điều kiện nhận Tập hồ sơ số 1 (Admin xác nhận giao riêng)
 * - Câu SAFE đúng -> đội đủ điều kiện nhận Tập hồ sơ số 2 (Admin xác nhận giao riêng)
 * - Kiểm tra xem đã đủ 6/6 nhiệm vụ chưa để chuyển trạng thái chờ câu 7
 */
export async function onCorrectAnswer(teamId: string, questionCode: string) {
  await maybeAdvanceToWaitingForFinal(teamId);

  if (questionCode === "FINAL") {
    await prisma.team.update({
      where: { id: teamId },
      data: { finalQuestionCompletedAt: new Date(), status: "COMPLETED", completedAt: new Date() },
    });
  }

  return prisma.team.findUniqueOrThrow({ where: { id: teamId } });
}

// Trả về bảng xếp hạng (chỉ khi Admin đã công bố)
playerRouter.get("/leaderboard", async (_req, res) => {
  const gameSession = await prisma.gameSession.findFirst({ orderBy: { createdAt: "desc" } });
  if (!gameSession?.leaderboardPublishedAt) {
    return res.status(403).json({ error: "Bảng xếp hạng chưa được công bố." });
  }
  const entries = await computeLeaderboard();
  res.json({ entries });
});

// Trả về diễn biến vụ án (chỉ khi Admin đã công bố)
playerRouter.get("/story", async (_req, res) => {
  const gameSession = await prisma.gameSession.findFirst({ orderBy: { createdAt: "desc" } });
  if (!gameSession?.storyPublishedAt) {
    return res.status(403).json({ error: "Diễn biến vụ án chưa được công bố." });
  }
  const chapters = await prisma.storyChapter.findMany({ orderBy: { order: "asc" } });
  res.json({ chapters });
});
