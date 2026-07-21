import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Loader2, ShieldAlert, PartyPopper } from "lucide-react";
import { usePlayerState } from "../../hooks/usePlayerState";
import { api, ApiError } from "../../api/client";
import { useToast } from "../../contexts/ToastContext";
import StatusBadge from "../../components/StatusBadge";
import SafeDial from "../../components/SafeDial";
import MultipleChoice from "../../components/MultipleChoice";

// Ảnh hồ sơ/hiện trường gắn theo từng câu hỏi (theo mã code), dùng làm lớp nền mờ phía sau
// nội dung câu hỏi và hiện trong popup khi trả lời đúng — tạo cảm giác đang lật hồ sơ vật chứng thật.
const EVIDENCE_IMAGES: Record<string, string> = {
  SAFE: "/evidence/safe-p2.jpg",
};

// Câu hỏi nào tương ứng dẫn tới trang hồ sơ vật chứng đầy đủ nào sau khi trả lời đúng.
const EVIDENCE_PAGE_BY_CODE: Record<string, string> = {
  TOY: "clue1",
  SAFE: "clue2",
};

export default function QuestionDetailPage() {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const { data, loading, refresh } = usePlayerState();
  const toast = useToast();

  const question = data?.questions.find((q) => q.id === questionId);
  const evidenceImage = question ? EVIDENCE_IMAGES[question.code] : undefined;

  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [successModal, setSuccessModal] = useState<string | null>(null);

  useEffect(() => {
    if (question) {
      setAnswer(question.draftAnswer ?? question.lastAnswer ?? "");
    }
  }, [question?.id]);

  // Lưu nháp tự động khi người dùng gõ (chỉ áp dụng cho câu dạng nhập chữ tự do).
  useEffect(() => {
    if (!question || question.type !== "TEXT") return;
    if (answer === (question.draftAnswer ?? question.lastAnswer ?? "")) return;
    if (["CORRECT", "PENDING_REVIEW", "ANSWERED"].includes(question.status)) return;
    const timer = setTimeout(async () => {
      if (!answer.trim()) return;
      setDraftSaving(true);
      try {
        await api.post("/player/answers/draft", { questionId: question.id, answer });
      } catch {
        // Lưu nháp thất bại thầm lặng - không làm gián đoạn trải nghiệm gõ.
      } finally {
        setDraftSaving(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [answer, question]);

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-turquoise" size={28} />
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-6 text-center">
          <p className="mb-4 text-white/70">Không tìm thấy câu hỏi này, hoặc câu hỏi đang bị khóa.</p>
          <button className="btn-secondary" onClick={() => navigate("/dashboard")}>
            Về Bảng điều tra
          </button>
        </div>
      </div>
    );
  }

  const canSubmit = !["CORRECT", "PENDING_REVIEW"].includes(question.status);

  async function doSubmit(finalAnswer: string) {
    if (!question) return;
    setSubmitting(true);
    try {
      const res = await api.post<{
        submission: { status: string; successMessage?: string | null };
      }>("/player/answers/submit", {
        questionId: question.id,
        answer: finalAnswer,
      });
      if (res.submission.status === "CORRECT") {
        const evidenceCode = EVIDENCE_PAGE_BY_CODE[question.code];
        if (evidenceCode) {
          await refresh();
          navigate(`/evidence/${evidenceCode}`);
          return;
        }
        if (res.submission.successMessage) {
          setSuccessModal(res.submission.successMessage);
        } else {
          toast("success", "Chính xác! Điểm đã được cộng.");
        }
      } else if (res.submission.status === "INCORRECT") {
        toast("error", "Đáp án chưa đúng, thử lại nhé.");
      } else if (res.submission.status === "ANSWERED") {
        toast("info", "Đã ghi nhận đáp án. Kết quả sẽ được tiết lộ sau khi kết thúc vụ án.");
      } else {
        toast("info", "Đã gửi đáp án. Đang chờ Ban tổ chức kiểm tra.");
      }
      await refresh();
      if (question.type !== "SAFE_DIAL" && !res.submission.successMessage) {
        navigate("/dashboard");
      }
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Không thể gửi đáp án. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-10 backdrop-blur-md bg-ink/80 border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="text-white/60 hover:text-white transition">
            <ArrowLeft size={20} />
          </button>
          <span className="text-sm text-white/50">Bảng điều tra</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        <div className="card relative overflow-hidden p-6">
          {evidenceImage && (
            <>
              <div
                className="absolute inset-0 bg-cover bg-center opacity-25 grayscale-[30%]"
                style={{ backgroundImage: `url(${evidenceImage})` }}
                aria-hidden="true"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-panel/60 via-panel/85 to-panel" aria-hidden="true" />
            </>
          )}
          <div className="relative">
            <div className="mb-3">
              <h1 className="text-xl sm:text-2xl font-display font-bold leading-snug">
                {question.description || question.title}
              </h1>
            </div>
            <StatusBadge status={question.status} />

            {question.adminNote && (
              <div className="mt-4 border border-purple/30 bg-purple/10 px-4 py-3 text-sm text-purple-soft flex gap-2">
                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                <span>Ghi chú từ Ban tổ chức: {question.adminNote}</span>
              </div>
            )}
          </div>
        </div>

        {question.type === "SAFE_DIAL" && question.safeDialConfig ? (
          <SafeDial
            digits={question.safeDialConfig.digits}
            minDigit={question.safeDialConfig.minDigit}
            maxDigit={question.safeDialConfig.maxDigit}
            opened={question.status === "CORRECT"}
            disabled={submitting || !canSubmit}
            onSubmit={(code) => doSubmit(code)}
          />
        ) : question.type === "MULTIPLE_CHOICE" && question.options ? (
          <div className="card p-6 space-y-5">
            <MultipleChoice
              options={question.options}
              value={answer || null}
              onChange={setAnswer}
              disabled={!canSubmit}
            />
            {canSubmit && (
              <button
                className="btn-primary w-full"
                disabled={!answer || submitting}
                onClick={() => doSubmit(answer)}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Gửi đáp án
              </button>
            )}
          </div>
        ) : (
          <div className="card p-6 space-y-4">
            <label className="text-sm text-white/60">Đáp án của đội</label>
            <textarea
              className="input-field min-h-[120px] resize-none"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={!canSubmit}
              placeholder="Nhập đáp án của đội tại đây..."
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/30 h-4">{draftSaving ? "Đang lưu nháp..." : ""}</span>
              <button
                className="btn-primary"
                disabled={!canSubmit || !answer.trim() || submitting}
                onClick={() => doSubmit(answer)}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Gửi đáp án
              </button>
            </div>
          </div>
        )}
      </main>

      {successModal && (
        <SuccessModal
          message={successModal}
          image={evidenceImage}
          onClose={() => {
            setSuccessModal(null);
            navigate("/dashboard");
          }}
        />
      )}
    </div>
  );
}

function SuccessModal({ message, image, onClose }: { message: string; image?: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="card w-full max-w-md border-turquoise/40 p-6">
        <div className="flex items-center gap-2 mb-4 text-turquoise">
          <PartyPopper size={20} />
          <h3 className="font-display font-bold text-lg font-mono uppercase tracking-widest">Chính xác</h3>
        </div>

        {image && (
          <div className="mb-5 flex justify-center">
            {/* Khung "polaroid" mô phỏng tấm ảnh vật chứng vừa được ghim vào bảng hồ sơ */}
            <div className="relative -rotate-2 bg-[#e9e4d8] p-2 pb-6 shadow-[3px_5px_0_rgba(0,0,0,0.5)]">
              <div className="absolute left-1/2 -top-2 h-4 w-4 -translate-x-1/2 rounded-full bg-purple shadow-[0_1px_3px_rgba(0,0,0,0.6)]" />
              <img src={image} alt="Vật chứng" className="h-40 w-52 object-cover grayscale-[15%] sepia-[10%]" />
            </div>
          </div>
        )}

        <p className="text-white/85 leading-relaxed mb-6 whitespace-pre-line">{message}</p>
        <button className="btn-primary w-full" onClick={onClose}>
          Tiếp tục điều tra
        </button>
      </div>
    </div>
  );
}
