import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { normalizeAnswer } from "../src/utils/normalize";
import { generateJoinCode } from "../src/utils/auth";

const prisma = new PrismaClient();

async function main() {
  console.log("Đang tạo dữ liệu demo cho KHỞI NGUỒN...");

  // ---- Admin ----
  const adminUsername = process.env.SEED_ADMIN_USERNAME || "admin";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ThayDoiMatKhauNgay!";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.admin.upsert({
    where: { username: adminUsername },
    update: {},
    create: { username: adminUsername, passwordHash, displayName: "Ban tổ chức" },
  });

  // ---- Game session ----
  const existingSession = await prisma.gameSession.findFirst();
  if (!existingSession) {
    await prisma.gameSession.create({ data: { name: "KHỞI NGUỒN" } });
  }

  // ---- Questions (7 câu, demo/placeholder theo đúng yêu cầu) ----
  const questionsData = [
    {
      code: "TOY",
      title: "Tìm vị trí món đồ chơi của Nhi",
      description: "Món đồ chơi của Nhi đang nằm ở vị trí nào?",
      points: 5,
      order: 1,
      type: "TEXT" as const,
      validationMode: "AUTO" as const,
      prerequisiteStage: null,
      answers: ["P5"],
    },
    {
      code: "SAFE",
      title: "Xoay và mở két sắt",
      description:
        "Sử dụng manh mối trong Tập hồ sơ số 1 để xoay đúng mật mã và mở két sắt. (Đây là dữ liệu demo — Admin cần cập nhật mật mã và manh mối thật.)",
      points: 5,
      order: 2,
      type: "SAFE_DIAL" as const,
      validationMode: "AUTO" as const,
      prerequisiteStage: "CLUE1",
      answers: ["1234"],
      safeDialConfig: JSON.stringify({ ui: { digits: 4, minDigit: 0, maxDigit: 9 } }),
    },
    {
      code: "FIRE",
      title: "Xác định nguyên nhân vụ cháy",
      description:
        "[Placeholder — Ban tổ chức cần cập nhật nội dung câu hỏi thật trong Admin > Quản lý câu hỏi.]",
      points: 5,
      order: 3,
      type: "TEXT" as const,
      validationMode: "MANUAL" as const,
      prerequisiteStage: null,
      answers: [] as string[],
    },
    {
      code: "BODY",
      title: "Xác định danh tính xác chết ở P2",
      description:
        "[Placeholder — Ban tổ chức cần cập nhật nội dung câu hỏi thật trong Admin > Quản lý câu hỏi.]",
      points: 10,
      order: 4,
      type: "TEXT" as const,
      validationMode: "MANUAL" as const,
      prerequisiteStage: null,
      answers: [] as string[],
    },
    {
      code: "KILLER",
      title: "Xác định hung thủ đã giết Hương",
      description:
        "[Placeholder — Ban tổ chức cần cập nhật nội dung câu hỏi thật trong Admin > Quản lý câu hỏi.]",
      points: 10,
      order: 5,
      type: "TEXT" as const,
      validationMode: "MANUAL" as const,
      prerequisiteStage: null,
      answers: [] as string[],
    },
    {
      code: "MASTERMIND",
      title: "Xác định người chủ mưu vụ án",
      description:
        "[Placeholder — Ban tổ chức cần cập nhật nội dung câu hỏi thật trong Admin > Quản lý câu hỏi.]",
      points: 10,
      order: 6,
      type: "TEXT" as const,
      validationMode: "MANUAL" as const,
      prerequisiteStage: null,
      answers: [] as string[],
    },
    {
      code: "FINAL",
      title: "Câu hỏi số 7",
      description: "Ai là người đã đưa Hiền ra ngoài vào đêm vụ cháy xảy ra?",
      points: 10,
      order: 7,
      type: "TEXT" as const,
      validationMode: "MANUAL" as const,
      isFinalQuestion: true,
      prerequisiteStage: "SIX_TASKS",
      answers: [] as string[],
    },
  ];

  for (const q of questionsData) {
    const { answers, ...rest } = q;
    const question = await prisma.question.upsert({
      where: { code: q.code },
      update: {},
      create: { ...rest, isFinalQuestion: q.code === "FINAL" },
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
      hint: "Chứa manh mối để xoay két sắt. [Placeholder nội dung thật do BTC chuẩn bị bản in.]",
    },
  });
  await prisma.cluePackage.upsert({
    where: { code: "CLUE2" },
    update: {},
    create: {
      code: "CLUE2",
      name: "Tập hồ sơ số 2",
      hint: "Cung cấp thêm dữ kiện điều tra. [Placeholder nội dung thật do BTC chuẩn bị bản in.]",
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
  console.log("Mã đội demo:");
  for (const t of demoTeams) {
    console.log(`  - ${t.name}: ${t.joinCode}`);
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
