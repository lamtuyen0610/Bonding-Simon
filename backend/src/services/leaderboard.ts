import { prisma } from "../db";
import { computeTotalScore } from "./gameLogic";

export interface LeaderboardEntry {
  rank: number;
  teamId: string;
  teamName: string;
  totalScore: number;
  correctCount: number;
  finalQuestionCompletedAt: string | null;
  sixTasksCompletedAt: string | null;
  status: string;
  isTie: boolean;
}

/**
 * Xếp hạng theo quy tắc:
 * 1. Tổng điểm cao hơn xếp trên.
 * 2. Nếu bằng điểm: hoàn thành câu hỏi số 7 sớm hơn xếp trên.
 * 3. Nếu vẫn bằng: hoàn thành đủ 6 nhiệm vụ sớm hơn xếp trên.
 * 4. Nếu vẫn bằng: đồng hạng, trừ khi Admin đã đặt manualRankOverride.
 */
export async function computeLeaderboard(): Promise<LeaderboardEntry[]> {
  const teams = await prisma.team.findMany({
    where: { isDisqualified: false },
    include: { submissions: true },
  });

  const scored = teams.map((t) => {
    const totalScore = computeTotalScore(t.submissions);
    const correctCount = new Set(
      t.submissions.filter((s) => !s.isDraft && s.status === "CORRECT").map((s) => s.questionId)
    ).size;
    return {
      teamId: t.id,
      teamName: t.name,
      totalScore,
      correctCount,
      finalQuestionCompletedAt: t.finalQuestionCompletedAt,
      sixTasksCompletedAt: t.sixTasksCompletedAt,
      status: t.status,
      manualRankOverride: t.manualRankOverride,
    };
  });

  scored.sort((a, b) => {
    if (a.manualRankOverride != null || b.manualRankOverride != null) {
      const ao = a.manualRankOverride ?? Number.MAX_SAFE_INTEGER;
      const bo = b.manualRankOverride ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
    }
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;

    const aFinal = a.finalQuestionCompletedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bFinal = b.finalQuestionCompletedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (aFinal !== bFinal) return aFinal - bFinal;

    const aSix = a.sixTasksCompletedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bSix = b.sixTasksCompletedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (aSix !== bSix) return aSix - bSix;

    return 0;
  });

  const entries: LeaderboardEntry[] = [];
  for (let i = 0; i < scored.length; i++) {
    const s = scored[i];
    const prev = entries[i - 1];
    const isTie =
      !!prev &&
      prev.totalScore === s.totalScore &&
      (prev.finalQuestionCompletedAt ?? "x") === (s.finalQuestionCompletedAt?.toISOString() ?? "y")
        ? false
        : false; // tie hiển thị được tính riêng bên dưới cho rõ ràng
    entries.push({
      rank: i + 1,
      teamId: s.teamId,
      teamName: s.teamName,
      totalScore: s.totalScore,
      correctCount: s.correctCount,
      finalQuestionCompletedAt: s.finalQuestionCompletedAt?.toISOString() ?? null,
      sixTasksCompletedAt: s.sixTasksCompletedAt?.toISOString() ?? null,
      status: s.status,
      isTie: false,
    });
  }

  // Đánh dấu đồng hạng: cùng điểm, cùng thời gian hoàn thành câu 7 (hoặc đều null) và không có override thủ công
  for (let i = 1; i < entries.length; i++) {
    const a = entries[i - 1];
    const b = entries[i];
    if (
      a.totalScore === b.totalScore &&
      a.finalQuestionCompletedAt === b.finalQuestionCompletedAt &&
      a.sixTasksCompletedAt === b.sixTasksCompletedAt
    ) {
      b.rank = a.rank;
      b.isTie = true;
      a.isTie = true;
    }
  }

  return entries;
}
