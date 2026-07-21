import { useCallback, useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { api, ApiError } from "../../api/client";
import { useToast } from "../../contexts/ToastContext";

interface AcceptedAnswer {
  answer: string;
}
interface QuestionRow {
  id: string;
  code: string;
  title: string;
  description: string;
  points: number;
  order: number;
  type: "TEXT" | "SAFE_DIAL" | "MULTIPLE_CHOICE";
  validationMode: "AUTO" | "MANUAL";
  revealMode: "IMMEDIATE" | "DEFERRED";
  options: string | null;
  successMessage: string | null;
  isActive: boolean;
  isFinalQuestion: boolean;
  acceptedAnswers: AcceptedAnswer[];
}

export default function QuestionsConfigPage() {
  const [questions, setQuestions] = useState<QuestionRow[] | null>(null);

  const load = useCallback(() => {
    api
      .get<{ questions: QuestionRow[] }>("/admin/questions")
      .then((r) => setQuestions(r.questions.sort((a, b) => a.order - b.order)))
      .catch(() => {});
  }, []);

  useEffect(load, []);

  if (!questions) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-turquoise" size={24} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-display font-bold mb-2">Quản lý câu hỏi</h1>
      <p className="text-sm text-white/50 mb-6">
        Chỉnh sửa nội dung, điểm số, lựa chọn và đáp án chính thức. Với câu trắc nghiệm, đáp án đúng phải
        khớp CHÍNH XÁC với 1 trong các lựa chọn bên dưới.
      </p>
      <div className="space-y-4">
        {questions.map((q) => (
          <QuestionEditor key={q.id} question={q} onSaved={load} />
        ))}
      </div>
    </div>
  );
}

function QuestionEditor({ question, onSaved }: { question: QuestionRow; onSaved: () => void }) {
  const toast = useToast();
  const [description, setDescription] = useState(question.description);
  const [points, setPoints] = useState(question.points);
  const [type, setType] = useState(question.type);
  const [revealMode, setRevealMode] = useState(question.revealMode);
  const [optionsText, setOptionsText] = useState(
    question.options ? (JSON.parse(question.options) as string[]).join("\n") : ""
  );
  const [successMessage, setSuccessMessage] = useState(question.successMessage ?? "");
  const [answers, setAnswers] = useState(question.acceptedAnswers.map((a) => a.answer).join(", "));
  const [saving, setSaving] = useState(false);

  const isPlaceholder = question.description.includes("Placeholder") || question.description.includes("[");

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/admin/questions/${question.id}`, {
        // Không còn tiêu đề riêng — dùng luôn nội dung câu hỏi làm tên hiển thị
        // (kể cả ở các màn hình nội bộ của Admin như Tiến độ trực tiếp, Hàng đợi chấm...).
        title: description,
        description,
        points,
        type,
        revealMode,
        successMessage: successMessage || undefined,
        options:
          type === "MULTIPLE_CHOICE"
            ? optionsText.split("\n").map((o) => o.trim()).filter(Boolean)
            : undefined,
        acceptedAnswers:
          question.validationMode === "AUTO"
            ? answers.split(",").map((a) => a.trim()).filter(Boolean)
            : undefined,
      });
      toast("success", "Đã lưu câu hỏi.");
      onSaved();
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Không thể lưu câu hỏi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`card p-5 ${isPlaceholder ? "border-yellow-500/30" : ""}`}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span className="pill bg-white/5 text-white/50 border border-white/10 font-mono">{question.code}</span>
        <div className="flex items-center gap-2 flex-wrap">
          {isPlaceholder && <span className="pill bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">Cần cập nhật</span>}
          <span className="text-xs text-white/40">{question.validationMode === "AUTO" ? "Chấm tự động" : "Chấm thủ công"}</span>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-white/50 mb-1 block">Nội dung câu hỏi</label>
          <textarea className="input-field min-h-[80px] resize-none" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="w-28">
            <label className="text-xs text-white/50 mb-1 block">Điểm</label>
            <input type="number" className="input-field" value={points} onChange={(e) => setPoints(Number(e.target.value))} />
          </div>
          {!question.isFinalQuestion && (
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs text-white/50 mb-1 block">Dạng câu hỏi</label>
              <select
                className="input-field"
                value={type}
                onChange={(e) => setType(e.target.value as QuestionRow["type"])}
              >
                <option value="TEXT">Nhập chữ tự do</option>
                <option value="MULTIPLE_CHOICE">Trắc nghiệm (chọn 1)</option>
                <option value="SAFE_DIAL">Két sắt (xoay số)</option>
              </select>
            </div>
          )}
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs text-white/50 mb-1 block">Khi nào tiết lộ đúng/sai</label>
            <select
              className="input-field"
              value={revealMode}
              onChange={(e) => setRevealMode(e.target.value as QuestionRow["revealMode"])}
            >
              <option value="IMMEDIATE">Ngay sau khi gửi đáp án</option>
              <option value="DEFERRED">Chỉ khi đội bấm "Kết thúc vụ án"</option>
            </select>
          </div>
        </div>

        {type === "MULTIPLE_CHOICE" && (
          <div>
            <label className="text-xs text-white/50 mb-1 block">Các lựa chọn (mỗi dòng 1 lựa chọn)</label>
            <textarea
              className="input-field min-h-[120px] resize-none font-mono text-sm"
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder={"Lựa chọn 1\nLựa chọn 2\nLựa chọn 3"}
            />
          </div>
        )}

        {question.validationMode === "AUTO" && (
          <div>
            <label className="text-xs text-white/50 mb-1 block">
              Đáp án đúng {type === "MULTIPLE_CHOICE" ? "(phải khớp chính xác 1 lựa chọn ở trên)" : "(cách nhau bằng dấu phẩy nếu có nhiều đáp án chấp nhận được)"}
            </label>
            <input className="input-field" value={answers} onChange={(e) => setAnswers(e.target.value)} />
          </div>
        )}

        {revealMode === "IMMEDIATE" && (
          <div>
            <label className="text-xs text-white/50 mb-1 block">
              Thông báo hiển thị khi trả lời đúng (tùy chọn, để trống dùng thông báo mặc định)
            </label>
            <textarea
              className="input-field min-h-[70px] resize-none"
              value={successMessage}
              onChange={(e) => setSuccessMessage(e.target.value)}
            />
          </div>
        )}

        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Lưu thay đổi
        </button>
      </div>
    </div>
  );
}
