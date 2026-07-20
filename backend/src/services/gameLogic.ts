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
 * - SIX_TASKS: cần Admin đã mở khóa câu hỏi số 7 (chỉ áp dụng cho câu 7)
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

  let status:
    | "LOCKED"
    | "NOT_STARTED"
    | "DRAFT_SAVED"
    | "PENDING_REVIEW"
    | "CORRECT"
    | "INCORRECT"
    | "RETRY_ALLOWED" = "NOT_STARTED";

  if (locked) {
    status = "LOCKED";
  } else if (latest) {
    if (latest.status === "CORRECT") status = "CORRECT";
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
    isFinalQuestion: question.isFinalQuestion,
    locked,
    status,
    description: locked ? null : question.description,
    safeDialConfig:
      !locked && question.type === "SAFE_DIAL" && question.safeDialConfig
        ? JSON.parse(question.safeDialConfig).ui ?? null // chỉ gửi phần cấu hình UI, KHÔNG gửi mã đúng
        : null,
    draftAnswer: draft?.answer ?? null,
    lastAnswer: latest?.answer ?? null,
    awardedPoints: latest?.status === "CORRECT" ? latest.awardedPoints : 0,
    adminNote: latest?.adminNote ?? null,
    allowRetry: status === "RETRY_ALLOWED",
    submittedAt: latest?.submittedAt ?? null,
  };
}

/**
 * Sau khi một submission được xác nhận ĐÚNG, kiểm tra xem đội đã hoàn thành
 * đủ 6/6 nhiệm vụ đầu tiên chưa (không quan tâm thứ tự). Nếu đủ, chuyển trạng thái
 * đội sang "chờ câu hỏi số 7" và ghi lại mốc thời gian hoàn thành 6 nhiệm vụ.
 */
export async function maybeAdvanceToWaitingForFinal(teamId: string) {
  const team = await prisma.team.findUniqueOrThrow({ where: { id: teamId } });
  if (team.sixTasksCompletedAt) return team; // đã tính rồi, không tính lại

  const nonFinalQuestions = await prisma.question.findMany({
    where: { isFinalQuestion: false, isActive: true },
  });
  if (nonFinalQuestions.length === 0) return team;

  const submissions = await prisma.submission.findMany({ where: { teamId } });

  const allCompleted = nonFinalQuestions.every((q) => {
    const latest = latestRealSubmission(submissions, q.id);
    return latest?.status === "CORRECT";
  });

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
