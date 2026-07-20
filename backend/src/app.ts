import "dotenv/config";
import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import cors from "cors";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import { authRouter } from "./routes/auth";
import { playerRouter } from "./routes/player";
import { adminRouter } from "./routes/admin";
import { setIO, ROOMS } from "./sockets/io";
import { verifyToken } from "./utils/auth";

const app = express();
const server = http.createServer(app);

// Khi chạy sau reverse proxy của Railway/Fly.io (hoặc Nginx khi tự host),
// cần bật trust proxy để lấy đúng IP client thật (phục vụ rate limit) và để
// Express nhận diện đúng kết nối HTTPS.
app.set("trust proxy", 1);

const corsOrigin = process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== "*" ? process.env.CORS_ORIGIN.split(",") : true;

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use("/api/auth", authRouter);
app.use("/api/player", playerRouter);
app.use("/api/admin", adminRouter);

// Nếu đã build frontend (npm run build ở thư mục frontend) và copy vào backend/public,
// server sẽ phục vụ luôn giao diện tại cùng cổng — chỉ cần 1 server duy nhất chạy tại villa.
const staticDir = path.join(__dirname, "..", "public");
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

// Error handler chung: không để lộ stack trace cho client.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Đã xảy ra lỗi phía máy chủ. Vui lòng thử lại." });
});

const io = new Server(server, {
  cors: { origin: corsOrigin, credentials: true },
});
setIO(io);

// Xác thực khi kết nối socket: đội chỉ được join phòng của chính đội mình,
// Admin join phòng "admin" để nhận cập nhật tổng quan.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return next(new Error("Thiếu token."));
  try {
    const payload = verifyToken(token);
    (socket as any).authPayload = payload;
    next();
  } catch {
    next(new Error("Token không hợp lệ."));
  }
});

io.on("connection", (socket) => {
  const payload = (socket as any).authPayload;
  if (payload.role === "ADMIN") {
    socket.join(ROOMS.admin);
  } else if (payload.role === "TEAM") {
    socket.join(ROOMS.team(payload.teamId));
  }

  socket.on("disconnect", () => {
    // Không cần xử lý gì thêm; Socket.IO tự dọn phòng.
  });
});

export { app, server, io };
