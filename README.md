# KHỞI NGUỒN — Game điều tra vụ án cho hoạt động Team Bonding

Ứng dụng web 2 chế độ (Player / Admin) để tổ chức trò chơi điều tra vụ án.
Chạy được theo 2 cách:
- **Online qua Internet** (khuyến nghị nếu các đội chơi từ xa, không cùng chỗ) — deploy
  lên 1 server cloud, các đội chỉ cần mở link là chơi được.
- **LAN nội bộ** (không cần internet) — phù hợp khi tổ chức tại villa/khu nghỉ dưỡng có
  Wi-Fi riêng nhưng không có mạng ngoài.

> ⚠️ **Lưu ý quan trọng**: Bộ mã nguồn này được viết đầy đủ và sẵn sàng chạy, nhưng
> chưa được `npm install` / build / deploy thử trong môi trường tạo ra nó (môi trường đó
> không có kết nối internet). Hãy làm theo các bước bên dưới trên máy của bạn hoặc trên
> nền tảng cloud bạn chọn — mọi lệnh sẽ hoạt động bình thường ở đó.

---

## 1. Kiến trúc tổng quan

```
khoi-nguon/
├── backend/     Node.js + Express + TypeScript + Prisma (SQLite) + Socket.IO
├── frontend/    React + TypeScript + Vite + Tailwind CSS
└── Dockerfile   Build 1 image duy nhất chứa cả frontend + backend, dùng để deploy online
```

- **Backend** chịu trách nhiệm toàn bộ logic: xác thực đội/Admin, kiểm tra đáp án,
  tính điểm, mở khóa các bước, xếp hạng, và phát sự kiện realtime qua Socket.IO.
  Đáp án đúng **không bao giờ** được gửi về phía Player trước khi được xác nhận.
- **Frontend** là giao diện thuần túy, gọi API và lắng nghe Socket.IO để tự cập nhật.
- Ở production, backend tự phục vụ luôn giao diện đã build — **chỉ 1 server, 1 URL** cho
  cả Admin lẫn tất cả các đội, dù chơi từ bất kỳ đâu có internet.
- Dữ liệu lưu trong SQLite (1 file), không cần cài đặt server database riêng.

---

## 2. Yêu cầu môi trường (khi chạy/dev trên máy local)

- Node.js **20.x** trở lên — kiểm tra bằng `node -v`
- npm **9.x** trở lên — kiểm tra bằng `npm -v`
- Không cần cài SQLite riêng (đi kèm qua Prisma)

Nếu chỉ muốn **deploy online** và không cần chạy trên máy trước, có thể bỏ qua mục 2-4 và
đi thẳng tới **mục 7 — Triển khai Online**.

---

## 3. Cài đặt trên máy (để test trước khi deploy)

### 3.1. Cài dependency

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3.2. Cấu hình biến môi trường (Backend)

```bash
cd backend
cp .env.example .env
```

Mở file `.env` và **bắt buộc đổi**:
- `JWT_SECRET` — một chuỗi bí mật ngẫu nhiên, dài, khó đoán.
- `SEED_ADMIN_PASSWORD` — mật khẩu Admin ban đầu (có thể đổi lại sau khi seed).

### 3.3. Khởi tạo database

```bash
cd backend
npm run db:migrate   # tạo bảng theo schema Prisma (lần đầu sẽ hỏi tên migration, để mặc định "init")
npm run db:seed       # tạo dữ liệu demo: câu hỏi, 5 đội, tài khoản Admin
```

Sau khi seed xong, terminal sẽ in ra **tài khoản Admin** và **mã đội demo** — hãy lưu lại.

---

## 4. Chạy ở chế độ Development (trên máy local)

```bash
# Terminal 1 — Backend (cổng 4000)
cd backend && npm run dev
```
```bash
# Terminal 2 — Frontend (cổng 5173, tự động proxy API sang cổng 4000)
cd frontend && npm run dev
```

Mở trình duyệt: Player tại `http://localhost:5173/join`, Admin tại `http://localhost:5173/admin/login`.

---

## 5. Build Production (chạy thử trên máy trước khi deploy)

```bash
cd frontend && npm run build
rm -rf ../backend/public && cp -r dist ../backend/public   # Windows: dùng Copy-Item -Recurse
cd ../backend && npm run build
npm start
```

