# syntax=docker/dockerfile:1

# ---------- Stage 1: build backend ----------
# Build backend trước để tránh build song song 2 phần cùng lúc (đỡ tốn RAM lúc build).
FROM node:20-alpine AS backend-build
RUN apk add --no-cache openssl
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
RUN npx prisma generate
RUN npm run build

# ---------- Stage 2: build frontend ----------
# Phụ thuộc giả vào backend-build (COPY 1 file nhỏ) để ép Docker build tuần tự,
# không chạy song song 2 stage cùng lúc gây tràn bộ nhớ khi build.
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY --from=backend-build /app/backend/package.json /tmp/_seq_dependency.json
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ---------- Stage 3: production runtime ----------
FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Copy toàn bộ backend đã build (node_modules đầy đủ, dist, prisma, src, package.json).
# Giữ luôn cả devDependencies + src/ để có thể chạy lệnh seed (npx tsx prisma/seed.ts)
# trực tiếp trong container qua Railway Console mà không cần bước cài đặt riêng.
COPY --from=backend-build /app/backend ./

# Giao diện đã build -> backend tự phục vụ tại cùng 1 cổng (xem src/app.ts)
COPY --from=frontend-build /app/frontend/dist ./public

# Thư mục /data dùng để gắn Volume lưu SQLite lâu dài (xem README phần triển khai)
RUN mkdir -p /data

EXPOSE 4000

# Đồng bộ schema trực tiếp vào database rồi khởi động server. Dùng "db push" thay vì
# "migrate deploy" vì repo này chưa có sẵn thư mục prisma/migrations — "db push" tạo bảng
# thẳng từ schema.prisma, không cần file migration. Không seed tự động ở đây —
# chạy seed thủ công 1 lần qua Railway Console (xem README).
CMD ["sh", "-c", "npx prisma db push --accept-data-loss --skip-generate && node dist/index.js"]
