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
  validationMode: "AUTO" | "MANUAL";
  isActive: boolean;
  isFinalQuestion: boolean;
  acceptedAnswers: AcceptedAnswer[];
}

export default function QuestionsConfigPage() {
  const [questions, setQuestions] = useState<QuestionRow[] | null>(null);

  const load = useCallback(() => {
    api.get<{ questions: QuestionRow[] }>("/admin/questions").then((r) => setQuestions(r.questions.sort((a, b) => a.order - b.order))).catch(() => {});
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
        Chỉnh sửa nội dung, điểm số và đáp án chính thức. Các câu hỏi có nội dung [Placeholder] cần được cập nhật trước khi tổ chức game.
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
  const [title, setTitle] = useState(question.title);
  const [description, setDescription] = useState(question.description);
  const [points, setPoints] = useState(question.points);
  const [answers, setAnswers] = useState(question.acceptedAnswers.map((a) => a.answer).join(", "));
  const [saving, setSaving] = useState(false);

  const isPlaceholder = question.description.includes("Placeholder") || question.description.includes("demo");

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/admin/questions/${question.id}`, {
        title,
        description,
        points,
        acceptedAnswers:
          question.validationMode === "AUTO"
            ? answers.split(",").map((a) => a.trim()).filter(Boolean)
            : undefined,
      });
      toast("success", `Đã lưu câu hỏi "${title}".`);
      onSaved();
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Không thể lưu câu hỏi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`card p-5 ${isPlaceholder ? "border-yellow-500/30" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="pill bg-white/5 text-white/50 border border-white/10 font-mono">{question.code}</span>
        <div className="flex items-center gap-3">
          {isPlaceholder && <span className="pill bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">Cần cập nhật</span>}
          <span className="text-xs text-white/40">{question.validationMode === "AUTO" ? "Chấm tự động" : "Chấm thủ công"}</span>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-white/50 mb-1 block">Tiêu đề</label>
          <input className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1 block">Nội dung câu hỏi</label>
          <textarea className="input-field min-h-[80px] resize-none" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex gap-3">
          <div className="w-28">
            <label className="text-xs text-white/50 mb-1 block">Điểm</label>
            <input type="number" className="input-field" value={points} onChange={(e) => setPoints(Number(e.target.value))} />
          </div>
          {question.validationMode === "AUTO" && (
            <div className="flex-1">
              <label className="text-xs text-white/50 mb-1 block">Đáp án đúng (cách nhau bằng dấu phẩy)</label>
              <input className="input-field" value={answers} onChange={(e) => setAnswers(e.target.value)} />
            </div>
          )}
        </div>
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Lưu thay đổi
        </button>
      </div>
    </div>
  );
}
