import { prisma } from "../db";
import { Question, Submission, Team } from "@prisma/client";

export const NON_FINAL_QUESTION_COUNT = 6;

export type SubmissionWithQuestion = Submission & { question: Question };

/**
 * Lấy submission "hiệu lực" mới nhất của một đội cho một câu hỏi
 * (bỏ qua các bản nháp - isDraft true không tính là submission thật).
 */
export function latestRealSubmission(
  submissions: Submission[],
  questionId: string
): Submission | undefined {
  return submissions
    .filter((s) => s.questionId === questionId && !s.isDraft)
    .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())[0];
}

export function latestDraft(submissions: Submission[], questionId: string): Submission | undefined {
  return submissions
    .filter((s) => s.questionId === questionId && s.isDraft)
    .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())[0];
}

/**
 * Câu hỏi có đang bị khóa với đội hay không, dựa trên prerequisiteStage.
 * - CLUE1: cần đã nhận Tập hồ sơ số 1
 * - CLUE2: cần đã nhận Tập hồ sơ số 2
 * - SIX_TASKS: cần đội đã bấm "Kết thúc vụ án" sau khi hoàn thành 6 nhiệm vụ (chỉ áp dụng cho câu 7)
 * - null: luôn mở
 */
export function isQuestionLocked(question: Question, team: Team): boolean {
  switch (question.prerequisiteStage) {
    case "CLUE1":
      return !team.clue1Delivered;
    case "CLUE2":
      return !team.clue2Delivered;
    case "SIX_TASKS":
      return !team.question7Unlocked;
    default:
      return false;
  }
}

/**
 * Một câu hỏi được tính là "đã hoàn thành" (đóng góp vào tiến độ 6/6) khi nào:
 * - Với revealMode = "IMMEDIATE" (báo đúng/sai ngay, ví dụ đồ chơi & két sắt): phải trả lời ĐÚNG.
 * - Với revealMode = "DEFERRED" (ẩn đáp án đến khi kết thúc vụ án): chỉ cần đã GỬI đáp án,
 *   không quan trọng đúng hay sai — vì người chơi chưa được biết kết quả cho đến cuối.
 */
export function isQuestionAnsweredForCompletion(
  question: Question,
  submissions: Submission[]
): boolean {
  const latest = latestRealSubmission(submissions, question.id);
  if (!latest) return false;
  if (question.revealMode === "DEFERRED") return true;
  return latest.status === "CORRECT";
}

/**
 * Tính toán trạng thái hiển thị của 1 câu hỏi đối với 1 đội, phục vụ Dashboard Player.
 * KHÔNG bao giờ trả về đáp án đúng.
 */
export function computeQuestionStateForTeam(
  question: Question,
  team: Team,
  submissions: Submission[]
) {
  const locked = isQuestionLocked(question, team);
  const latest = latestRealSubmission(submissions, question.id);
  const draft = latestDraft(submissions, question.id);
  const revealed = question.revealMode !== "DEFERRED" || team.question7Unlocked;

  let status:
    | "LOCKED"
    | "NOT_STARTED"
    | "DRAFT_SAVED"
    | "PENDING_REVIEW"
    | "ANSWERED"
    | "CORRECT"
    | "INCORRECT"
    | "RETRY_ALLOWED" = "NOT_STARTED";

  if (locked) {
    status = "LOCKED";
  } else if (latest) {
    if (!revealed) {
      // Đã gửi đáp án nhưng đang chờ "Kết thúc vụ án" mới được biết đúng/sai.
      status = "ANSWERED";
    } else if (latest.status === "CORRECT") status = "CORRECT";
    else if (latest.status === "PENDING_REVIEW") status = "PENDING_REVIEW";
    else if (latest.status === "RETRY_ALLOWED") status = "RETRY_ALLOWED";
    else if (latest.status === "INCORRECT") status = "INCORRECT";
  } else if (draft) {
    status = "DRAFT_SAVED";
  }

  return {
    id: question.id,
    code: question.code,
    title: question.title,
    points: question.points,
    order: question.order,
    type: question.type,
    revealMode: question.revealMode,
    isFinalQuestion: question.isFinalQuestion,
    locked,
    status,
    description: locked ? null : question.description,
    options:
      !locked && question.type === "MULTIPLE_CHOICE" && question.options
        ? (JSON.parse(question.options) as string[])
        : null,
    safeDialConfig:
      !locked && question.type === "SAFE_DIAL" && question.safeDialConfig
        ? JSON.parse(question.safeDialConfig).ui ?? null // chỉ gửi phần cấu hình UI, KHÔNG gửi mã đúng
        : null,
    successMessage: question.successMessage ?? null,
    draftAnswer: draft?.answer ?? null,
    lastAnswer: latest?.answer ?? null,
    awardedPoints: revealed && latest?.status === "CORRECT" ? latest.awardedPoints : 0,
    adminNote: revealed ? latest?.adminNote ?? null : null,
    allowRetry: revealed && status === "RETRY_ALLOWED",
    submittedAt: latest?.submittedAt ?? null,
  };
}

