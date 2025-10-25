// components/ui/Button.tsx
import React from "react";
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline";
  size?: "sm" | "md";
};
export default function Button({ variant="primary", size="md", className="", ...props }: Props) {
  const base = "inline-flex items-center justify-center rounded-md font-medium focus:outline-none transition";
  const sizes = size==="sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm";
  const styles =
    variant==="primary"
      ? "bg-[var(--brand)] bg-[linear-gradient(135deg,rgba(168,111,255,1),rgba(122,60,255,1))] text-[var(--btn-on-brand)] shadow-[0_6px_20px_rgba(168,111,255,.25)] hover:brightness-105 focus:ring-[var(--ring)]"
      : variant==="outline"
      ? "border border-[var(--border)] text-[var(--btn-fg)] hover:bg-[var(--btn-hover-bg)]"
      : "text-[var(--btn-fg)] hover:bg-[var(--btn-hover-bg)]";
  return <button {...props} className={`${base} ${sizes} ${styles} ${className}`} />;
}
