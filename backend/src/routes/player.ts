import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../db";
import { requireTeam } from "../middleware/auth";
import { normalizeAnswer } from "../utils/normalize";
import {
  computeQuestionStateForTeam,
  computeVisibleTotalScore,
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

  // Câu hỏi số 7 hoàn toàn ẩn khỏi payload cho đến khi đội bấm "Kết thúc vụ án",
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
      totalScore: computeVisibleTotalScore(team, questions, team.submissions),
      clue1Delivered: team.clue1Delivered,
      clue2Delivered: team.clue2Delivered,
      question7Unlocked: team.question7Unlocked,
      sixTasksCompletedAt: team.sixTasksCompletedAt,
      finalQuestionCompletedAt: team.finalQuestionCompletedAt,
      caseDecodedAt: team.caseDecodedAt,
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

  if (question.revealMode === "DEFERRED") {
    if (team.caseDecodedAt) {
      return res.status(409).json({ error: "Vụ án đã được giải mã, không thể sửa đáp án nữa." });
    }
    const lastAny = existingReal.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())[0];
    // Câu ẩn đáp án: chỉ được gửi 1 lần, TRỪ KHI đội đã bấm "Giải mã vụ án" và thất bại
    // (lúc đó đáp án cũ được coi là "cũ/stale" và cho phép trả lời lại).
    if (lastAny) {
      const isStale = team.lastDecodeAttemptAt && lastAny.submittedAt.getTime() < team.lastDecodeAttemptAt.getTime();
      if (!isStale) {
        return res.status(409).json({ error: "Câu hỏi này đã được trả lời và không thể gửi lại." });
      }
    }
  } else {
    const lastCorrect = existingReal.find((s) => s.status === "CORRECT");
    if (lastCorrect) {
      return res.status(409).json({ error: "Câu hỏi này đã được trả lời đúng và không thể gửi lại." });
    }
    const lastAny = existingReal.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())[0];
    if (lastAny && lastAny.status === "PENDING_REVIEW") {
      return res.status(409).json({ error: "Đáp án trước của bạn đang chờ Ban tổ chức kiểm tra." });
    }
    if (lastAny && lastAny.status === "INCORRECT" && !question.allowRetryDefault) {
      return res.status(403).json({ error: "Đáp án đã sai và chưa được phép trả lời lại." });
    }
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
  if (question.revealMode === "DEFERRED") {
    // Câu ẩn đáp án tính là "đã hoàn thành" ngay khi gửi (đúng hay sai chưa biết),
    // nên vẫn cần kiểm tra tiến độ 6/6 dù không phải CORRECT.
    await maybeAdvanceToWaitingForFinal(teamId);
  }

  const io = getIO();
  io.to(ROOMS.team(teamId)).emit(EVENTS.TEAM_UPDATED, { reason: "submission", questionId });
  io.to(ROOMS.admin).emit(EVENTS.ADMIN_PROGRESS_UPDATED, { teamId });
  if (status === "PENDING_REVIEW") {
    io.to(ROOMS.admin).emit(EVENTS.ADMIN_REVIEW_QUEUE_UPDATED, { teamId });
  }

  // Với câu ẩn đáp án, không trả trạng thái đúng/sai thật về cho client.
  const responseStatus = question.revealMode === "DEFERRED" ? "ANSWERED" : status;

  res.json({
    submission: {
      id: submission.id,
      status: responseStatus,
      awardedPoints: question.revealMode === "DEFERRED" ? 0 : submission.awardedPoints,
      successMessage: status === "CORRECT" && question.revealMode !== "DEFERRED" ? question.successMessage : null,
    },
  });
});

/**
 * Đội tự bấm "Kết thúc vụ án" sau khi đã hoàn thành đủ 6/6 nhiệm vụ.
 * Hành động này thay thế bước "Admin mở khóa câu hỏi số 7" trong thiết kế gốc —
 * đội tự mở khóa câu hỏi cuối cùng cho chính mình khi đã sẵn sàng.
 * Đồng thời đây cũng là mốc "tiết lộ" đáp án đúng/sai cho các câu revealMode = DEFERRED.
 */
playerRouter.post("/end-case", async (req, res) => {
  const teamId = req.team!.teamId;
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return res.status(404).json({ error: "Không tìm thấy đội." });

  if (!team.sixTasksCompletedAt) {
    return res.status(400).json({ error: "Đội chưa hoàn thành đủ 6/6 nhiệm vụ điều tra." });
  }

  if (!team.question7Unlocked) {
    await prisma.team.update({
      where: { id: teamId },
      data: {
        question7Unlocked: true,
        question7UnlockedAt: new Date(),
        question7UnlockedBy: "player:self",
      },
    });
    const io = getIO();
    io.to(ROOMS.team(teamId)).emit(EVENTS.QUESTION7_UNLOCKED, {});
    io.to(ROOMS.team(teamId)).emit(EVENTS.TEAM_UPDATED, { reason: "end_case" });
    io.to(ROOMS.admin).emit(EVENTS.ADMIN_PROGRESS_UPDATED, { teamId });
  }

  res.json({ ok: true });
});

/**
 * Xử lý các hệ quả khi 1 đáp án được xác nhận đúng:
 * - Câu TOY đúng -> tự động cấp Tập hồ sơ số 1
 * - Câu SAFE đúng -> tự động cấp Tập hồ sơ số 2
 * - Kiểm tra xem đã đủ 6/6 nhiệm vụ chưa để chuyển trạng thái chờ kết thúc vụ án
 */