/**
 * Sau khi một submission được xác nhận (đúng, hoặc đã gửi với câu ẩn đáp án), kiểm tra xem
 * đội đã hoàn thành đủ 6/6 nhiệm vụ đầu tiên chưa (không quan tâm thứ tự). Nếu đủ, chuyển
 * trạng thái đội sang "chờ kết thúc vụ án" và ghi lại mốc thời gian hoàn thành 6 nhiệm vụ.
 */
export async function maybeAdvanceToWaitingForFinal(teamId: string) {
  const team = await prisma.team.findUniqueOrThrow({ where: { id: teamId } });
  if (team.sixTasksCompletedAt) return team; // đã tính rồi, không tính lại

  const nonFinalQuestions = await prisma.question.findMany({
    where: { isFinalQuestion: false, isActive: true },
  });
  if (nonFinalQuestions.length === 0) return team;

  const submissions = await prisma.submission.findMany({ where: { teamId } });

  const allCompleted = nonFinalQuestions.every((q) => isQuestionAnsweredForCompletion(q, submissions));

  if (!allCompleted) return team;

  return prisma.team.update({
    where: { id: teamId },
    data: {
      sixTasksCompletedAt: new Date(),
      status: "WAITING_FOR_Q7",
    },
  });
}

export function computeTotalScore(submissions: Submission[]): number {
  const bestByQuestion = new Map<string, number>();
  for (const s of submissions) {
    if (s.isDraft) continue;
    if (s.status === "CORRECT") {
      const current = bestByQuestion.get(s.questionId) ?? 0;
      bestByQuestion.set(s.questionId, Math.max(current, s.awardedPoints));
    }
  }
  let total = 0;
  for (const v of bestByQuestion.values()) total += v;
  return total;
}

/**
 * Điểm hiển thị CHO NGƯỜI CHƠI: giống computeTotalScore nhưng ẩn điểm của các câu
 * revealMode = "DEFERRED" cho tới khi đội đã "Kết thúc vụ án" (question7Unlocked).
 * Nếu không ẩn, điểm số sẽ vô tình lộ đáp án đúng/sai trước khi được phép biết.
 * Dùng hàm computeTotalScore (không lọc) cho Admin/bảng xếp hạng — nơi cần điểm thật.
 */
export function computeVisibleTotalScore(
  team: Team,
  questions: Question[],
  submissions: Submission[]
): number {
  const bestByQuestion = new Map<string, number>();
  for (const s of submissions) {
    if (s.isDraft || s.status !== "CORRECT") continue;
    const question = questions.find((q) => q.id === s.questionId);
    const revealed = !question || question.revealMode !== "DEFERRED" || team.question7Unlocked;
    if (!revealed) continue;
    const current = bestByQuestion.get(s.questionId) ?? 0;
    bestByQuestion.set(s.questionId, Math.max(current, s.awardedPoints));
  }
  let total = 0;
  for (const v of bestByQuestion.values()) total += v;
  return total;
}
