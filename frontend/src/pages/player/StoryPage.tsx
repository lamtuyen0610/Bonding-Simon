import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Maximize2, Minimize2, Loader2 } from "lucide-react";
import { api, ApiError } from "../../api/client";
import { StoryChapter } from "../../types";

export default function StoryPage() {
  const navigate = useNavigate();
  const [chapters, setChapters] = useState<StoryChapter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    api
      .get<{ chapters: StoryChapter[] }>("/player/story")
      .then((res) => setChapters(res.chapters.sort((a, b) => a.order - b.order)))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Diễn biến vụ án chưa được công bố."));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-6 text-center">
          <p className="mb-4 text-white/70">{error}</p>
          <button className="btn-secondary" onClick={() => navigate("/dashboard")}>
            Về Bảng điều tra
          </button>
        </div>
      </div>
    );
  }

  if (!chapters) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-turquoise" size={28} />
      </div>
    );
  }

  const chapter = chapters[index];
  const progressPct = ((index + 1) / chapters.length) * 100;

  return (
    <div className={`min-h-screen ${fullscreen ? "bg-ink fixed inset-0 z-50 overflow-y-auto" : ""}`}>
      {!fullscreen && (
        <header className="sticky top-0 z-10 backdrop-blur-md bg-ink/80 border-b border-white/10">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <button onClick={() => navigate("/dashboard")} className="text-white/60 hover:text-white transition flex items-center gap-2">
              <ArrowLeft size={20} /> <span className="text-sm">Bảng điều tra</span>
            </button>
            <button onClick={() => setFullscreen(true)} className="text-white/40 hover:text-white transition">
              <Maximize2 size={18} />
            </button>
          </div>
        </header>
      )}

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        {fullscreen && (
          <button
            onClick={() => setFullscreen(false)}
            className="fixed top-4 right-4 text-white/40 hover:text-white transition z-50"
          >
            <Minimize2 size={20} />
          </button>
        )}

        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple to-turquoise transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <p className="eyebrow mb-3 text-center">
          Chương {index + 1} / {chapters.length}
        </p>
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-center mb-10">{chapter.title}</h1>

        {chapter.imageUrl && (
          <img src={chapter.imageUrl} alt={chapter.title} className="rounded-2xl mb-8 w-full object-cover" />
        )}

        <div className="prose prose-invert max-w-none text-lg leading-loose text-white/85 whitespace-pre-line">
          {chapter.content}
        </div>

        <div className="flex justify-between items-center mt-12">
          <button
            className="btn-secondary"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            <ArrowLeft size={16} /> Trước
          </button>
          {index < chapters.length - 1 ? (
            <button className="btn-primary" onClick={() => setIndex((i) => i + 1)}>
              Tiếp tục <ArrowRight size={16} />
            </button>
          ) : (
            <button className="btn-primary" onClick={() => navigate("/leaderboard")}>
              Xem bảng xếp hạng <ArrowRight size={16} />
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