export async function onCorrectAnswer(teamId: string, questionCode: string) {
  await maybeAdvanceToWaitingForFinal(teamId);

  if (questionCode === "TOY") {
    await prisma.team.update({
      where: { id: teamId },
      data: { clue1Delivered: true, clue1DeliveredAt: new Date(), clue1DeliveredBy: "system:auto" },
    });
    getIO().to(ROOMS.team(teamId)).emit(EVENTS.CLUE_DELIVERED, { clue: 1 });
  }

  if (questionCode === "SAFE") {
    await prisma.team.update({
      where: { id: teamId },
      data: { clue2Delivered: true, clue2DeliveredAt: new Date(), clue2DeliveredBy: "system:auto" },
    });
    getIO().to(ROOMS.team(teamId)).emit(EVENTS.CLUE_DELIVERED, { clue: 2 });
  }

  return prisma.team.findUniqueOrThrow({ where: { id: teamId } });
}

/**
 * Đội bấm "Giải mã vụ án" sau khi đã trả lời câu hỏi số 7. Kiểm tra TẤT CẢ các câu
 * revealMode = "DEFERRED" (4 câu trong 6 nhiệm vụ + câu hỏi số 7):
 * - Nếu tất cả đều ĐÚNG: đội giải mã thành công, chốt mốc thời gian (dùng để xếp hạng
 *   1, 2, 3... theo thứ tự đội giải mã xong sớm nhất), và tiết lộ toàn bộ đáp án.
 * - Nếu có ít nhất 1 câu sai: KHÔNG tiết lộ câu nào sai — chỉ báo "chưa đúng hết".
 *   Đội phải quay lại trả lời lại các câu ẩn đáp án (kể cả câu 7) rồi bấm giải mã lại.
 */
playerRouter.post("/decode-case", answerRateLimit, async (req, res) => {
  const teamId = req.team!.teamId;

  const gameSession = await prisma.gameSession.findFirst({ orderBy: { createdAt: "desc" } });
  if (!gameSession || ["FINISHED", "LEADERBOARD_PUBLISHED", "STORY_PUBLISHED"].includes(gameSession.status)) {
    return res.status(403).json({ error: "Trò chơi đã kết thúc." });
  }
  if (gameSession.status === "PAUSED") {
    return res.status(403).json({ error: "Trò chơi đang tạm dừng. Vui lòng chờ Ban tổ chức tiếp tục." });
  }

  const team = await prisma.team.findUnique({ where: { id: teamId }, include: { submissions: true } });
  if (!team) return res.status(404).json({ error: "Không tìm thấy đội." });

  if (team.caseDecodedAt) {
    return res.json({ ok: true, allCorrect: true, alreadyDecoded: true });
  }
  if (!team.question7Unlocked) {
    return res.status(400).json({ error: "Câu hỏi số 7 chưa được mở khóa." });
  }

  const finalQuestion = await prisma.question.findFirst({ where: { isFinalQuestion: true, isActive: true } });
  const finalAnswered = finalQuestion && latestRealAnswerExists(team.submissions, finalQuestion.id);
  if (!finalAnswered) {
    return res.status(400).json({ error: "Bạn cần trả lời câu hỏi số 7 trước khi giải mã vụ án." });
  }

  const deferredQuestions = await prisma.question.findMany({ where: { revealMode: "DEFERRED", isActive: true } });
  const allCorrect = deferredQuestions.every((q) => {
    const latest = team.submissions
      .filter((s) => s.questionId === q.id && !s.isDraft)
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())[0];
    return latest?.status === "CORRECT";
  });

  const now = new Date();
  const updated = await prisma.team.update({
    where: { id: teamId },
    data: allCorrect
      ? {
          caseDecodedAt: now,
          finalQuestionCompletedAt: now,
          status: "COMPLETED",
          completedAt: now,
          decodeAttempts: { increment: 1 },
        }
      : {
          lastDecodeAttemptAt: now,
          decodeAttempts: { increment: 1 },
        },
  });

  const io = getIO();
  io.to(ROOMS.team(teamId)).emit(EVENTS.TEAM_UPDATED, { reason: "decode_case" });
  io.to(ROOMS.admin).emit(EVENTS.ADMIN_PROGRESS_UPDATED, { teamId });

  res.json({ ok: true, allCorrect, decodeAttempts: updated.decodeAttempts });
});

function latestRealAnswerExists(submissions: { questionId: string; isDraft: boolean }[], questionId: string) {
  return submissions.some((s) => s.questionId === questionId && !s.isDraft);
}

/**
 * Đội tự bấm "Chơi lại từ đầu" — xóa toàn bộ đáp án đã gửi của CHÍNH đội mình và đặt lại
 * mọi mốc tiến trình (hồ sơ, câu 7, giải mã...) về trạng thái ban đầu. Chỉ tác động tới
 * đội đang đăng nhập (dựa vào teamId trong token), không thể reset đội khác.
 */
playerRouter.post("/reset", async (req, res) => {
  const teamId = req.team!.teamId;
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return res.status(404).json({ error: "Không tìm thấy đội." });

  await prisma.submission.deleteMany({ where: { teamId } });
  const updated = await prisma.team.update({
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
      lastDecodeAttemptAt: null,
      decodeAttempts: 0,
      caseDecodedAt: null,
      completedAt: null,
      manualRankOverride: null,
    },
  });

  const io = getIO();
  io.to(ROOMS.team(teamId)).emit(EVENTS.TEAM_UPDATED, { reason: "self_reset" });
  io.to(ROOMS.admin).emit(EVENTS.ADMIN_PROGRESS_UPDATED, { teamId });

  res.json({ ok: true, team: { id: updated.id, name: updated.name } });
});

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
