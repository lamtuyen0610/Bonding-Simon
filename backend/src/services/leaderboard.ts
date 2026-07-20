import { prisma } from "../db";
import { computeTotalScore } from "./gameLogic";

export interface LeaderboardEntry {
  rank: number;
  teamId: string;
  teamName: string;
  totalScore: number;
  correctCount: number;
  caseDecodedAt: string | null;
  finalQuestionCompletedAt: string | null;
  sixTasksCompletedAt: string | null;
  status: string;
  isTie: boolean;
}

/**
 * Xếp hạng theo quy tắc:
 * 1. Đội đã "Giải mã vụ án" thành công (caseDecodedAt) luôn xếp trên đội chưa giải mã xong,
 *    và giữa các đội đã giải mã, đội nào giải mã SỚM HƠN xếp cao hơn (1, 2, 3...).
 * 2. Với các đội CHƯA giải mã xong vụ án, xếp theo: tổng điểm cao hơn trước, rồi tới thời
 *    gian hoàn thành 6 nhiệm vụ sớm hơn.
 * 3. Nếu vẫn bằng nhau hoàn toàn: đồng hạng, trừ khi Admin đã đặt manualRankOverride.
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
      caseDecodedAt: t.caseDecodedAt,
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

    // Ưu tiên 1: đội đã giải mã vụ án xong xếp trên đội chưa xong, sớm hơn xếp cao hơn.
    const aDecoded = a.caseDecodedAt?.getTime() ?? null;
    const bDecoded = b.caseDecodedAt?.getTime() ?? null;
    if (aDecoded !== null && bDecoded !== null) return aDecoded - bDecoded;
    if (aDecoded !== null) return -1;
    if (bDecoded !== null) return 1;

    // Cả 2 đều chưa giải mã xong -> xếp theo điểm, rồi tới thời gian hoàn thành 6 nhiệm vụ.
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;

    const aSix = a.sixTasksCompletedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bSix = b.sixTasksCompletedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (aSix !== bSix) return aSix - bSix;

    return 0;
  });

  const entries: LeaderboardEntry[] = [];
  for (let i = 0; i < scored.length; i++) {
    const s = scored[i];
    entries.push({
      rank: i + 1,
      teamId: s.teamId,
      teamName: s.teamName,
      totalScore: s.totalScore,
      correctCount: s.correctCount,
      caseDecodedAt: s.caseDecodedAt?.toISOString() ?? null,
      finalQuestionCompletedAt: s.finalQuestionCompletedAt?.toISOString() ?? null,
      sixTasksCompletedAt: s.sixTasksCompletedAt?.toISOString() ?? null,
      status: s.status,
      isTie: false,
    });
  }

  // Đánh dấu đồng hạng: cùng trạng thái giải mã (hoặc cùng chưa giải mã) và cùng điểm/thời gian.
  for (let i = 1; i < entries.length; i++) {
    const a = entries[i - 1];
    const b = entries[i];
    const sameDecodeState = a.caseDecodedAt === b.caseDecodedAt;
    if (
      sameDecodeState &&
      a.totalScore === b.totalScore &&
      a.sixTasksCompletedAt === b.sixTasksCompletedAt
    ) {
      b.rank = a.rank;
      b.isTie = true;
      a.isTie = true;
    }
  }

  return entries;
}
