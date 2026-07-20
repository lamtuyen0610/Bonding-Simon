import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/db";
import { resetDatabase, seedMinimalGame, teamToken } from "./helpers";
import { generateJoinCode, signTeamToken } from "../src/utils/auth";

describe("Đội tự reset lại tiến trình của chính mình", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("Xóa hết đáp án đã gửi và đặt lại mọi mốc tiến trình về ban đầu", async () => {
    const { team } = await seedMinimalGame();
    const token = await teamToken(team.id, team.name);

    const toyQ = await prisma.question.findUniqueOrThrow({ where: { code: "TOY" } });
    await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ questionId: toyQ.id, answer: "P5" });

    const teamAfterAnswer = await prisma.team.findUniqueOrThrow({ where: { id: team.id } });
    expect(teamAfterAnswer.clue1Delivered).toBe(true);
    const submissionsBefore = await prisma.submission.count({ where: { teamId: team.id } });
    expect(submissionsBefore).toBeGreaterThan(0);

    const reset = await request(app).post("/api/player/reset").set("Authorization", `Bearer ${token}`);
    expect(reset.status).toBe(200);

    const submissionsAfter = await prisma.submission.count({ where: { teamId: team.id } });
    expect(submissionsAfter).toBe(0);

    const teamAfterReset = await prisma.team.findUniqueOrThrow({ where: { id: team.id } });
    expect(teamAfterReset.clue1Delivered).toBe(false);
    expect(teamAfterReset.status).toBe("PLAYING");
    expect(teamAfterReset.sixTasksCompletedAt).toBeNull();
    expect(teamAfterReset.caseDecodedAt).toBeNull();

    // Có thể trả lời lại từ đầu
    const resubmit = await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ questionId: toyQ.id, answer: "P5" });
    expect(resubmit.status).toBe(200);
    expect(resubmit.body.submission.status).toBe("CORRECT");
  });

  it("Reset của đội A không ảnh hưởng tới dữ liệu của đội B", async () => {
    const { team } = await seedMinimalGame();
    const otherTeam = await prisma.team.create({ data: { name: "Đội B", joinCode: generateJoinCode() } });

    const toyQ = await prisma.question.findUniqueOrThrow({ where: { code: "TOY" } });
    const tokenB = signTeamToken({ teamId: otherTeam.id, teamName: otherTeam.name });
    await request(app)
      .post("/api/player/answers/submit")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ questionId: toyQ.id, answer: "P5" });

    const tokenA = await teamToken(team.id, team.name);
    await request(app).post("/api/player/reset").set("Authorization", `Bearer ${tokenA}`);

    const submissionsB = await prisma.submission.count({ where: { teamId: otherTeam.id } });
    expect(submissionsB).toBe(1); // không bị xóa theo đội A
  });
});
