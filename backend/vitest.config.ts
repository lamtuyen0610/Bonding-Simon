import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
    // Chạy tuần tự để tránh xung đột trên cùng 1 file SQLite test.
    fileParallelism: false,
  },
});
