import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/db";
import { resetDatabase, seedMinimalGame, adminToken, teamToken } from "./helpers";
import { generateJoinCode, signTeamToken } from "../src/utils/auth";
import { computeLeaderboard } from "../src/services/leaderboard";

describe("Bảo mật & tính đúng đắn", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("Không trả đáp án đúng (answer key) trong API dành cho Player", async () => {
    const { team } = await seedMinimalGame();
    const tToken = await teamToken(team.id, team.name);
    const res = await request(app).get("/api/player/me").set("Authorization", `Bearer ${tToken}`);
    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain("P5");
    expect(bodyText).not.toContain("acceptedAnswers");
    expect(bodyText).not.toContain("normalizedAnswer");
  });

  it("Không thể gửi đáp án cho câu hỏi chưa mở khóa (kể cả cố tình gọi thẳng API)", async () => {
    const { team } = await seedMinimalGame();
    const tToken = await teamToken(team.id, team.name);
    const safeQ = await prisma.question.findUniqueOrThrow({ where: { code: "SAFE" } });
    const res = await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${tToken}`)
      .send({ questionId: safeQ.id, answer: "1234" });
    expect(res.status).toBe(403);
  });

  it("Không thể bỏ qua bước bằng cách gọi thẳng câu hỏi số 7 qua ID", async () => {
    const { team } = await seedMinimalGame();
    const tToken = await teamToken(team.id, team.name);
    const finalQ = await prisma.question.findUniqueOrThrow({ where: { code: "FINAL" } });
    const res = await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${tToken}`)
      .send({ questionId: finalQ.id, answer: "bất kỳ" });
    expect(res.status).toBe(403);
  });

  it("Không cộng điểm hai lần khi câu hỏi đã đúng và cố gửi lại", async () => {
    const { team } = await seedMinimalGame();
    const tToken = await teamToken(team.id, team.name);
    const toyQ = await prisma.question.findUniqueOrThrow({ where: { code: "TOY" } });

    await request(app).post("/api/player/answers/submit").set("Authorization", `Bearer ${tToken}`).send({ questionId: toyQ.id, answer: "P5" });
    const second = await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${tToken}`)
      .send({ questionId: toyQ.id, answer: "P5" });
    expect(second.status).toBe(409);

    const team1 = await prisma.team.findUniqueOrThrow({ where: { id: team.id }, include: { submissions: true } as any });
    const submissions = await prisma.submission.findMany({ where: { teamId: team.id, questionId: toyQ.id } });
    expect(submissions.filter((s) => s.status === "CORRECT").length).toBe(1);
  });

  it("Chấm sai sau đó cho phép trả lời lại và chấm đúng", async () => {
    const { team, admin } = await seedMinimalGame();
    const tToken = await teamToken(team.id, team.name);
    const aToken = await adminToken(admin.id, admin.username);
    const fireQ = await prisma.question.findUniqueOrThrow({ where: { code: "FIRE" } });

    const first = await request(app).post("/api/player/answers/submit").set("Authorization", `Bearer ${tToken}`).send({ questionId: fireQ.id, answer: "sai" });
    const queue1 = await request(app).get("/api/admin/review-queue").set("Authorization", `Bearer ${aToken}`);
    const item1 = queue1.body.submissions.find((s: any) => s.id === first.body.submission.id);

    await request(app).post(`/api/admin/review/${item1.id}`).set("Authorization", `Bearer ${aToken}`).send({ decision: "RETRY_ALLOWED", adminNote: "Thử lại nhé" });

    const second = await request(app).post("/api/player/answers/submit").set("Authorization", `Bearer ${tToken}`).send({ questionId: fireQ.id, answer: "đúng" });
    expect(second.status).toBe(200);
    const queue2 = await request(app).get("/api/admin/review-queue").set("Authorization", `Bearer ${aToken}`);
    const item2 = queue2.body.submissions.find((s: any) => s.id === second.body.submission.id);
    const review2 = await request(app).post(`/api/admin/review/${item2.id}`).set("Authorization", `Bearer ${aToken}`).send({ decision: "CORRECT" });
    expect(review2.body.submission.status).toBe("CORRECT");
  });

  it("Admin có thể điều chỉnh điểm thủ công khi chấm", async () => {
    const { team, admin } = await seedMinimalGame();
    const tToken = await teamToken(team.id, team.name);
    const aToken = await adminToken(admin.id, admin.username);
    const bodyQ = await prisma.question.findUniqueOrThrow({ where: { code: "BODY" } });

    const submit = await request(app).post("/api/player/answers/submit").set("Authorization", `Bearer ${tToken}`).send({ questionId: bodyQ.id, answer: "đáp án gần đúng" });
    const queue = await request(app).get("/api/admin/review-queue").set("Authorization", `Bearer ${aToken}`);
    const item = queue.body.submissions.find((s: any) => s.id === submit.body.submission.id);

    const review = await request(app)
      .post(`/api/admin/review/${item.id}`)
      .set("Authorization", `Bearer ${aToken}`)
      .send({ decision: "CORRECT", awardedPoints: 5, adminNote: "Đúng một phần" });
    expect(review.body.submission.awardedPoints).toBe(5);
  });

  it("Hai đội bằng điểm được xếp hạng theo thời gian hoàn thành câu 7 sớm hơn", async () => {
    await seedMinimalGame();
    const teamA = await prisma.team.create({
      data: {
        name: "Đội A",
        joinCode: generateJoinCode(),
        totalScore: 0,
        finalQuestionCompletedAt: new Date("2026-07-20T10:00:00Z"),
      },
    });
    const teamB = await prisma.team.create({
      data: {
        name: "Đội B",
        joinCode: generateJoinCode(),
        totalScore: 0,
        finalQuestionCompletedAt: new Date("2026-07-20T09:00:00Z"),
      },
    });
    const toyQ = await prisma.question.findUniqueOrThrow({ where: { code: "TOY" } });
    for (const t of [teamA, teamB]) {
      await prisma.submission.create({
        data: { teamId: t.id, questionId: toyQ.id, answer: "P5", status: "CORRECT", awardedPoints: 5 },
      });
    }
    const entries = await computeLeaderboard();
    const a = entries.find((e) => e.teamId === teamA.id)!;
    const b = entries.find((e) => e.teamId === teamB.id)!;
    expect(b.rank).toBeLessThan(a.rank); // Đội B hoàn thành câu 7 sớm hơn -> xếp trên
  });

  it("Đội A không thể đọc dữ liệu của Đội B (mỗi token chỉ gắn với 1 đội)", async () => {
    const { team } = await seedMinimalGame();
    const otherTeam = await prisma.team.create({ data: { name: "Đội Khác", joinCode: generateJoinCode() } });
    const tokenA = signTeamToken({ teamId: team.id, teamName: team.name });

    // Token của Đội A chỉ giải mã ra teamId của A; endpoint /me luôn dùng teamId trong token,
    // không có tham số nào cho phép truyền teamId của đội khác.
    const res = await request(app).get("/api/player/me").set("Authorization", `Bearer ${tokenA}`);
    expect(res.body.team.id).toBe(team.id);
    expect(res.body.team.id).not.toBe(otherTeam.id);
  });

  it("Không thể gửi đáp án sau khi game đã kết thúc", async () => {
    const { team, admin } = await seedMinimalGame();
    const tToken = await teamToken(team.id, team.name);
    const aToken = await adminToken(admin.id, admin.username);

    await request(app).post("/api/admin/game/end").set("Authorization", `Bearer ${aToken}`);

    const toyQ = await prisma.question.findUniqueOrThrow({ where: { code: "TOY" } });
    const res = await request(app).post("/api/player/answers/submit").set("Authorization", `Bearer ${tToken}`).send({ questionId: toyQ.id, answer: "P5" });
    expect(res.status).toBe(403);
  });

  it("Giới hạn tốc độ gửi đáp án (rate limit) chặn spam liên tục", async () => {
    const { team } = await seedMinimalGame();
    const tToken = await teamToken(team.id, team.name);
    const fireQ = await prisma.question.findUniqueOrThrow({ where: { code: "FIRE" } });

    // ANSWER_RATE_LIMIT_PER_MINUTE = 3 trong môi trường test (xem tests/setup.ts)
    let lastStatus = 200;
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post("/api/player/answers/submit")
        .set("Authorization", `Bearer ${tToken}`)
        .send({ questionId: fireQ.id, answer: `thử lần ${i}` });
      lastStatus = res.status;
      if (res.status === 429) break;
    }
    expect(lastStatus).toBe(429);
  });

  it("Refresh trang (gọi lại /me) vẫn giữ nguyên tiến trình đã lưu", async () => {
    const { team } = await seedMinimalGame();
    const tToken = await teamToken(team.id, team.name);
    const toyQ = await prisma.question.findUniqueOrThrow({ where: { code: "TOY" } });
    await request(app).post("/api/player/answers/submit").set("Authorization", `Bearer ${tToken}`).send({ questionId: toyQ.id, answer: "P5" });

    const call1 = await request(app).get("/api/player/me").set("Authorization", `Bearer ${tToken}`);
    const call2 = await request(app).get("/api/player/me").set("Authorization", `Bearer ${tToken}`);
    expect(call1.body.team.totalScore).toBe(call2.body.team.totalScore);
    expect(call2.body.team.totalScore).toBe(5);
  });
});
