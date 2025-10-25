"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { IconCheck, IconX } from "@/components/ui/Icons";

type Toast = { id: string; text: string; variant?: "success" | "error" | "info" };
type Ctx = { toast: (text: string, variant?: Toast["variant"]) => void };

const ToastCtx = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const toast = useCallback((text: string, variant: Toast["variant"] = "info") => {
    const id = Math.random().toString(36).slice(2);
    setItems((xs) => [...xs, { id, text, variant }]);
    setTimeout(() => setItems((xs) => xs.filter((t) => t.id !== id)), 2500);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      {/* viewport */}
      <div className="fixed bottom-5 right-5 z-50 space-y-3">
        {items.map((t) => {
          const common = "min-w-60 max-w-96 px-3 py-2.5 rounded-md text-sm border shadow-xl backdrop-blur-sm animate-toast-in";
          const cls = t.variant === 'success'
            ? "bg-green-500 text-white border-green-400/60"
            : t.variant === 'error'
              ? "bg-red-500 text-white border-red-400/60"
              : "bg-[var(--panel-2)] text-[var(--text)] border-white/20";
          return (
            <div key={t.id} role="status" aria-live="polite" className={`${common} ${cls}`}>
              <div className="flex items-center gap-2">
                {t.variant === 'success' ? <IconCheck size={16} /> : t.variant === 'error' ? <IconX size={16} /> : null}
                <div className="flex-1">{t.text}</div>
                <button aria-label="Dismiss" className="opacity-80 hover:opacity-100" onClick={() => setItems(xs=>xs.filter(x=>x.id!==t.id))}><IconX size={16} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx.toast;
}
