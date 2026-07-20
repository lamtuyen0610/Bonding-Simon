import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { comparePassword, signAdminToken, signTeamToken } from "../utils/auth";

export const authRouter = Router();

const adminLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post("/admin/login", async (req, res) => {
  const parsed = adminLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Vui lòng nhập đủ tài khoản và mật khẩu." });
  }
  const { username, password } = parsed.data;

  const admin = await prisma.admin.findUnique({ where: { username } });
  if (!admin) {
    return res.status(401).json({ error: "Tài khoản hoặc mật khẩu không đúng." });
  }
  const valid = await comparePassword(password, admin.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Tài khoản hoặc mật khẩu không đúng." });
  }

  const token = signAdminToken({ adminId: admin.id, username: admin.username });
  res.json({ token, admin: { id: admin.id, username: admin.username, displayName: admin.displayName } });
});

const teamJoinSchema = z.object({
  teamName: z.string().min(1, "Vui lòng nhập tên đội."),
});

authRouter.post("/team/join", async (req, res) => {
  const parsed = teamJoinSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Dữ liệu không hợp lệ." });
  }
  const normalizedInputName = parsed.data.teamName.trim().toLowerCase();

  // Team.name không unique ở tầng DB nên so khớp không phân biệt hoa/thường ở đây.
  const teams = await prisma.team.findMany();
  const team = teams.find((t) => t.name.trim().toLowerCase() === normalizedInputName);

  if (!team) {
    return res.status(404).json({ error: "Không tìm thấy đội với tên này. Vui lòng kiểm tra lại với Ban tổ chức." });
  }
  if (!team.isActive) {
    return res.status(403).json({ error: "Đội này hiện đang bị vô hiệu hóa. Vui lòng liên hệ Ban tổ chức." });
  }

  const gameSession = await prisma.gameSession.findFirst({ orderBy: { createdAt: "desc" } });
  if (gameSession && (gameSession.status === "DRAFT")) {
    return res.status(403).json({ error: "Trò chơi chưa bắt đầu. Vui lòng chờ Ban tổ chức khởi động." });
  }

  const token = signTeamToken({ teamId: team.id, teamName: team.name });
  res.json({
    token,
    team: { id: team.id, name: team.name },
  });
});
