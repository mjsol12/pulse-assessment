"use client";

import { useEffect, useId, useRef } from "react";
import { VideoIcon } from "@/components/ui/icons";

// Reusable centered prompt for "someone wants to connect" and
// "someone wants to start video".
export default function ConnectionPrompt({
  variant = "connect",
  title,
  subtitle,
  acceptLabel,
  declineLabel,
  onAccept,
  onDecline,
}: {
  variant?: "connect" | "video";
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
    <div className="connection-prompt-backdrop absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        className={`connection-prompt-dialog w-full max-w-sm rounded-[1.75rem] border bg-zinc-950/95 p-6 text-center text-zinc-100 shadow-2xl shadow-black/50 ${
          variant === "connect"
            ? "connection-prompt-dialog--connect border-emerald-300/20"
            : "border-white/10"
        }`}
      >
        {variant === "connect" ? (
          <div
            className="connection-prompt-indicator connection-prompt-enter connection-prompt-enter--1 mx-auto mb-5"
            aria-hidden="true"
          >
            <span className="connection-prompt-indicator__ring" />
            <span className="connection-prompt-indicator__ring connection-prompt-indicator__ring--delay-1" />
            <span className="connection-prompt-indicator__ring connection-prompt-indicator__ring--delay-2" />
            <span className="connection-prompt-indicator__core" />
          </div>
        ) : (
          <div className="connection-prompt-video-icon mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-300/10 text-emerald-200 ring-1 ring-emerald-300/20">
            <VideoIcon className="h-6 w-6" />
          </div>
        )}
        {variant === "connect" && (
          <p className="connection-prompt-enter connection-prompt-enter--2 mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
            Incoming request
          </p>
        )}
        <h2
          id={titleId}
          className={`connection-prompt-enter text-xl font-semibold tracking-tight ${
            variant === "connect"
              ? "connection-prompt-enter--3"
              : "connection-prompt-enter--2"
          }`}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            id={subtitleId}
            className={`connection-prompt-enter mt-2 text-sm leading-6 text-zinc-400 ${
              variant === "connect"
                ? "connection-prompt-enter--4"
                : "connection-prompt-enter--3"
            }`}
          >
            {subtitle}
          </p>
        )}
        <div
          className={`connection-prompt-enter mt-6 grid gap-3 sm:grid-cols-2 ${
            variant === "connect"
              ? "connection-prompt-enter--5"
              : "connection-prompt-enter--4"
          }`}
        >
          <button
            onClick={onDecline}
            className="min-h-11 rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            {declineLabel}
          </button>
          <button
            ref={acceptRef}
            onClick={onAccept}
            className="connection-prompt-accept min-h-11 rounded-full bg-emerald-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            {acceptLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
