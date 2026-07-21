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

  it("Giải mã sai (câu hỏi số 7 sai) -> không lộ đáp án, cho phép trả lời lại câu 7 rồi giải mã lại thành công", async () => {
    const { team, deferredTask, finalQ } = await seedGame();
    const token = signTeamToken({ teamId: team.id, teamName: team.name });

    // 6 nhiệm vụ đều phải đúng thật thì mới qua được bước "Kết thúc vụ án"
    await completeSixTasks(token, deferredTask, "Cố ý");
    const teamAfterSix = await prisma.team.findUniqueOrThrow({ where: { id: team.id } });
    expect(teamAfterSix.sixTasksCompletedAt).not.toBeNull();

    await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ questionId: finalQ.id, answer: "Hùng" }); // câu 7 SAI

    const firstDecode = await request(app).post("/api/player/decode-case").set("Authorization", `Bearer ${token}`);
    expect(firstDecode.body.allCorrect).toBe(false);

    const teamAfterFail = await prisma.team.findUniqueOrThrow({ where: { id: team.id } });
    expect(teamAfterFail.caseDecodedAt).toBeNull();

    // Chưa được biết là sai, chỉ thấy "đã trả lời"
    const me = await request(app).get("/api/player/me").set("Authorization", `Bearer ${token}`);
    const finalState = me.body.questions.find((q: any) => q.isFinalQuestion);
    expect(finalState.status).toBe("ANSWERED");

    // Sửa lại câu 7 (được phép gửi lại vì chưa đúng)
    const retrySubmit = await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ questionId: finalQ.id, answer: "Toàn" });
    expect(retrySubmit.status).toBe(200);

    const secondDecode = await request(app).post("/api/player/decode-case").set("Authorization", `Bearer ${token}`);
    expect(secondDecode.body.allCorrect).toBe(true);
  });

  it("6 nhiệm vụ chưa đúng hết thì không thể Kết thúc vụ án, dù đã 'thử' đủ 6 câu", async () => {
    const { team, deferredTask } = await seedGame();
    const token = signTeamToken({ teamId: team.id, teamName: team.name });

    // Cố tình để câu ẩn đáp án sai
    await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ questionId: deferredTask.id, answer: "Tai nạn" }); // SAI
    for (let i = 0; i < 5; i++) {
      const q = await prisma.question.findUniqueOrThrow({ where: { code: `TASK${i}` } });
      await request(app)
        .post("/api/player/answers/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({ questionId: q.id, answer: "dap-an" });
    }

    const endCase = await request(app).post("/api/player/end-case").set("Authorization", `Bearer ${token}`);
    expect(endCase.status).toBe(400); // vì 1 câu (FIRE) vẫn chưa đúng thật

    // Vẫn có thể sửa lại và thử tiếp
    const retry = await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ questionId: deferredTask.id, answer: "Cố ý" }); // đúng
    expect(retry.status).toBe(200);

    const endCase2 = await request(app).post("/api/player/end-case").set("Authorization", `Bearer ${token}`);
    expect(endCase2.status).toBe(200);
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

  it("Xếp hạng theo THỜI GIAN HOÀN THÀNH (không phải mốc giờ tuyệt đối) — đội vào sau nhưng làm nhanh hơn vẫn xếp trên", async () => {
    const { team: teamX } = await seedGame();
    const teamY = await prisma.team.create({ data: { name: "Đội Y", joinCode: generateJoinCode() } });

    const t0 = new Date("2026-01-01T00:00:00Z").getTime();

    // Đội X: bắt đầu lúc T0, giải mã xong lúc T0+5 phút -> thời gian hoàn thành = 5 phút.
    // Nhưng hoàn thành ở mốc giờ tuyệt đối SỚM hơn đội Y.
    await prisma.team.update({
      where: { id: teamX.id },
      data: {
        startedAt: new Date(t0),
        caseDecodedAt: new Date(t0 + 5 * 60 * 1000),
      },
    });

    // Đội Y: bắt đầu MUỘN hơn (T0 + 10 phút), giải mã xong lúc T0+12 phút
    // -> thời gian hoàn thành chỉ 2 phút (nhanh hơn X), dù mốc giờ tuyệt đối TRỄ hơn X.
    await prisma.team.update({
      where: { id: teamY.id },
      data: {
        startedAt: new Date(t0 + 10 * 60 * 1000),
        caseDecodedAt: new Date(t0 + 12 * 60 * 1000),
      },
    });

    const entries = await computeLeaderboard();
    const entryX = entries.find((e) => e.teamId === teamX.id)!;
    const entryY = entries.find((e) => e.teamId === teamY.id)!;

    expect(entryY.durationMs).toBe(2 * 60 * 1000);
    expect(entryX.durationMs).toBe(5 * 60 * 1000);
    // Đội Y xếp trên đội X vì THỜI GIAN HOÀN THÀNH ngắn hơn, dù giải mã xong trễ hơn về mốc giờ tuyệt đối.
    expect(entryY.rank).toBe(1);
    expect(entryX.rank).toBe(2);
  });
});
