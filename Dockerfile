# syntax=docker/dockerfile:1

# ---------- Stage 1: build backend ----------
# Build backend trước để tránh build song song 2 phần cùng lúc (đỡ tốn RAM lúc build).
FROM node:20-alpine AS backend-build
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
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Chỉ cài dependency production (bỏ devDependencies để image nhẹ hơn)
COPY backend/package*.json ./
RUN npm install --omit=dev

# Mã đã build của backend + schema Prisma cần cho migrate/generate lúc chạy
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=backend-build /app/backend/prisma ./prisma
COPY --from=backend-build /app/backend/node_modules/.prisma ./node_modules/.prisma

# Giao diện đã build -> backend tự phục vụ tại cùng 1 cổng (xem src/app.ts)
COPY --from=frontend-build /app/frontend/dist ./public

# Thư mục /data dùng để gắn Volume lưu SQLite lâu dài (xem README phần triển khai)
RUN mkdir -p /data

EXPOSE 4000

# Áp dụng migration rồi khởi động server. Không seed tự động ở đây —
# chạy seed thủ công 1 lần sau lần deploy đầu tiên (xem README).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
