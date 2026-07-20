import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN_HOURS = Number(process.env.JWT_EXPIRES_IN_HOURS || 12);

export interface AdminTokenPayload {
  role: "ADMIN";
  adminId: string;
  username: string;
}

export interface TeamTokenPayload {
  role: "TEAM";
  teamId: string;
  teamName: string;
}

export type TokenPayload = AdminTokenPayload | TeamTokenPayload;

export function signAdminToken(payload: Omit<AdminTokenPayload, "role">): string {
  const data: AdminTokenPayload = { role: "ADMIN", ...payload };
  return jwt.sign(data, JWT_SECRET, { expiresIn: `${JWT_EXPIRES_IN_HOURS}h` });
}

export function signTeamToken(payload: Omit<TeamTokenPayload, "role">): string {
  const data: TeamTokenPayload = { role: "TEAM", ...payload };
  // Token của đội sống lâu hơn (24h) để không bị văng ra giữa game khi refresh.
  return jwt.sign(data, JWT_SECRET, { expiresIn: "24h" });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Sinh mã đội ngẫu nhiên dễ đọc, tránh các ký tự dễ nhầm lẫn (0/O, 1/I).
 */
export function generateJoinCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
