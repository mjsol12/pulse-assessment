"use client";

import { useState } from "react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

type MeshNode = {
  id: string;
  x: number;
  y: number;
  kind: "human" | "hidden" | "shield";
  delay: number;
};

type MeshLink = {
  from: string;
  to: string;
  reverse?: boolean;
  delay: number;
};

const MESH_NODES: MeshNode[] = [
  { id: "h1", x: 60, y: 100, kind: "human", delay: 0 },
  { id: "shield", x: 160, y: 100, kind: "shield", delay: 0.4 },
  { id: "h2", x: 260, y: 100, kind: "human", delay: 0.2 },
];

const MESH_LINKS: MeshLink[] = [
  { from: "h1", to: "shield", delay: 0 },
  { from: "shield", to: "h2", delay: 0.3, reverse: true },
];

const nodeById = Object.fromEntries(MESH_NODES.map((node) => [node.id, node]));

function meshPath(from: MeshNode, to: MeshNode) {
  const bend = (to.x - from.x) * 0.45;
  return `M ${from.x} ${from.y} C ${from.x + bend} ${from.y}, ${to.x - bend} ${to.y}, ${to.x} ${to.y}`;
}

function ChatBubbleIcon({
  x,
  y,
  scale = 1,
  className,
}: {
  x: number;
  y: number;
  scale?: number;
  className?: string;
}) {
  return (
    <g
      className={className}
      transform={`translate(${x} ${y}) scale(${scale})`}
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M2 1h8a1.5 1.5 0 0 1 1.5 1.5v3.5A1.5 1.5 0 0 1 10 7.5H6.5L4 9.5V7.5H2A1.5 1.5 0 0 1 .5 6V2.5A1.5 1.5 0 0 1 2 1Z"
        fill="rgba(52, 211, 153, 0.22)"
      />
      <line x1="3" y1="3.5" x2="9" y2="3.5" opacity="0.85" />
      <line x1="3" y1="5.5" x2="7" y2="5.5" opacity="0.65" />
    </g>
  );
}

