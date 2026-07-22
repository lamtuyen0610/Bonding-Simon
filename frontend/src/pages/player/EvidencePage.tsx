import type { ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { usePlayerState } from "../../hooks/usePlayerState";

function Polaroid({
  src,
  alt,
  rotate = 0,
  caption,
}: {
  src: string;
  alt: string;
  rotate?: number;
  caption?: string;
}) {
  return (
    <div
      className="relative bg-[#e9e4d8] p-2 pb-5 shadow-[3px_5px_0_rgba(0,0,0,0.5)] shrink-0"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <div className="absolute left-1/2 -top-2 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-purple shadow-[0_1px_3px_rgba(0,0,0,0.6)]" />
      <img src={src} alt={alt} className="w-full h-40 sm:h-48 object-cover grayscale-[10%] sepia-[8%]" />
      {caption && <p className="mt-1.5 text-center font-mono text-[10px] text-ink/60">{caption}</p>}
    </div>
  );
}

function StickyNote({ text, rotate = 0 }: { text: string; rotate?: number }) {
  return (
    <div
      className="bg-[#e6cf3a] text-ink px-4 py-3 font-mono text-sm shadow-[2px_3px_0_rgba(0,0,0,0.5)] max-w-[220px]"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {text}
    </div>
  );
}

function DocumentSheet({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="mx-auto max-w-sm bg-[#f4f1e8] p-2 shadow-[3px_5px_0_rgba(0,0,0,0.5)]">
      <img src={src} alt={alt} className="w-full h-auto" />
    </div>
  );
}

function ContactNote({ text }: { text: string }) {
  return (
    <div className="mt-4 border-2 border-purple bg-purple/10 px-4 py-3 text-center">
      <p className="font-mono font-bold uppercase tracking-wide text-purple-soft text-sm">{text}</p>
    </div>
  );
}

const CONTENT: Record<
  string,
  {
    label: string;
    intro: string;
    sections: { title: string; body: ReactNode }[];
  }
> = {
  clue1: {
    label: "Tập hồ sơ số 1",
    intro:
      "Cập nhật tình hình: Đã thu thập được bản trích xuất lời khai của cháu Nhi. Mọi thứ vẫn còn rối ren nhưng chúng ta đã tiến 1 bước gần hơn với sự thật.",
    sections: [
      {
        title: "Nhận tập hồ sơ số 1",
        body: (
          <div>
            <div className="flex justify-center py-4">
              <DocumentSheet src="/evidence/clue1-corridor.jpg" alt="Hành lang hiện trường — TRACE-KN-181002" />
            </div>
            <ContactNote text="Liên hệ với ban tổ chức để nhận tập hồ sơ bổ sung số 1" />
          </div>
        ),
      },
      {
        title: "Bản trích xuất lời khai (ghi âm)",
        body: (
          <div className="py-4">
            <DocumentSheet src="/evidence/clue1-transcript.jpg" alt="Bản trích xuất lời khai của Nhi" />
          </div>
        ),
      },
    ],
  },
  clue2: {
    label: "Tập hồ sơ số 2",
    intro:
      "Két sắt đã được mở! Cùng lúc đó, đội khám nghiệm pháp y đã gửi lại kết quả về 2 thi thể tìm thấy trong căn trọ. Đây là bước đột phá lớn trong quá trình điều tra.",
    sections: [
      {
        title: "Tang chứng trong két sắt",
        body: (
          <div>
            <div className="flex flex-wrap gap-5 justify-center items-start py-4">
              <Polaroid src="/evidence/clue2-clothes.jpg" alt="Vật dụng trong két sắt" rotate={-2} />
              <Polaroid src="/evidence/clue2-food1.jpg" alt="Vật chứng 1" rotate={2} />
              <Polaroid src="/evidence/clue2-food2.jpg" alt="Vật chứng 2" rotate={-3} />
              <Polaroid src="/evidence/clue2-food3.jpg" alt="Vật chứng 3" rotate={3} />
              <Polaroid src="/evidence/clue2-article.jpg" alt="Bài viết liên quan" rotate={1} />
              <Polaroid src="/evidence/clue2-newspaper.jpg" alt="Bài báo Đời sống & Pháp luật" rotate={-1} />
            </div>
            <ContactNote text="Liên hệ với ban tổ chức để nhận tập hồ sơ bổ sung số 2" />
          </div>
        ),
      },
      {
        title: "Kết quả khám nghiệm tử thi",
        body: (
          <div className="flex flex-wrap gap-5 justify-center items-start py-4">
            <Polaroid src="/evidence/clue2-report-a.jpg" alt="Báo cáo giám định pháp y 1" rotate={1} />
            <Polaroid src="/evidence/clue2-report-b.jpg" alt="Báo cáo giám định pháp y 2" rotate={-1} />
          </div>
        ),
      },
    ],
  },
};

export default function EvidencePage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { data, loading } = usePlayerState();

  const delivered = code === "clue1" ? data?.team.clue1Delivered : code === "clue2" ? data?.team.clue2Delivered : false;
  const content = code ? CONTENT[code] : undefined;

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-turquoise" size={28} />
      </div>
    );
  }

  if (!content || !delivered) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-6 text-center">
          <p className="mb-4 text-white/70">Đội chưa nhận được hồ sơ này.</p>
          <button className="btn-secondary" onClick={() => navigate("/dashboard")}>
            Về Bảng điều tra
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 z-10 backdrop-blur-md bg-ink/80 border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="text-white/60 hover:text-white transition">
            <ArrowLeft size={20} />
          </button>
          <span className="text-sm text-white/50">Bảng điều tra</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        <p className="text-white/85 leading-relaxed">{content.intro}</p>

        {content.sections.map((s) => (
          <div key={s.title}>
            <div className="border-t border-white/10 pt-6">
              <h2 className="case-stamp mb-4">{s.title}</h2>
              {s.body}
            </div>
          </div>
        ))}

        <button className="btn-primary w-full" onClick={() => navigate("/dashboard")}>
          Tiếp tục điều tra
        </button>
      </main>
    </div>
  );
}
