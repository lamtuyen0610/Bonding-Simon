import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/db";
import { resetDatabase, seedMinimalGame, adminToken, teamToken } from "./helpers";

describe("Flow điều tra KHỞI NGUỒN", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("Scenario 1: hiển thị đồng thời 6 nhiệm vụ và cho phép trả lời không theo thứ tự", async () => {
    const { team } = await seedMinimalGame();
    const token = await teamToken(team.id, team.name);

    const res = await request(app).get("/api/player/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const nonFinal = res.body.questions.filter((q: any) => !q.isFinalQuestion);
    expect(nonFinal.length).toBe(6);
    // Tất cả câu không có điều kiện tiên quyết đặc biệt phải ở trạng thái mở
    const fireQuestion = nonFinal.find((q: any) => q.code === "FIRE");
    expect(fireQuestion.locked).toBe(false);
  });

  it("Scenario 2 & 3 & 4: tự động cấp Tập hồ sơ số 1 và số 2 khi trả lời đúng", async () => {
    const { team } = await seedMinimalGame();
    const tToken = await teamToken(team.id, team.name);

    // Chưa trả lời đúng đồ chơi -> chưa có hồ sơ 1 -> không thể mở két sắt
    const safeQ = await prisma.question.findUniqueOrThrow({ where: { code: "SAFE" } });
    const blockedSafe = await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${tToken}`)
      .send({ questionId: safeQ.id, answer: "1234" });
    expect(blockedSafe.status).toBe(403);

    // Trả lời đúng vị trí đồ chơi (chuẩn hóa "  p5 " -> khớp "P5") -> tự động nhận hồ sơ 1
    const toyQ = await prisma.question.findUniqueOrThrow({ where: { code: "TOY" } });
    const submitToy = await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${tToken}`)
      .send({ questionId: toyQ.id, answer: "  p5 " });
    expect(submitToy.body.submission.status).toBe("CORRECT");

    const teamAfterToy = await prisma.team.findUniqueOrThrow({ where: { id: team.id } });
    expect(teamAfterToy.clue1Delivered).toBe(true);

    // Bây giờ có thể xoay két sắt -> đúng sẽ tự động nhận hồ sơ 2
    const submitSafe = await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${tToken}`)
      .send({ questionId: safeQ.id, answer: "1234" });
    expect(submitSafe.body.submission.status).toBe("CORRECT");

    const teamAfterSafe = await prisma.team.findUniqueOrThrow({ where: { id: team.id } });
    expect(teamAfterSafe.clue2Delivered).toBe(true);
  });

  it("Scenario 2b (cũ): Admin vẫn có thể giao hồ sơ thủ công để ghi đè/hỗ trợ", async () => {
    const { team, admin } = await seedMinimalGame();
    const aToken = await adminToken(admin.id, admin.username);

    const deliver1 = await request(app)
      .post(`/api/admin/teams/${team.id}/deliver-clue1`)
      .set("Authorization", `Bearer ${aToken}`);
    expect(deliver1.status).toBe(200);
    expect(deliver1.body.team.clue1Delivered).toBe(true);

    const deliver2 = await request(app)
      .post(`/api/admin/teams/${team.id}/deliver-clue2`)
      .set("Authorization", `Bearer ${aToken}`);
    expect(deliver2.body.team.clue2Delivered).toBe(true);
  });

  it("Scenario 5 & 6 & 7: câu hỏi số 7 chỉ mở sau khi đủ 6/6 và đội tự bấm Kết thúc vụ án", async () => {
    const { team, admin } = await seedMinimalGame();
    const tToken = await teamToken(team.id, team.name);
    const aToken = await adminToken(admin.id, admin.username);

    const finalQ = await prisma.question.findUniqueOrThrow({ where: { code: "FINAL" } });

    // Chưa hoàn thành 6 câu -> câu 7 không xuất hiện và không thể submit qua API
    const meBefore = await request(app).get("/api/player/me").set("Authorization", `Bearer ${tToken}`);
    expect(meBefore.body.questions.some((q: any) => q.isFinalQuestion)).toBe(false);

    const blockedFinal = await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${tToken}`)
      .send({ questionId: finalQ.id, answer: "ai đó" });
    expect(blockedFinal.status).toBe(403);

    // Hoàn thành lần lượt: TOY, SAFE (tự động nhận hồ sơ 1), rồi 4 câu MANUAL còn lại qua Admin chấm
    const toyQ = await prisma.question.findUniqueOrThrow({ where: { code: "TOY" } });
    await request(app).post("/api/player/answers/submit").set("Authorization", `Bearer ${tToken}`).send({ questionId: toyQ.id, answer: "P5" });
    const safeQ = await prisma.question.findUniqueOrThrow({ where: { code: "SAFE" } });
    await request(app).post("/api/player/answers/submit").set("Authorization", `Bearer ${tToken}`).send({ questionId: safeQ.id, answer: "1234" });

    for (const code of ["FIRE", "BODY", "KILLER", "MASTERMIND"]) {
      const q = await prisma.question.findUniqueOrThrow({ where: { code } });
      const submit = await request(app)
        .post("/api/player/answers/submit")
        .set("Authorization", `Bearer ${tToken}`)
        .send({ questionId: q.id, answer: "câu trả lời của đội" });
      expect(submit.body.submission.status).toBe("PENDING_REVIEW");

      const queue = await request(app).get("/api/admin/review-queue").set("Authorization", `Bearer ${aToken}`);
      const item = queue.body.submissions.find((s: any) => s.id === submit.body.submission.id);
      await request(app)
        .post(`/api/admin/review/${item.id}`)
        .set("Authorization", `Bearer ${aToken}`)
        .send({ decision: "CORRECT" });
    }

    // Sau 6/6, đội chuyển trạng thái chờ, câu 7 vẫn chưa hiện cho tới khi tự bấm "Kết thúc vụ án"
    const teamAfter6 = await prisma.team.findUniqueOrThrow({ where: { id: team.id } });
    expect(teamAfter6.sixTasksCompletedAt).not.toBeNull();
    expect(teamAfter6.status).toBe("WAITING_FOR_Q7");
    expect(teamAfter6.question7Unlocked).toBe(false);

    const meAfter6 = await request(app).get("/api/player/me").set("Authorization", `Bearer ${tToken}`);
    expect(meAfter6.body.questions.some((q: any) => q.isFinalQuestion)).toBe(false);

    // Đội tự bấm "Kết thúc vụ án" để mở khóa câu 7
    const endCase = await request(app)
      .post("/api/player/end-case")
      .set("Authorization", `Bearer ${tToken}`);
    expect(endCase.status).toBe(200);

    const meAfterUnlock = await request(app).get("/api/player/me").set("Authorization", `Bearer ${tToken}`);
    expect(meAfterUnlock.body.questions.some((q: any) => q.isFinalQuestion)).toBe(true);

    const submitFinal = await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${tToken}`)
      .send({ questionId: finalQ.id, answer: "Minh" });
    expect(submitFinal.body.submission.status).toBe("PENDING_REVIEW");
  });

  it("Scenario 8: không bị khóa bởi thứ tự - có thể trả lời câu hung thủ dù chưa trả lời câu vụ cháy", async () => {
    const { team } = await seedMinimalGame();
    const tToken = await teamToken(team.id, team.name);

    const killerQ = await prisma.question.findUniqueOrThrow({ where: { code: "KILLER" } });
    const res = await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${tToken}`)
      .send({ questionId: killerQ.id, answer: "Ông A" });
    expect(res.status).toBe(200);
    expect(res.body.submission.status).toBe("PENDING_REVIEW");
  });
});
