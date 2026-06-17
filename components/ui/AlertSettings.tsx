"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  loadAlertPrefs,
  notificationPermission,
  notificationSupported,
  playIncomingChime,
  playMessageTone,
  primeAlertAudio,
  requestNotificationPermission,
  saveAlertPrefs,
  type AlertPrefs,
} from "@/lib/alerts";

function Toggle({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 text-left">
        <label htmlFor={id} className="text-sm font-medium text-zinc-100 light:text-slate-900">
          {label}
        </label>
        <p className="mt-0.5 text-xs leading-5 text-zinc-400 light:text-slate-500">
          {description}
        </p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 light:focus-visible:ring-emerald-500 light:focus-visible:ring-offset-white ${
          checked ? "bg-emerald-300 light:bg-emerald-500" : "bg-zinc-700 light:bg-slate-300"
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export function AlertSettings({
  onPrefsChange,
  onNotice,
}: {
  onPrefsChange: (prefs: AlertPrefs) => void;
  onNotice: (text: string) => void;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<AlertPrefs>(loadAlertPrefs);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onPrefsChange(prefs);
  }, [onPrefsChange, prefs]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function updatePrefs(patch: Partial<AlertPrefs>) {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      saveAlertPrefs(next);
      return next;
    });
  }

  async function handleMessageSoundToggle(enabled: boolean) {
    updatePrefs({ messageSound: enabled });
    if (enabled) {
      await primeAlertAudio();
      playMessageTone();
    }
  }

  async function handleSoundToggle(enabled: boolean) {
    updatePrefs({ sound: enabled });
    if (enabled) {
      await primeAlertAudio();
      playIncomingChime();
    }
  }

  async function handleDesktopToggle(enabled: boolean) {
    if (!enabled) {
      updatePrefs({ desktop: false });
      return;
    }

    if (!notificationSupported()) {
      onNotice("Desktop alerts aren't supported in this browser.");
      return;
    }

    const permission = notificationPermission();
    if (permission === "denied") {
      onNotice("Enable notifications in your browser settings.");
      return;
    }

    if (permission !== "granted") {
      const granted = await requestNotificationPermission();
      if (!granted) {
        onNotice("Notification permission was denied.");
        return;
      }
    }

    updatePrefs({ desktop: true });
    onNotice(
      "Desktop alerts enabled — you'll be notified when this tab is in the background.",
    );
  }

  const desktopSupported = notificationSupported();
  const desktopDenied = notificationPermission() === "denied";

  return (
    <div ref={panelRef} className="absolute right-4 top-4 z-10 ">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-zinc-950/80 px-3 py-2 text-xs font-medium text-zinc-200 shadow-lg backdrop-blur transition hover:border-white/20 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 light:border-slate-200 light:bg-white/85 light:text-slate-700 light:shadow-slate-200/70 light:hover:border-slate-300 light:hover:bg-white light:focus-visible:ring-emerald-500 light:focus-visible:ring-offset-white"
      >
        <svg
          className="h-4 w-4 text-emerald-300"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M11 5 6 9H3v6h3l5 4V5Z" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
        Alerts
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute right-0 top-full mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-zinc-950/95 p-4 text-zinc-100 shadow-2xl backdrop-blur-xl light:border-slate-200 light:bg-white/95 light:text-slate-900 light:shadow-slate-200/80"
        >
          <p className="text-sm font-semibold text-white light:text-slate-950">Alerts</p>
          <p className="mt-1 text-xs leading-5 text-zinc-400 light:text-slate-500">
            Sounds play in this tab. Desktop alerts appear when Pulse is open
            but in the background.
          </p>

          <div className="mt-4 space-y-4">
            <Toggle
              id={`${panelId}-sound`}
              label="Connection tone"
              description="Chime when someone wants to connect or call."
              checked={prefs.sound}
              onChange={handleSoundToggle}
            />
            <Toggle
              id={`${panelId}-message`}
              label="Message tone"
              description="Soft ping for each message you receive."
              checked={prefs.messageSound}
              onChange={handleMessageSoundToggle}
            />
            <Toggle
              id={`${panelId}-desktop`}
              label="Desktop notifications"
              description={
                desktopSupported
                  ? desktopDenied
                    ? "Blocked in browser settings."
                    : "Notify outside the tab when Pulse is in the background."
                  : "Not supported in this browser."
              }
              checked={prefs.desktop}
              disabled={!desktopSupported || desktopDenied}
              onChange={handleDesktopToggle}
            />
          </div>
        </div>
      )}
    </div>
  );
}
