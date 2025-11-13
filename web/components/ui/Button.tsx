// components/ui/Button.tsx
import React, { forwardRef } from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline";
  size?: "sm" | "md";
  isLoading?: boolean;
};

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = "primary",
    size = "md",
    className = "",
    isLoading = false,
    type,
    disabled,
    children,
    ...props
  },
  ref
) {
  // Base shared styles
  const base =
    "inline-flex items-center justify-center rounded-md font-medium transition " +
    // make disabled buttons look/act disabled
    "disabled:opacity-50 disabled:pointer-events-none " +
    // better focus outline for keyboard nav
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";

  // Size styles
  const sizes =
    // Slightly taller small buttons for better vertical padding
    size === "sm" ? "h-9 px-3 text-sm" : "h-10 px-4 text-sm";

  // Variant styles
  const styles =
    variant === "primary"
      ? "bg-[var(--brand)] bg-[linear-gradient(135deg,rgba(168,111,255,1),rgba(122,60,255,1))] text-[var(--btn-on-brand)] shadow-[0_6px_20px_rgba(168,111,255,.25)] hover:brightness-105"
      : variant === "outline"
      ? "border border-[var(--border)] text-[var(--btn-fg)] hover:bg-[var(--btn-hover-bg)]"
      : "text-[var(--btn-fg)] hover:bg-[var(--btn-hover-bg)]";

  // Final disabled state: either explicitly disabled or loading locks it
  const finalDisabled = disabled || isLoading;

  return (
    <button
      ref={ref}
      // default type is "button" to avoid accidental form submit
      type={type ?? "button"}
      className={`${base} ${sizes} ${styles} ${className}`}
      disabled={finalDisabled}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? "Loading..." : children}
    </button>
  );
});

export default Button;
