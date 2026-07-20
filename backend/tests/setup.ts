import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const testDbPath = path.join(__dirname, "test.db");

// Dùng 1 file SQLite riêng cho test, tách biệt hoàn toàn với dev.db.
process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.JWT_SECRET = "test-secret";
process.env.ANSWER_RATE_LIMIT_PER_MINUTE = "3"; // giới hạn thấp để test rate limit nhanh hơn
process.env.NODE_ENV = "test";

if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

// Đẩy schema vào database test (không cần thư mục migrations).
execSync("npx prisma db push --skip-generate --accept-data-loss", {
  cwd: path.join(__dirname, ".."),
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: `file:${testDbPath}` },
});
