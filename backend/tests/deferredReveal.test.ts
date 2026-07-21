import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/db";
import { resetDatabase } from "./helpers";
import { hashPassword, generateJoinCode, signTeamToken } from "../src/utils/auth";
import { normalizeAnswer } from "../src/utils/normalize";

describe("Câu hỏi ẩn đáp án (revealMode = DEFERRED) & Kết thúc vụ án", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  async function seedDeferredGame() {
    await prisma.gameSession.create({ data: { status: "RUNNING", startedAt: new Date() } });
    await prisma.admin.create({
      data: { username: "admin", passwordHash: await hashPassword("secret123"), displayName: "BTC" },
    });

    // 1 câu trắc nghiệm ẩn đáp án + 5 câu revealMode mặc định (IMMEDIATE, phải đúng mới tính hoàn thành)
    const deferredQ = await prisma.question.create({
      data: {
        code: "FIRE",
        title: "Nguyên nhân vụ cháy",
        description: "...",
        points: 5,
        order: 1,
        type: "MULTIPLE_CHOICE",
        validationMode: "AUTO",
        revealMode: "DEFERRED",
        options: JSON.stringify(["Tai nạn", "Kỹ thuật", "Cố ý", "Tự nhiên"]),
      },
    });
    await prisma.acceptedAnswer.create({
      data: { questionId: deferredQ.id, answer: "Cố ý", normalizedAnswer: normalizeAnswer("Cố ý") },
    });

    const otherCodes = ["TOY", "BODY", "KILLER", "MASTERMIND", "SAFE"];
    for (let i = 0; i < otherCodes.length; i++) {
      const q = await prisma.question.create({
        data: {
          code: otherCodes[i],
          title: otherCodes[i],
          description: "...",
          points: 5,
          order: i + 2,
          type: "TEXT",
          validationMode: "AUTO",
          revealMode: "IMMEDIATE",
        },
      });
      await prisma.acceptedAnswer.create({
        data: { questionId: q.id, answer: "dap-an", normalizedAnswer: normalizeAnswer("dap-an") },
      });
    }

    await prisma.question.create({
      data: {
        code: "FINAL",
        title: "Câu hỏi số 7",
        description: "...",
        points: 10,
        order: 7,
        type: "TEXT",
        validationMode: "MANUAL",
        isFinalQuestion: true,
        prerequisiteStage: "SIX_TASKS",
      },
    });

    const team = await prisma.team.create({ data: { name: "Đội Ẩn Danh", joinCode: generateJoinCode() } });
    return { team, deferredQ };
  }

  it("Trả lời sai câu ẩn đáp án không lộ kết quả, KHÔNG tính là hoàn thành, nhưng vẫn cho gửi lại", async () => {
    const { team, deferredQ } = await seedDeferredGame();
    const token = signTeamToken({ teamId: team.id, teamName: team.name });

    const submit = await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ questionId: deferredQ.id, answer: "Tai nạn" }); // sai

    expect(submit.status).toBe(200);
    expect(submit.body.submission.status).toBe("ANSWERED"); // không lộ là "INCORRECT"
    expect(submit.body.submission.awardedPoints).toBe(0);

    const me = await request(app).get("/api/player/me").set("Authorization", `Bearer ${token}`);
    const fireState = me.body.questions.find((q: any) => q.code === "FIRE");
    expect(fireState.status).toBe("ANSWERED");

    // Chưa đúng nên KHÔNG được tính vào tiến độ hoàn thành
    const teamAfterWrong = await prisma.team.findUniqueOrThrow({ where: { id: team.id } });
    expect(teamAfterWrong.sixTasksCompletedAt).toBeNull();

    // Vẫn cho phép gửi lại (không còn one-shot) vì đội không được biết đúng/sai
    const second = await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ questionId: deferredQ.id, answer: "Cố ý" }); // lần này đúng
    expect(second.status).toBe(200);
    expect(second.body.submission.status).toBe("ANSWERED"); // vẫn không lộ, dù thực ra đã đúng

    // Vẫn cho phép gửi lại lần nữa dù đã đúng — đội không được biết đúng/sai nên cần
    // được tự do đổi ý bất cứ lúc nào cho tới khi giải mã vụ án.
    const third = await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ questionId: deferredQ.id, answer: "Tai nạn" });
    expect(third.status).toBe(200);
    expect(third.body.submission.status).toBe("ANSWERED");
  });

  it("Điểm hiển thị KHÔNG bao gồm điểm của câu ẩn đáp án trước khi giải mã (chống lộ đáp án qua điểm số)", async () => {
    const { team, deferredQ } = await seedDeferredGame();
    const token = signTeamToken({ teamId: team.id, teamName: team.name });

    await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ questionId: deferredQ.id, answer: "Cố ý" }); // đúng, nhưng chưa được biết

    const me = await request(app).get("/api/player/me").set("Authorization", `Bearer ${token}`);
    expect(me.body.team.totalScore).toBe(0); // điểm thật là 5 nhưng chưa hiển thị

    const realTotal = await prisma.submission.aggregate({
      where: { teamId: team.id, status: "CORRECT" },
      _sum: { awardedPoints: true },
    });
    expect(realTotal._sum.awardedPoints).toBe(5); // điểm thật đã được ghi nhận trong DB
  });

  it("Không thể bấm Kết thúc vụ án khi chưa hoàn thành đủ 6/6 (kể cả khi đã 'thử' hết nhưng có câu còn sai)", async () => {
    const { team, deferredQ } = await seedDeferredGame();
    const token = signTeamToken({ teamId: team.id, teamName: team.name });

    // Thử hết 6 câu nhưng cố tình để câu ẩn đáp án sai
    await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ questionId: deferredQ.id, answer: "Tai nạn" }); // sai
    for (const code of ["TOY", "BODY", "KILLER", "MASTERMIND", "SAFE"]) {
      const q = await prisma.question.findUniqueOrThrow({ where: { code } });
      await request(app)
        .post("/api/player/answers/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({ questionId: q.id, answer: "dap-an" });
    }

    const res = await request(app).post("/api/player/end-case").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("Sau khi Giải mã vụ án thành công, điểm và trạng thái câu ẩn đáp án được tiết lộ đầy đủ", async () => {
    const { team, deferredQ } = await seedDeferredGame();
    const token = signTeamToken({ teamId: team.id, teamName: team.name });

    await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ questionId: deferredQ.id, answer: "Cố ý" }); // đúng ngay từ đầu

    for (const code of ["TOY", "BODY", "KILLER", "MASTERMIND", "SAFE"]) {
      const q = await prisma.question.findUniqueOrThrow({ where: { code } });
      await request(app)
        .post("/api/player/answers/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({ questionId: q.id, answer: "dap-an" });
    }

    // Đủ 6/6 đúng thật -> có thể kết thúc vụ án
    const endCase = await request(app).post("/api/player/end-case").set("Authorization", `Bearer ${token}`);
    expect(endCase.status).toBe(200);

    // Câu ẩn đáp án chưa được tiết lộ chỉ vì "Kết thúc vụ án" - phải giải mã thành công mới lộ.
    const meBeforeDecode = await request(app).get("/api/player/me").set("Authorization", `Bearer ${token}`);
    expect(meBeforeDecode.body.questions.find((q: any) => q.code === "FIRE").status).toBe("ANSWERED");

    // Câu hỏi số 7 ở fixture này là TEXT/MANUAL (không ẩn đáp án) - chỉ cần đã trả lời để giải mã được.
    const finalQ = await prisma.question.findUniqueOrThrow({ where: { code: "FINAL" } });
    await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ questionId: finalQ.id, answer: "Minh" });

    const decode = await request(app).post("/api/player/decode-case").set("Authorization", `Bearer ${token}`);
    expect(decode.status).toBe(200);
    expect(decode.body.allCorrect).toBe(true);

    const me = await request(app).get("/api/player/me").set("Authorization", `Bearer ${token}`);
    const fireState = me.body.questions.find((q: any) => q.code === "FIRE");
    expect(fireState.status).toBe("CORRECT");
    expect(me.body.team.totalScore).toBe(30); // 5 (FIRE) + 5*5 (5 câu còn lại)
    expect(me.body.questions.some((q: any) => q.isFinalQuestion)).toBe(true);
  });
});
