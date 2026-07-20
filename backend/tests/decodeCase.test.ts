import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/db";
import { resetDatabase } from "./helpers";
import { hashPassword, generateJoinCode, signTeamToken } from "../src/utils/auth";
import { normalizeAnswer } from "../src/utils/normalize";
import { computeLeaderboard } from "../src/services/leaderboard";

describe("Giải mã vụ án (Câu hỏi số 7 dạng trắc nghiệm + xếp hạng theo thứ tự giải mã)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  async function seedGame() {
    await prisma.gameSession.create({ data: { status: "RUNNING", startedAt: new Date() } });
    await prisma.admin.create({
      data: { username: "admin", passwordHash: await hashPassword("secret123"), displayName: "BTC" },
    });

    // 1 câu ẩn đáp án trong 6 nhiệm vụ (đại diện cho FIRE/BODY/KILLER/MASTERMIND)
    const deferredTask = await prisma.question.create({
      data: {
        code: "FIRE",
        title: "Nguyên nhân cháy",
        description: "...",
        points: 5,
        order: 1,
        type: "MULTIPLE_CHOICE",
        validationMode: "AUTO",
        revealMode: "DEFERRED",
        options: JSON.stringify(["Tai nạn", "Cố ý"]),
      },
    });
    await prisma.acceptedAnswer.create({
      data: { questionId: deferredTask.id, answer: "Cố ý", normalizedAnswer: normalizeAnswer("Cố ý") },
    });

    // 5 nhiệm vụ còn lại, trả lời đúng là tính hoàn thành (IMMEDIATE mặc định)
    for (let i = 0; i < 5; i++) {
      const code = `TASK${i}`;
      const q = await prisma.question.create({
        data: { code, title: code, description: "...", points: 5, order: i + 2, type: "TEXT", validationMode: "AUTO" },
      });
      await prisma.acceptedAnswer.create({
        data: { questionId: q.id, answer: "dap-an", normalizedAnswer: normalizeAnswer("dap-an") },
      });
    }

    // Câu hỏi số 7 dạng trắc nghiệm, ẩn đáp án, giống production
    const finalQ = await prisma.question.create({
      data: {
        code: "FINAL",
        title: "Câu hỏi số 7",
        description: "Ai đưa Hiền ra ngoài?",
        points: 10,
        order: 7,
        type: "MULTIPLE_CHOICE",
        validationMode: "AUTO",
        revealMode: "DEFERRED",
        isFinalQuestion: true,
        prerequisiteStage: "SIX_TASKS",
        options: JSON.stringify(["Toàn", "Hùng", "Lâm"]),
      },
    });
    await prisma.acceptedAnswer.create({
      data: { questionId: finalQ.id, answer: "Toàn", normalizedAnswer: normalizeAnswer("Toàn") },
    });

    const team = await prisma.team.create({ data: { name: "Đội Giải Mã", joinCode: generateJoinCode() } });
    return { team, deferredTask, finalQ };
  }

  async function completeSixTasks(token: string, deferredTask: { id: string }, deferredAnswer: string) {
    await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ questionId: deferredTask.id, answer: deferredAnswer });
    for (let i = 0; i < 5; i++) {
      const q = await prisma.question.findUniqueOrThrow({ where: { code: `TASK${i}` } });
      await request(app)
        .post("/api/player/answers/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({ questionId: q.id, answer: "dap-an" });
    }
    await request(app).post("/api/player/end-case").set("Authorization", `Bearer ${token}`);
  }

  it("Giải mã đúng hết -> thành công, chốt caseDecodedAt, ẩn đáp án được tiết lộ", async () => {
    const { team, deferredTask, finalQ } = await seedGame();
    const token = signTeamToken({ teamId: team.id, teamName: team.name });

    await completeSixTasks(token, deferredTask, "Cố ý");
    await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ questionId: finalQ.id, answer: "Toàn" });

    const decode = await request(app).post("/api/player/decode-case").set("Authorization", `Bearer ${token}`);
    expect(decode.status).toBe(200);
    expect(decode.body.allCorrect).toBe(true);

    const teamAfter = await prisma.team.findUniqueOrThrow({ where: { id: team.id } });
    expect(teamAfter.caseDecodedAt).not.toBeNull();
    expect(teamAfter.status).toBe("COMPLETED");

    const me = await request(app).get("/api/player/me").set("Authorization", `Bearer ${token}`);
    const fireState = me.body.questions.find((q: any) => q.code === "FIRE");
    expect(fireState.status).toBe("CORRECT"); // đã được tiết lộ
  });

  it("Giải mã sai (1 câu sai) -> không lộ đáp án, cho phép trả lời lại rồi giải mã lại thành công", async () => {
    const { team, deferredTask, finalQ } = await seedGame();
    const token = signTeamToken({ teamId: team.id, teamName: team.name });

    await completeSixTasks(token, deferredTask, "Tai nạn"); // SAI
    await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ questionId: finalQ.id, answer: "Toàn" }); // đúng

    const firstDecode = await request(app).post("/api/player/decode-case").set("Authorization", `Bearer ${token}`);
    expect(firstDecode.body.allCorrect).toBe(false);

    const teamAfterFail = await prisma.team.findUniqueOrThrow({ where: { id: team.id } });
    expect(teamAfterFail.caseDecodedAt).toBeNull();
    expect(teamAfterFail.lastDecodeAttemptAt).not.toBeNull();

    // Chưa được biết câu nào sai
    const me = await request(app).get("/api/player/me").set("Authorization", `Bearer ${token}`);
    const fireState = me.body.questions.find((q: any) => q.code === "FIRE");
    expect(fireState.status).toBe("RETRY_ALLOWED"); // được phép sửa lại vì lần giải mã đã thất bại

    // Sửa lại câu sai
    const retrySubmit = await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ questionId: deferredTask.id, answer: "Cố ý" });
    expect(retrySubmit.status).toBe(200);

    const secondDecode = await request(app).post("/api/player/decode-case").set("Authorization", `Bearer ${token}`);
    expect(secondDecode.body.allCorrect).toBe(true);
  });

  it("Xếp hạng theo thứ tự đội giải mã xong sớm nhất (1, 2, 3...)", async () => {
    const { team: teamA, deferredTask: dtA, finalQ: fqA } = await seedGame();

    // Đội B: tạo thêm 1 đội, seed lại câu hỏi dùng chung (đã tạo ở seedGame lần đầu nên chỉ tạo team mới)
    const teamB = await prisma.team.create({ data: { name: "Đội B", joinCode: generateJoinCode() } });

    const tokenA = signTeamToken({ teamId: teamA.id, teamName: teamA.name });
    const tokenB = signTeamToken({ teamId: teamB.id, teamName: teamB.name });

    // Đội B giải mã trước
    await completeSixTasks(tokenB, dtA, "Cố ý");
    await request(app).post("/api/player/answers/submit").set("Authorization", `Bearer ${tokenB}`).send({ questionId: fqA.id, answer: "Toàn" });
    await request(app).post("/api/player/decode-case").set("Authorization", `Bearer ${tokenB}`);

    // Đội A giải mã sau
    await completeSixTasks(tokenA, dtA, "Cố ý");
    await request(app).post("/api/player/answers/submit").set("Authorization", `Bearer ${tokenA}`).send({ questionId: fqA.id, answer: "Toàn" });
    await request(app).post("/api/player/decode-case").set("Authorization", `Bearer ${tokenA}`);

    const entries = await computeLeaderboard();
    const rankB = entries.find((e) => e.teamId === teamB.id)!.rank;
    const rankA = entries.find((e) => e.teamId === teamA.id)!.rank;
    expect(rankB).toBe(1);
    expect(rankA).toBe(2);
  });
});