Server chạy tại `http://localhost:4000`, phục vụ cả API và giao diện tại cùng 1 cổng —
đây chính xác là cách nó sẽ chạy trên cloud.

---

## 6. Chạy trong mạng LAN nội bộ (không cần internet)

Nếu tổ chức tại nơi có Wi-Fi riêng nhưng muốn giữ mọi thứ offline (không đưa lên internet):

1. Chạy server production như mục 5 trên laptop BTC.
2. Tìm IP nội bộ của laptop: Windows `ipconfig`, macOS `ifconfig | grep inet`, Linux `ip addr show`.
3. Các đội kết nối cùng Wi-Fi, mở `http://<IP-laptop>:4000/join`.
4. Admin mở `http://<IP-laptop>:4000/admin/login`.
5. Nếu không vào được, kiểm tra Firewall của laptop có chặn cổng 4000 không (chọn "Allow access" khi được hỏi).

---

## 7. Triển khai Online (để các đội chơi từ xa qua Internet)

Đây là cách phù hợp nhất khi các đội **không ở cùng một chỗ** — mỗi người chỉ cần 1 link
là vào chơi được, không cần cùng Wi-Fi.

### Vì sao không dùng hosting "miễn phí hoàn toàn" kiểu serverless (Vercel, Netlify...)?

App này cần:
1. Một **process chạy liên tục** (không phải serverless) để giữ kết nối **Socket.IO**
   (realtime: giao hồ sơ, mở khóa câu 7, chấm điểm cập nhật ngay không cần refresh).
2. Một **ổ đĩa lưu trữ lâu dài (persistent volume/disk)** cho file SQLite, để dữ liệu
   không bị xóa mỗi khi deploy lại hoặc server khởi động lại.

Vercel/Netlify (serverless) không đáp ứng tốt 2 điều trên. Các nền tảng phù hợp và có gói
miễn phí/rất rẻ: **Railway** (khuyến nghị, dễ nhất) hoặc **Fly.io** (free allowance rộng hơn
nhưng cấu hình qua CLI phức tạp hơn một chút). Cả hai đều nhận diện `Dockerfile` có sẵn
trong repo và tự build.

### 7.1. Cách A — Railway (khuyến nghị, dễ nhất)

1. Đẩy toàn bộ thư mục `khoi-nguon/` lên 1 GitHub repository (riêng tư hoặc công khai đều được).
2. Vào https://railway.app → đăng nhập bằng GitHub → **New Project** → **Deploy from GitHub repo**
   → chọn repo vừa đẩy lên. Railway tự nhận diện `Dockerfile` ở thư mục gốc và build.
3. Vào tab **Variables** của service, thêm các biến môi trường (copy nội dung tương tự
   `backend/.env.example`, giá trị thật):
   - `JWT_SECRET` = một chuỗi ngẫu nhiên dài (bắt buộc đổi, không dùng giá trị mẫu)
   - `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD` = tài khoản Admin bạn muốn dùng
   - `DATABASE_URL` = `file:/data/prod.db`
   - `CORS_ORIGIN` = `*` (để mặc định là được, vì frontend/backend chung 1 domain)
   - `PORT` = `4000` (Railway có thể tự set `PORT` riêng — không sao, code đã đọc `process.env.PORT`)
4. Vào tab **Settings** → **Volumes** → **Add Volume** → mount path đặt là `/data`
   (đây là nơi lưu file SQLite lâu dài, sống sót qua các lần deploy lại).
5. Bấm **Deploy**. Sau khi build xong, Railway cấp cho bạn 1 domain dạng
   `https://ten-du-an.up.railway.app` (mục **Settings → Networking → Generate Domain**).
6. **Seed dữ liệu lần đầu**: mở tab **Shell** (hoặc dùng Railway CLI: `railway run sh`) của
   service, chạy:
   ```bash
   node dist/index.js &   # đảm bảo server đã chạy (thường Railway đã tự chạy sẵn)
   npx prisma db seed --schema=./prisma/schema.prisma
   # hoặc nếu package.json có script seed đã build sẵn dưới dist, chạy trực tiếp file seed đã biên dịch;
   # cách đơn giản nhất: dùng Railway CLI chạy đúng lệnh nguồn:
   railway run npm run db:seed --prefix backend
   ```
   Cách đơn giản và chắc chắn nhất: cài **Railway CLI** trên máy bạn (`npm i -g @railway/cli`),
   `railway login`, `railway link` (chọn đúng project), rồi chạy:
   ```bash
   railway run --service <ten-service> sh -c "cd backend && npm run db:seed"
   ```
   Terminal sẽ in ra tài khoản Admin và mã đội demo như khi chạy local.
