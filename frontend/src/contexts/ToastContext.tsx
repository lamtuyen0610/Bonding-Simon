import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { CheckCircle2, XCircle, Info } from "lucide-react";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<{ push: (kind: ToastKind, message: string) => void } | null>(null);

let idCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++idCounter;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`card flex items-start gap-3 px-4 py-3 text-sm animate-[fadeIn_0.2s_ease-out] ${
              t.kind === "success"
                ? "border-turquoise/40"
                : t.kind === "error"
                ? "border-red-500/40"
                : "border-purple/40"
            }`}
          >
            {t.kind === "success" && <CheckCircle2 size={18} className="text-turquoise shrink-0 mt-0.5" />}
            {t.kind === "error" && <XCircle size={18} className="text-red-400 shrink-0 mt-0.5" />}
            {t.kind === "info" && <Info size={18} className="text-purple-soft shrink-0 mt-0.5" />}
            <span className="text-white/90">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast phải được dùng bên trong ToastProvider");
  return ctx.push;
}
