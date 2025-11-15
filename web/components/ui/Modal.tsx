"use client";
import { useEffect, useRef } from "react";

export default function Modal({
  open, onClose, title, children, footer, size = "md", scroll = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg" | "xl";
  scroll?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastActiveRef = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);

  // keep latest onClose without retriggering the mount effect
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    function esc(e: KeyboardEvent) { if (e.key === "Escape") onCloseRef.current?.(); }
    if (open) {
      document.addEventListener("keydown", esc);
      // lock body scroll
      const prevBodyOverflow = document.body.style.overflow;
      const prevHtmlOverflow = (document.documentElement as HTMLElement).style.overflow;
      document.body.style.overflow = "hidden";
      (document.documentElement as HTMLElement).style.overflow = "hidden";
      // remember focus and focus first focusable
      lastActiveRef.current = document.activeElement;
      const c = containerRef.current;
      if (c) {
        const focusables = c.querySelectorAll<HTMLElement>(
          'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        (focusables[0] || c).focus();
      }
      return () => {
        document.removeEventListener("keydown", esc);
        document.body.style.overflow = prevBodyOverflow;
        (document.documentElement as HTMLElement).style.overflow = prevHtmlOverflow;
        // restore focus
        const last = lastActiveRef.current as HTMLElement | null;
        if (last && typeof last.focus === 'function') {
          try { last.focus(); } catch {}
        }
      };
    }
  }, [open]);

  // Focus trap
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const c = containerRef.current; if (!c) return;
      const nodes = Array.from(c.querySelectorAll<HTMLElement>('a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !c.contains(active)) { last.focus(); e.preventDefault(); }
      } else {
        if (active === last) { first.focus(); e.preventDefault(); }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const titleId = title ? 'modal-title-' + Math.random().toString(36).slice(2) : undefined;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="absolute inset-0 flex items-center justify-center p-4 md:p-6 overflow-hidden"
        onMouseDown={(e) => {
          // Close when clicking anywhere outside the modal container
          const c = containerRef.current;
          if (c && !c.contains(e.target as Node)) {
            e.stopPropagation();
            onCloseRef.current?.();
          }
        }}
      >
        <div
          ref={containerRef}
          className={`w-full ${size === 'xl' ? 'max-w-5xl' : size === 'lg' ? 'max-w-3xl' : 'max-w-md'} my-6 md:my-10 max-h-[85vh] flex flex-col overflow-hidden rounded-[var(--radius)] bg-[var(--panel-2)] border border-white/10 shadow-2xl animate-modal-in`}
        >
          {title && (
            <div
              id={titleId}
              className="sticky top-0 z-10 p-4 border-b border-white/10 font-semibold bg-[var(--panel-2)]/95 backdrop-blur"
            >
              {title}
            </div>
          )}
          <div className={`p-4 ${scroll ? "overflow-auto" : ""}`}>{children}</div>
          {footer && (
            <div className="sticky bottom-0 z-10 p-3 border-t border-white/10 bg-[var(--panel-2)]/95 backdrop-blur flex justify-end gap-2">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