7. Chia sẻ link cho các đội: `https://ten-du-an.up.railway.app/join`.
   Admin dùng: `https://ten-du-an.up.railway.app/admin/login`.

Chi phí: Railway có gói dùng thử miễn phí ban đầu, sau đó tính theo mức sử dụng thực tế —
với quy mô 20 người chơi trong vài giờ, chi phí thường chỉ vài chục nghìn đến dưới 100.000đ
mỗi lần tổ chức. Kiểm tra bảng giá mới nhất tại https://railway.app/pricing vì có thể thay đổi.

### 7.2. Cách B — Fly.io (free allowance rộng hơn, cần CLI)

1. Cài Fly CLI: xem hướng dẫn tại https://fly.io/docs/flyctl/install/
2. Đăng nhập: `fly auth login`
3. Từ thư mục gốc `khoi-nguon/`, chạy `fly launch` — Fly sẽ nhận diện `Dockerfile` có sẵn,
   hỏi tên app và region (chọn region gần Việt Nam nhất, ví dụ Singapore).
4. Khi được hỏi có tạo Postgres/Redis không → chọn **No** (dùng SQLite qua Volume thay thế).
5. Tạo volume lưu dữ liệu: `fly volumes create data --size 1 --region <region-đã-chọn>`
6. Mở file `fly.toml` vừa được tạo, thêm phần mount volume (nếu `fly launch` chưa tự thêm):
   ```toml
   [mounts]
     source = "data"
     destination = "/data"
   ```
7. Set biến môi trường:
   ```bash
   fly secrets set JWT_SECRET="chuoi-bi-mat-cua-ban" DATABASE_URL="file:/data/prod.db" \
     SEED_ADMIN_USERNAME="admin" SEED_ADMIN_PASSWORD="mat-khau-cua-ban"
   ```
8. Deploy: `fly deploy`
9. Seed dữ liệu lần đầu: `fly ssh console -C "sh -c 'cd /app && npm run db:seed'"`
   (nếu báo thiếu script vì đã build production, chạy trực tiếp qua `node` — xem README của Fly
   nếu gặp khác biệt so với hướng dẫn này).
10. Lấy domain: `fly status` → domain dạng `https://ten-app.fly.dev`. Chia sẻ
    `https://ten-app.fly.dev/join` cho các đội.

### 7.3. Sau khi deploy — những điều cần nhớ

