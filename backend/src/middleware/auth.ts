import { Request, Response, NextFunction } from "express";
import { verifyToken, AdminTokenPayload, TeamTokenPayload } from "../utils/auth";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminTokenPayload;
      team?: TeamTokenPayload;
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length);
  }
  if (req.cookies?.token) {
    return req.cookies.token;
  }
  return null;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "Thiếu token xác thực." });
  }
  try {
    const payload = verifyToken(token);
    if (payload.role !== "ADMIN") {
      return res.status(403).json({ error: "Bạn không có quyền Admin." });
    }
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Token không hợp lệ hoặc đã hết hạn." });
  }
}

export function requireTeam(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "Thiếu token xác thực." });
  }
  try {
    const payload = verifyToken(token);
    if (payload.role !== "TEAM") {
      return res.status(403).json({ error: "Chỉ đội chơi mới được truy cập." });
    }
    req.team = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Token không hợp lệ hoặc đã hết hạn." });
  }
}

/**
 * Đảm bảo đội chỉ có thể thao tác trên dữ liệu của chính mình,
 * ngăn việc sửa URL/param để đọc dữ liệu đội khác.
 */
export function requireOwnTeam(paramName = "teamId") {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestedTeamId = req.params[paramName];
    if (!req.team || req.team.teamId !== requestedTeamId) {
      return res.status(403).json({ error: "Bạn chỉ có thể truy cập dữ liệu của đội mình." });
    }
    next();
  };
}
