"use client";

import { useState } from "react";

export default function EntryGate({
  onReady,
}: {
  onReady: (lat: number, lng: number) => void;
}) {
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const [error, setError] = useState<string>("");

  function enter() {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setError("Your browser doesn't support location access.");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => onReady(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        setStatus("error");
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission is required to place you on the map."
            : "Couldn't get your location. Please try again.",
        );
      },
      // High accuracy + maximumAge:0 forces a fresh fix (Wi-Fi/GPS scan)
      // instead of reusing the browser's cached IP-based location.
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#12372f_0%,#050711_42%,#02030a_100%)] p-4 text-zinc-100 sm:p-6">
      <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-zinc-950/75 p-6 text-center shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-300/10 text-2xl font-black text-emerald-200">
          P
        </div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200/80">
          Anonymous, temporary, nearby
        </p>
        <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl">
          Pulse
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-7 text-zinc-300">
          A living globe of anonymous strangers. Share your approximate location,
          tap a dot, and start a private peer-to-peer conversation.
        </p>

        <button
          onClick={enter}
          disabled={status === "locating"}
          aria-describedby={status === "error" ? "location-error" : "privacy-note"}
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-emerald-300 px-8 py-3 font-semibold text-zinc-950 shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-wait disabled:bg-zinc-600 disabled:text-zinc-300"
        >
          {status === "locating" ? "Locating..." : "Enter Pulse"}
        </button>

        {status === "error" && (
          <p
            id="location-error"
            role="alert"
            className="mx-auto mt-5 max-w-sm rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-200"
          >
            {error}
          </p>
        )}

        <p
          id="privacy-note"
          className="mx-auto mt-6 max-w-md text-sm leading-6 text-zinc-400"
        >
          No sign-up. Your dot is placed 1-3 km from your real location.
          Nothing is stored; closing the tab ends everything.
        </p>
      </div>
    </div>
  );
}
