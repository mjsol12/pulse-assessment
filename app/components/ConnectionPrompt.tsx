"use client";

import { useEffect, useId, useRef } from "react";

// Reusable centered prompt for "someone wants to connect" and
// "someone wants to start video".
export default function ConnectionPrompt({
  title,
  subtitle,
  acceptLabel,
  declineLabel,
  onAccept,
  onDecline,
}: {
  title: string;
  subtitle?: string;
  acceptLabel: string;
  declineLabel: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const titleId = useId();
  const subtitleId = useId();
  const acceptRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    acceptRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onDecline();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [onDecline]);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        className="w-full max-w-sm rounded-[1.75rem] border border-white/10 bg-zinc-950/95 p-6 text-center text-zinc-100 shadow-2xl shadow-black/50"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-300/10 text-emerald-200">
          <span aria-hidden="true">•</span>
        </div>
        <h2 id={titleId} className="text-xl font-semibold tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p id={subtitleId} className="mt-2 text-sm leading-6 text-zinc-400">
            {subtitle}
          </p>
        )}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            onClick={onDecline}
            className="min-h-11 rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            {declineLabel}
          </button>
          <button
            ref={acceptRef}
            onClick={onAccept}
            className="min-h-11 rounded-full bg-emerald-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            {acceptLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
