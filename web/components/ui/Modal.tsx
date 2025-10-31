"use client";
import { useEffect } from "react";

export default function Modal({
  open, onClose, title, children, footer, size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg";
}) {
  useEffect(() => {
    function esc(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    if (open) document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className={`w-full ${size === 'lg' ? 'max-w-3xl' : 'max-w-md'} rounded-[var(--radius)] bg-[var(--panel-2)] border border-white/10 shadow-2xl animate-modal-in`}>
          {title && <div className="p-4 border-b border-white/10 font-semibold">{title}</div>}
          <div className="p-4">{children}</div>
          {footer && <div className="p-3 border-t border-white/10 flex justify-end gap-2">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
