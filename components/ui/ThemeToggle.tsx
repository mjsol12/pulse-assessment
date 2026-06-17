"use client";

import { useTheme } from "./theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      aria-pressed={isLight}
      onClick={() => setTheme(isLight ? "dark" : "light")}
      className={[
        "flex min-h-10 min-w-10 items-center justify-center rounded-full border border-white/10 bg-zinc-950/80 p-2 text-zinc-200 shadow-lg backdrop-blur transition hover:border-white/20 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
        "light:border-slate-200 light:bg-white/85 light:text-slate-700 light:shadow-slate-200/70 light:hover:border-slate-300 light:hover:bg-white light:focus-visible:ring-emerald-500 light:focus-visible:ring-offset-white",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {isLight ? (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3v2" />
          <path d="M12 19v2" />
          <path d="m4.22 4.22 1.42 1.42" />
          <path d="m18.36 18.36 1.42 1.42" />
          <path d="M3 12h2" />
          <path d="M19 12h2" />
          <path d="m4.22 19.78 1.42-1.42" />
          <path d="m18.36 5.64 1.42-1.42" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      ) : (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20.99 11.16A8.5 8.5 0 1 1 12.84 3a6.5 6.5 0 0 0 8.15 8.16Z" />
        </svg>
      )}
    </button>
  );
}
