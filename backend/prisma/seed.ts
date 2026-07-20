import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { normalizeAnswer } from "../src/utils/normalize";
import { generateJoinCode } from "../src/utils/auth";

const prisma = new PrismaClient();

// Danh sách 10 nhân vật dùng chung cho các câu hỏi trắc nghiệm "ai là..."
const SUSPECT_NAMES = [
  "Vũ Đình Hùng",
  "Trần Thu Hà",
  "Đỗ Minh Toàn",
  "Nguyễn Ngọc Trúc",
  "Vũ Hà Nhi",
  "Đặng Văn Lâm",
  "Lê Thế Dân",
  "Lê Gia Phúc",
  "Lương Khánh Hiền",
  "Lê Quang Chiến",
];

async function main() {
  console.log("Đang tạo dữ liệu demo cho KHỞI NGUỒN...");

  // ---- Admin ----
  const adminUsername = process.env.SEED_ADMIN_USERNAME || "admin";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ThayDoiMatKhauNgay!";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.admin.upsert({
    where: { username: adminUsername },
    update: { passwordHash },
    create: { username: adminUsername, passwordHash, displayName: "Ban tổ chức" },
  });

  // ---- Game session ----
  const existingSession = await prisma.gameSession.findFirst();
  if (!existingSession) {
    await prisma.gameSession.create({ data: { name: "KHỞI NGUỒN" } });
  }

  // ---- Questions (6 nhiệm vụ + câu hỏi số 7) ----
  const questionsData = [
    {
      code: "TOY",
      title: "Tìm đồ chơi của Nhi",
      description: "Đồ chơi của Nhi đang nằm ở đâu?",
      points: 5,
      order: 1,
      type: "MULTIPLE_CHOICE" as const,
      validationMode: "AUTO" as const,
      revealMode: "IMMEDIATE" as const,
      allowRetryDefault: true,
      prerequisiteStage: null as string | null,
      options: [
        "Phòng bà Trúc",
        "Phòng P1",
        "Phòng P2",
        "Phòng P3",
        "Phòng P4",
        "Phòng P5",
        "Phòng P6",
        "Bị rơi trong lúc chạy ra khỏi đám cháy",
      ],
      answers: ["Phòng P5"],
      successMessage:
        "Đáp án chính xác. Lúc này Khiết đã tìm được con gấu bông của Nhi và bắt đầu thu thập được bản trích xuất lời khai của cháu Nhi. Mọi thứ vẫn còn rối ren nhưng chúng ta đã tiến 1 bước gần hơn với sự thật. Người chơi nhận Túi hồ sơ 1 từ ban chuyên án.",
    },
    {
      code: "SAFE",
      title: "Mở khóa Két sắt",
      description: "Sử dụng manh mối trong Tập hồ sơ số 1 để xoay đúng 3 chữ số mở két sắt.",
      points: 5,
      order: 2,
      type: "SAFE_DIAL" as const,
      validationMode: "AUTO" as const,
      revealMode: "IMMEDIATE" as const,
      allowRetryDefault: true,
      prerequisiteStage: null as string | null,
      options: null as string[] | null,
      answers: ["462"],
      safeDialConfig: JSON.stringify({ ui: { digits: 3, minDigit: 0, maxDigit: 9 } }),
      successMessage:
        "Két sắt đã được mở! Cùng lúc đó, đội khám nghiệm pháp y đã gửi lại kết quả về 2 thi thể tìm thấy trong căn trọ. Đây là bước đột phá lớn trong quá trình điều tra. Người chơi nhận Túi hồ sơ 2 từ ban chuyên án.",
    },
    {
      code: "FIRE",
      title: "Lí do xảy ra vụ cháy là gì?",
      description: "Chọn nguyên nhân đúng nhất dẫn đến vụ cháy.",
      points: 5,
      order: 3,
      type: "MULTIPLE_CHOICE" as const,
      validationMode: "AUTO" as const,
      revealMode: "DEFERRED" as const,
      allowRetryDefault: false,
      prerequisiteStage: null as string | null,
      options: [
        "Tai nạn: bất cẩn (nấu ăn, hút thuốc, hàn xì)",
        "Kỹ thuật: Chập điện, nổ bình gas, hỏng máy móc",
        "Cố ý: Đốt nhà, phá hoại, phi tang",
        "Tự nhiên: Sét đánh, tự hoá nhiệt",
      ],
      answers: ["Cố ý: Đốt nhà, phá hoại, phi tang"],
    },
    {
      code: "BODY",
      title: "Xác định danh tính xác chết ở P2",
      description: "Thi thể được tìm thấy ở phòng P2 là ai?",
      points: 10,
      order: 4,
      type: "MULTIPLE_CHOICE" as const,
      validationMode: "AUTO" as const,
      revealMode: "DEFERRED" as const,
      allowRetryDefault: false,
      prerequisiteStage: null as string | null,
      options: SUSPECT_NAMES,
      answers: ["Lê Thế Dân"],
    },
    {
      code: "KILLER",
      title: "Xác định hung thủ đã giết Hùng",
      description: "Ai là người đã ra tay sát hại Hùng?",
      points: 10,
      order: 5,
      type: "MULTIPLE_CHOICE" as const,
      validationMode: "AUTO" as const,
      revealMode: "DEFERRED" as const,
      allowRetryDefault: false,
      prerequisiteStage: null as string | null,
      options: SUSPECT_NAMES,
      answers: ["Đỗ Minh Toàn"],
    },
    {
      code: "MASTERMIND",
      title: "Xác định người chủ mưu vụ án",
      description: "Ai là người đứng sau, chủ mưu toàn bộ vụ án?",
      points: 10,
      order: 6,
      type: "MULTIPLE_CHOICE" as const,
      validationMode: "AUTO" as const,
      revealMode: "DEFERRED" as const,
      allowRetryDefault: false,
      prerequisiteStage: null as string | null,
      options: SUSPECT_NAMES,
      answers: ["Đỗ Minh Toàn"],
    },
    {
      code: "FINAL",
      title: "Câu hỏi số 7",
      description: "Ai là người đã đưa Hiền ra ngoài vào đêm vụ cháy xảy ra?",
      points: 10,
      order: 7,
      type: "MULTIPLE_CHOICE" as const,
      validationMode: "AUTO" as const,
      revealMode: "DEFERRED" as const,
      allowRetryDefault: false,
      isFinalQuestion: true,
      prerequisiteStage: "SIX_TASKS" as string | null,
      options: SUSPECT_NAMES,
      answers: ["Đỗ Minh Toàn"],
    },
  ];

  for (const q of questionsData) {
    const { answers, options, safeDialConfig, ...rest } = q as typeof q & { safeDialConfig?: string };
    const data = {
      ...rest,
      isFinalQuestion: q.code === "FINAL",
      options: options ? JSON.stringify(options) : null,
      safeDialConfig: safeDialConfig ?? null,
    };
    const question = await prisma.question.upsert({
      where: { code: q.code },
      update: data,
      create: data,
    });
    if (answers.length > 0) {
      await prisma.acceptedAnswer.deleteMany({ where: { questionId: question.id } });
      await prisma.acceptedAnswer.createMany({
        data: answers.map((a) => ({
          questionId: question.id,
          answer: a,
          normalizedAnswer: normalizeAnswer(a),
        })),
      });
    }
  }

  // ---- Clue packages (thông tin mô tả, dùng cho tài liệu Admin) ----
  await prisma.cluePackage.upsert({
    where: { code: "CLUE1" },
    update: {},
    create: {
      code: "CLUE1",
      name: "Tập hồ sơ số 1",
      hint: "Chứa manh mối để xoay két sắt (mã 3 chữ số). Tự động cấp cho đội khi trả lời đúng câu 'Tìm đồ chơi của Nhi'.",
    },
  });
  await prisma.cluePackage.upsert({
    where: { code: "CLUE2" },
    update: {},
    create: {
      code: "CLUE2",
      name: "Tập hồ sơ số 2",
      hint: "Kết quả khám nghiệm pháp y về 2 thi thể. Tự động cấp cho đội khi mở đúng két sắt.",
    },
  });

  // ---- Story chapters (placeholder) ----
  const chapterCount = await prisma.storyChapter.count();
  if (chapterCount === 0) {
    await prisma.storyChapter.createMany({
      data: [
        {
          title: "Chương 1: Khởi nguồn",
          content:
            "[Placeholder — nhập nội dung mở đầu câu chuyện thật tại Admin > Quản lý nội dung diễn biến.]",
          order: 1,
        },
        {
          title: "Chương 2: Những manh mối đầu tiên",
          content: "[Placeholder — nhập nội dung thật.]",
          order: 2,
        },
        {
          title: "Chương cuối: Sự thật được hé lộ",
          content: "[Placeholder — nhập nội dung kết thúc thật.]",
          order: 3,
        },
      ],
    });
  }

  // ---- Teams demo ----
  const teamNames = [
    "Đội Thám Tử 01",
    "Đội Thám Tử 02",
    "Đội Thám Tử 03",
    "Đội Thám Tử 04",
    "Đội Thám Tử 05",
  ];

  const demoTeams: { name: string; joinCode: string }[] = [];
  for (const name of teamNames) {
    const existing = await prisma.team.findFirst({ where: { name } });
    if (existing) {
      demoTeams.push({ name, joinCode: existing.joinCode });
      continue;
    }
    let joinCode = generateJoinCode();
    // eslint-disable-next-line no-await-in-loop
    while (await prisma.team.findUnique({ where: { joinCode } })) {
      joinCode = generateJoinCode();
    }
    // eslint-disable-next-line no-await-in-loop
    await prisma.team.create({ data: { name, joinCode } });
    demoTeams.push({ name, joinCode });
  }

  console.log("\n================= TÀI KHOẢN DEMO =================");
  console.log(`Admin: username="${adminUsername}"  password="${adminPassword}"`);
  console.log("(Hãy đổi mật khẩu này ngay khi triển khai thật — xem README.)\n");
  console.log("Đội demo (giờ có thể tham gia bằng CHÍNH TÊN ĐỘI, không cần mã đội):");
  for (const t of demoTeams) {
    console.log(`  - ${t.name}`);
  }
  console.log("====================================================\n");
  console.log("Seed hoàn tất.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