function NeuralMesh() {
  return (
    <div
      className="relative mx-auto mb-6 flex h-20 w-full max-w-sm items-center justify-center overflow-hidden rounded-2xl px-4"
      aria-hidden="true"
    >
      <div className="pulse-neural-orbit absolute inset-4 rounded-full bg-emerald-400/10 blur-2xl light:bg-emerald-300/30" />
      <svg
        viewBox="30 70 260 60"
        className="relative h-14 w-full text-emerald-200/90 light:text-emerald-600"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {MESH_LINKS.map((link) => {
          const from = nodeById[link.from];
          const to = nodeById[link.to];
          const d = meshPath(from, to);
          const duration = 2.4 + (link.delay % 0.8);
          const fromHuman = from.kind === "human";
          const toHuman = to.kind === "human";

          return (
            <g key={`${link.from}-${link.to}`}>
              <path
                d={d}
                className="pulse-neural-link"
                style={{ animationDelay: `${link.delay}s` }}
                opacity="0.38"
              />
              <g className="pulse-neural-packet" opacity="0.95">
                <animateMotion
                  dur={`${duration}s`}
                  repeatCount="indefinite"
                  begin={`${link.delay}s`}
                  path={d}
                  keyPoints={link.reverse ? "1;0" : "0;1"}
                  keyTimes="0;1"
                  calcMode="linear"
                />
                {fromHuman || toHuman ? (
                  <ChatBubbleIcon x={-5} y={-5} scale={0.55} />
                ) : (
                  <circle r="2.25" fill="#6ee7b7" stroke="none" />
                )}
              </g>
            </g>
          );
        })}

        {MESH_NODES.map((node) => {
          if (node.kind === "shield") {
            return (
              <g
                key={node.id}
                className="pulse-neural-node"
                style={{ animationDelay: `${node.delay}s` }}
                transform={`translate(${node.x - 12} ${node.y - 14})`}
              >
                <circle
                  cx="12"
                  cy="14"
                  r="18"
                  fill="rgba(52, 211, 153, 0.08)"
                  stroke="rgba(110, 231, 183, 0.45)"
                  strokeWidth="1.25"
                />
                <path
                  d="M12 5 6 7v5.5c0 4.5 3.6 8.2 6 9.5 2.4-1.3 6-5 6-9.5V7l-6-2Z"
                  fill="rgba(52, 211, 153, 0.15)"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </g>
            );
          }

          if (node.kind === "human") {
            return (
              <g
                key={node.id}
                className="pulse-neural-node"
                style={{ animationDelay: `${node.delay}s` }}
                transform={`translate(${node.x - 8} ${node.y - 10})`}
              >
                <ChatBubbleIcon
                  x={2}
                  y={-9}
                  scale={0.78}
                  className="pulse-neural-chat"
                />
                <circle
                  cx="8"
                  cy="8"
                  r="11"
                  fill="rgba(52, 211, 153, 0.06)"
                  stroke="rgba(110, 231, 183, 0.35)"
                  strokeWidth="1.25"
                />
                <circle cx="8" cy="6.5" r="2.5" />
                <path d="M3.5 16.5c0-2.8 2-5 4.5-5s4.5 2.2 4.5 5" />
              </g>
            );
          }

          return (
            <g
              key={node.id}
              className="pulse-neural-node"
              style={{ animationDelay: `${node.delay}s` }}
            >
              <circle
                cx={node.x}
                cy={node.y}
                r="4.5"
                fill="rgba(52, 211, 153, 0.2)"
                stroke="currentColor"
              />
              <circle
                cx={node.x}
                cy={node.y}
                r="1.5"
                fill="currentColor"
                stroke="none"
                opacity="0.85"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

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
    <div className="relative flex min-h-full flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#12372f_0%,#050711_42%,#02030a_100%)] p-4 text-zinc-100 light:bg-[radial-gradient(circle_at_top,#d1fae5_0%,#f8fafc_44%,#e2e8f0_100%)] light:text-slate-950 sm:p-6">
      <ThemeToggle className="absolute right-4 top-4 z-10" />
      <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-zinc-950/75 p-6 text-center shadow-2xl shadow-black/40 backdrop-blur-xl light:border-slate-200 light:bg-white/80 light:shadow-slate-200/80 sm:p-8">
        <NeuralMesh />
        <h1 className="text-5xl font-bold tracking-tight text-white light:text-slate-950 sm:text-6xl">
          Pulse
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-7 text-zinc-300 light:text-slate-600">
          A living globe of anonymous strangers. Share your approximate
          location, tap a dot, and start a private peer-to-peer conversation.
        </p>

        <button
          onClick={enter}
          disabled={status === "locating"}
          aria-describedby={
            status === "error" ? "location-error" : "privacy-note"
          }
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-emerald-300 px-8 py-3 font-semibold text-zinc-950 shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-wait disabled:bg-zinc-600 disabled:text-zinc-300 light:bg-emerald-500 light:text-white light:shadow-emerald-100 light:hover:bg-emerald-600 light:focus-visible:ring-emerald-500 light:focus-visible:ring-offset-white light:disabled:bg-slate-200 light:disabled:text-slate-400"
        >
          {status === "locating" ? "Locating..." : "Enter Pulse"}
        </button>

        {status === "error" && (
          <p
            id="location-error"
            role="alert"
            className="mx-auto mt-5 max-w-sm rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-200 light:text-red-700"
          >
            {error}
          </p>
        )}

        <p
          id="privacy-note"
          className="mx-auto mt-6 max-w-md text-sm leading-6 text-zinc-400 light:text-slate-500"
        >
          No sign-up. Your dot is placed 1-3 km from your real location. Nothing
          is stored; closing the tab ends everything.
        </p>
      </div>
    </div>
  );
}