- **Đổi mật khẩu Admin ngay** nếu bạn seed bằng giá trị mẫu.
- **HTTPS** được cả Railway và Fly.io tự cấp miễn phí (Let's Encrypt) — không cần cấu hình
  thêm, và Socket.IO hoạt động bình thường qua HTTPS/WSS.
- **Backup định kỳ**: tải file SQLite trong Volume về máy trước/sau mỗi buổi chơi quan trọng
  (Railway: qua Shell dùng `railway run cat /data/prod.db > backup.db` từ máy có CLI; Fly:
  `fly ssh sftp get /data/prod.db`).
- Nếu tổ chức game nhiều lần, nhớ **Reset toàn bộ game** giữa các lần (Admin → Điều khiển
  game → Vùng nguy hiểm) trước khi bắt đầu buổi mới, để điểm/tiến trình không bị lẫn.
- Domain miễn phí do Railway/Fly cấp là đủ dùng; nếu muốn domain riêng (ví dụ
  `dieutra.congtyban.com`), cả hai nền tảng đều hỗ trợ gắn custom domain trong phần Settings.

---

## 8. Tài khoản & mã đội demo (sau khi seed)

- **Admin**: username từ biến môi trường (mặc định `admin`), mật khẩu từ biến môi trường
  (mặc định `ThayDoiMatKhauNgay!` — **hãy đổi ngay**, dù chạy local hay online).
- **5 đội demo**: Đội Thám Tử 01 → 05, mỗi đội có 1 mã đội ngẫu nhiên 6 ký tự được in ra
  khi chạy lệnh seed. Có thể xem lại/tạo mới mã đội trong Admin → Đội chơi → chọn đội →
  "Sinh mã đội mới". Với game online, nên **tạo lại đội bằng tên thật** của các nhóm chơi
  thay vì dùng tên demo, rồi gửi mã đội tương ứng cho từng nhóm qua tin nhắn/email.

---

## 9. Cách đổi câu hỏi, đáp án, hồ sơ, diễn biến vụ án

Toàn bộ nội dung câu chuyện thật (nguyên nhân cháy, danh tính xác chết, hung thủ, chủ
mưu, câu hỏi số 7, nội dung 2 tập hồ sơ, các chương diễn biến) được seed dưới dạng
**placeholder** — bạn cần cập nhật trước khi tổ chức, thao tác giống nhau dù chạy local
hay online (chỉ khác domain truy cập Admin):

- **Câu hỏi & đáp án**: Admin → Câu hỏi. Sửa tiêu đề, nội dung, điểm, và đáp án đúng
  (với câu chấm tự động — cách nhau bằng dấu phẩy nếu có nhiều đáp án chấp nhận được).
- **Mật mã két sắt**: hiện là "1234" (demo), sửa qua Admin → Câu hỏi → câu "Xoay và mở
  két sắt" (đổi trong phần đáp án đúng, đúng số chữ số cấu hình).
- **Nội dung 2 tập hồ sơ**: với game online (không có hồ sơ giấy), gợi ý đổi cách giao hồ
  sơ thành: BTC gửi ảnh chụp/PDF manh mối qua chat riêng (Zalo/Messenger) cho đội khi bấm
  nút "Đã giao Tập hồ sơ số 1/2" trong Admin — nội dung chuẩn bị riêng dựa theo gợi ý trong
  `CluePackage` (xem seed data).
- **Diễn biến vụ án**: Admin → Diễn biến vụ án. Thêm/sửa/xóa từng chương, xem trước trước
  khi công bố cho người chơi.

---

## 10. Cách reset game

- **Reset tiến trình 1 đội**: Admin → Đội chơi → chọn đội → "Reset tiến trình".
- **Reset toàn bộ game** (xóa hết đáp án, điểm, trạng thái mọi đội — không thể hoàn tác):
  Admin → Điều khiển game → mục "Vùng nguy hiểm" → gõ đúng `XAC_NHAN_RESET` → bấm nút.

---

## 11. Backup database

- **Local/LAN**: toàn bộ dữ liệu nằm trong 1 file `backend/prisma/dev.db`.
  ```bash
  cp backend/prisma/dev.db backup-$(date +%Y%m%d-%H%M).db   # sao lưu
  cp backup-20260101-1200.db backend/prisma/dev.db          # khôi phục (dừng server trước)
  ```
- **Online (Railway/Fly.io)**: dữ liệu nằm trong Volume tại `/data/prod.db` trên server —
  xem cách tải về ở mục 7.3.

---

## 12. Xử lý lỗi thường gặp

| Triệu chứng | Nguyên nhân khả dĩ | Cách xử lý |
|---|---|---|
| Đội không vào được link online | Chưa deploy xong, hoặc domain chưa được generate | Kiểm tra trạng thái deploy trên Railway/Fly, đảm bảo đã bấm "Generate Domain" |
| "Mã đội không hợp lệ" | Gõ sai mã, hoặc đội bị vô hiệu hóa | Kiểm tra lại trong Admin → Đội chơi |
| Dashboard không tự cập nhật khi Admin thao tác | Mất kết nối Socket.IO | Trang sẽ tự kết nối lại (reconnect); nếu vẫn không được, refresh trang — tiến trình không mất vì đã lưu ở server |
| Dữ liệu bị mất sau khi deploy lại (online) | Chưa gắn Volume, hoặc `DATABASE_URL` không trỏ vào `/data` | Kiểm tra lại mục 7.1 bước 4 (Railway) hoặc bước 5-6 (Fly.io) |
| `npm run db:migrate` báo lỗi (local) | Chưa có file `.env` hoặc `DATABASE_URL` sai | Kiểm tra lại bước 3.2 |
| Cổng 4000/5173 đã được dùng (local) | Có tiến trình khác đang chạy trên cổng đó | Đổi `PORT` trong `.env`, hoặc dừng tiến trình đang chiếm cổng |
| Đáp án gửi báo "quá nhanh" | Rate limit chống spam (mặc định 10 lần/phút/đội) | Đợi 1 phút, hoặc chỉnh `ANSWER_RATE_LIMIT_PER_MINUTE` |

---

## 13. Chạy test

```bash
cd backend
npm test
```

Bộ test dùng Vitest + Supertest, tự tạo 1 database SQLite riêng (`backend/tests/test.db`,
tách biệt hoàn toàn với `dev.db`/`prod.db`) nên **an toàn để chạy bất cứ lúc nào**.

Phạm vi test bao gồm: chuẩn hóa đáp án, toàn bộ 8 acceptance scenario trong đặc tả gốc,
chống bỏ qua bước qua URL/API, chống cộng điểm 2 lần, luồng chấm sai → cho trả lời lại →
chấm đúng, Admin điều chỉnh điểm thủ công, xếp hạng khi bằng điểm, cách ly dữ liệu giữa
các đội, khóa gửi đáp án sau khi kết thúc game, rate limit, và giữ tiến trình khi gọi lại
API (tương đương refresh trang).

---

## 14. Các lệnh chính

```bash
# Trong thư mục backend/
npm install         # cài dependency
npm run db:migrate  # tạo/migrate schema database
npm run db:seed     # seed dữ liệu demo (câu hỏi, đội, admin)
npm run dev          # chạy dev server (tsx watch, cổng 4000)
npm test             # chạy test suite (Vitest)
npm run build         # build TypeScript sang dist/
npm start            # chạy bản đã build (production)

# Trong thư mục frontend/
npm install          # cài dependency
npm run dev           # chạy dev server (Vite, cổng 5173)
npm run build          # build production sang dist/
npm run preview        # xem thử bản build (cổng 4173)

# Ở thư mục gốc (deploy online)
docker build -t khoi-nguon .    # build thử image local trước khi đẩy lên Railway/Fly (tùy chọn)
```

---

## 15. Bảo mật đã áp dụng

- Mật khẩu Admin được hash bằng bcrypt, không lưu plaintext.
- JWT ký bằng `JWT_SECRET` riêng, Admin token và Team token tách biệt vai trò (role).
- Toàn bộ kiểm tra đáp án, điều kiện mở khóa (Tập hồ sơ 1/2, câu hỏi số 7) đều thực hiện
  **ở backend** — sửa URL hoặc gọi thẳng API từ frontend không thể bỏ qua bước.
- API dành cho Player không bao giờ trả về đáp án đúng (`AcceptedAnswer`, `normalizedAnswer`)
  hay nội dung câu hỏi số 7 trước khi được mở khóa.
- Mỗi đội chỉ có thể đọc/ghi dữ liệu của chính mình (kiểm tra `teamId` từ JWT, không nhận
  `teamId` tùy ý từ client cho các thao tác nhạy cảm).
- Rate limit chống spam gửi đáp án theo từng đội.
- HTTPS bắt buộc khi chạy online (Railway/Fly.io tự cấp) — JWT không bị lộ qua kết nối
  không mã hóa.
- Audit log ghi lại các hành động quan trọng của Admin (giao hồ sơ, mở khóa, chấm điểm,
  reset, kết thúc game...).

---

## 16. Giới hạn đã biết / việc cần làm thêm

- Nội dung câu chuyện (nguyên nhân cháy, danh tính nạn nhân, hung thủ, chủ mưu, câu hỏi
  số 7, nội dung 2 tập hồ sơ, các chương diễn biến) là **placeholder** — bắt buộc cập nhật
  trước khi tổ chức thật, xem mục 9.
- Bộ mã nguồn được viết trong môi trường không có kết nối internet nên **chưa được chạy
  thử `npm install`, `npm test`, hay deploy thật lên Railway/Fly.io**. Hãy chạy test ở mục
  13 và làm 1 lần deploy thử trước ngày tổ chức thật để chắc chắn mọi thứ hoạt động đúng.
  Các bước Seed dữ liệu online ở mục 7.1/7.2 có thể cần điều chỉnh nhỏ tùy phiên bản CLI
  hiện tại của Railway/Fly.io tại thời điểm bạn triển khai.
- Chưa có màn hình trình chiếu riêng cho Admin; màn hình `/story` phía Player đã hỗ trợ
  chế độ toàn màn hình, có thể dùng để trình chiếu diễn biến vụ án.
