import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/db";
import { resetDatabase, seedMinimalGame, adminToken, teamToken } from "./helpers";

describe("Admin xóa hẳn đội (kèm lịch sử trả lời)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("Xóa đội thành công, đội và toàn bộ submission của đội biến mất khỏi database", async () => {
    const { team, admin } = await seedMinimalGame();
    const tToken = await teamToken(team.id, team.name);
    const aToken = await adminToken(admin.id, admin.username);

    const toyQ = await prisma.question.findUniqueOrThrow({ where: { code: "TOY" } });
    await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${tToken}`)
      .send({ questionId: toyQ.id, answer: "P5" });

    const submissionsBefore = await prisma.submission.count({ where: { teamId: team.id } });
    expect(submissionsBefore).toBeGreaterThan(0);

    const res = await request(app).delete(`/api/admin/teams/${team.id}`).set("Authorization", `Bearer ${aToken}`);
    expect(res.status).toBe(200);

    const teamAfter = await prisma.team.findUnique({ where: { id: team.id } });
    expect(teamAfter).toBeNull();

    const submissionsAfter = await prisma.submission.count({ where: { teamId: team.id } });
    expect(submissionsAfter).toBe(0);

    // Đội đã xóa không thể đăng nhập lại (token cũ vô hiệu vì team không còn tồn tại)
    const meAfterDelete = await request(app).get("/api/player/me").set("Authorization", `Bearer ${tToken}`);
    expect(meAfterDelete.status).toBe(404);
  });

  it("Xóa đội không tồn tại trả về 404", async () => {
    const { admin } = await seedMinimalGame();
    const aToken = await adminToken(admin.id, admin.username);
    const res = await request(app)
      .delete("/api/admin/teams/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${aToken}`);
    expect(res.status).toBe(404);
  });
});
