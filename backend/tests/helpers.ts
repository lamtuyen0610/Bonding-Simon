import { prisma } from "../src/db";
import { hashPassword, generateJoinCode, signAdminToken, signTeamToken } from "../src/utils/auth";
import { normalizeAnswer } from "../src/utils/normalize";

export async function resetDatabase() {
  await prisma.auditLog.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.acceptedAnswer.deleteMany();
  await prisma.question.deleteMany();
  await prisma.cluePackage.deleteMany();
  await prisma.storyChapter.deleteMany();
  await prisma.team.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.gameSession.deleteMany();
}

export async function seedMinimalGame() {
  await prisma.gameSession.create({ data: { status: "RUNNING", startedAt: new Date() } });

  const admin = await prisma.admin.create({
    data: { username: "admin", passwordHash: await hashPassword("secret123"), displayName: "BTC" },
  });

  const questionsDef = [
    { code: "TOY", title: "Đồ chơi của Nhi", points: 5, order: 1, prerequisiteStage: null, answers: ["P5"] },
    { code: "SAFE", title: "Két sắt", points: 5, order: 2, prerequisiteStage: "CLUE1", answers: ["1234"] },
    { code: "FIRE", title: "Vụ cháy", points: 5, order: 3, prerequisiteStage: null, answers: [] as string[] },
    { code: "BODY", title: "Xác chết P2", points: 10, order: 4, prerequisiteStage: null, answers: [] as string[] },
    { code: "KILLER", title: "Hung thủ", points: 10, order: 5, prerequisiteStage: null, answers: [] as string[] },
    { code: "MASTERMIND", title: "Chủ mưu", points: 10, order: 6, prerequisiteStage: null, answers: [] as string[] },
  ];

  for (const q of questionsDef) {
    const question = await prisma.question.create({
      data: {
        code: q.code,
        title: q.title,
        description: `Nội dung: ${q.title}`,
        points: q.points,
        order: q.order,
        validationMode: q.answers.length > 0 ? "AUTO" : "MANUAL",
        prerequisiteStage: q.prerequisiteStage,
        type: q.code === "SAFE" ? "SAFE_DIAL" : "TEXT",
      },
    });
    for (const a of q.answers) {
      await prisma.acceptedAnswer.create({
        data: { questionId: question.id, answer: a, normalizedAnswer: normalizeAnswer(a) },
      });
    }
  }

  await prisma.question.create({
    data: {
      code: "FINAL",
      title: "Câu hỏi số 7",
      description: "Ai đưa Hiền ra ngoài?",
      points: 10,
      order: 7,
      validationMode: "MANUAL",
      isFinalQuestion: true,
      prerequisiteStage: "SIX_TASKS",
    },
  });

  const team = await prisma.team.create({ data: { name: "Đội Test", joinCode: generateJoinCode() } });

  return { admin, team };
}

export async function adminToken(adminId: string, username: string) {
  return signAdminToken({ adminId, username });
}

export async function teamToken(teamId: string, teamName: string) {
  return signTeamToken({ teamId, teamName });
}
