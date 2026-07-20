import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Cấu hình cho phép truy cập từ các thiết bị khác trong cùng mạng LAN
// (ví dụ khi tổ chức bonding tại villa, các đội mở IP nội bộ của laptop BTC).
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:4000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
});
