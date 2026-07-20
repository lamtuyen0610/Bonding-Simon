import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Save, Eye } from "lucide-react";
import { api, ApiError } from "../../api/client";
import { useToast } from "../../contexts/ToastContext";
import { StoryChapter } from "../../types";

export default function StoryManagementPage() {
  const [chapters, setChapters] = useState<StoryChapter[] | null>(null);
  const [preview, setPreview] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    api.get<{ chapters: StoryChapter[] }>("/admin/story-chapters").then((r) => setChapters(r.chapters.sort((a, b) => a.order - b.order))).catch(() => {});
  }, []);

  useEffect(load, [load]);

  async function addChapter() {
    try {
      await api.post("/admin/story-chapters", {
        title: "Chương mới",
        content: "Nội dung chương...",
        order: (chapters?.length ?? 0) + 1,
      });
      toast("success", "Đã thêm chương mới.");
      load();
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Không thể thêm chương.");
    }
  }

  if (!chapters) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-turquoise" size={24} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold">Quản lý diễn biến vụ án</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setPreview((p) => !p)}>
            <Eye size={15} /> {preview ? "Đóng xem trước" : "Xem trước"}
          </button>
          <button className="btn-primary" onClick={addChapter}>
            <Plus size={15} /> Thêm chương
          </button>
        </div>
      </div>

      {preview ? (
        <div className="space-y-8">
          {chapters.map((c) => (
            <div key={c.id} className="card p-6">
              <p className="eyebrow mb-2">Chương {c.order}</p>
              <h2 className="text-xl font-display font-bold mb-3">{c.title}</h2>
              <p className="text-white/80 whitespace-pre-line leading-relaxed">{c.content}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {chapters.map((c) => (
            <ChapterEditor key={c.id} chapter={c} onSaved={load} />
          ))}
          {chapters.length === 0 && (
            <div className="card p-8 text-center text-white/50">Chưa có chương nào. Hãy thêm chương đầu tiên.</div>
          )}
        </div>
      )}
    </div>
  );
}

function ChapterEditor({ chapter, onSaved }: { chapter: StoryChapter; onSaved: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(chapter.title);
  const [content, setContent] = useState(chapter.content);
  const [presenterNote, setPresenterNote] = useState(chapter.presenterNote ?? "");
  const [order, setOrder] = useState(chapter.order);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/admin/story-chapters/${chapter.id}`, { title, content, presenterNote, order });
      toast("success", "Đã lưu chương.");
      onSaved();
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Không thể lưu chương.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Xóa chương "${chapter.title}"?`)) return;
    try {
      await api.delete(`/admin/story-chapters/${chapter.id}`);
      toast("success", "Đã xóa chương.");
      onSaved();
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Không thể xóa chương.");
    }
  }

  const isPlaceholder = chapter.content.includes("Placeholder");

  return (
    <div className={`card p-5 ${isPlaceholder ? "border-yellow-500/30" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">Thứ tự</span>
          <input type="number" className="input-field w-16 py-1.5" value={order} onChange={(e) => setOrder(Number(e.target.value))} />
        </div>
        {isPlaceholder && <span className="pill bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">Cần cập nhật</span>}
        <button onClick={remove} className="text-white/30 hover:text-red-400 transition">
          <Trash2 size={16} />
        </button>
      </div>
      <div className="space-y-3">
        <input className="input-field font-semibold" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tiêu đề chương" />
        <textarea className="input-field min-h-[140px] resize-none" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Nội dung chương" />
        <input
          className="input-field text-sm"
          value={presenterNote}
          onChange={(e) => setPresenterNote(e.target.value)}
          placeholder="Ghi chú cho người dẫn chương trình (tùy chọn)"
        />
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Lưu chương
        </button>
      </div>
    </div>
  );
}
