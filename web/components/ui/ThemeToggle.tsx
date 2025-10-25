"use client";
import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "@/components/ui/Icons";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark"|"light">("dark");

  useEffect(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem("sf_theme")) || "dark";
    setTheme(saved === "light" ? "light" : "dark");
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("sf_theme", theme);
  }, [theme]);

  const onToggle = () => setTheme(t => t === "light" ? "dark" : "light");

  return (
    <button
      aria-label="Toggle theme"
      onClick={onToggle}
      className="relative w-14 h-7 rounded-full border border-white/10 bg-white/5 select-none"
    >
      {/* Knob */}
      <span
        className={`absolute top-0.5 ${theme==='light'?'left-0.5':'left-7'} w-6 h-6 rounded-full bg-[var(--brand)] grid place-items-center transition-all duration-200`}
      >
        {theme === 'light' ? (
          <IconSun size={14} className="text-white" />
        ) : (
          <IconMoon size={14} className="text-white" />
        )}
      </span>
    </button>
  );
}
