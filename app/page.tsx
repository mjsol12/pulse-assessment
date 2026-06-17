"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import EntryGate from "./components/EntryGate";
import { join } from "@/lib/api";
import LiveLoadingShell from "@/features/live/LiveLoadingShell";
import type { Location } from "@/features/live/types";

const LiveSession = dynamic(() => import("@/features/live/LiveSession"), {
  ssr: false,
  loading: () => <LiveLoadingShell />,
});

export default function Home() {
  const [phase, setPhase] = useState<"gate" | "live">("gate");
  const [sessionId] = useState(() => crypto.randomUUID());
  const [myLocation, setMyLocation] = useState<Location | null>(null);

  async function handleReady(lat: number, lng: number) {
    setMyLocation({ lat, lng });
    await join(sessionId, lat, lng);
    setPhase("live");
  }

  if (phase === "gate") {
    return <EntryGate onReady={handleReady} />;
  }

  if (!myLocation) {
    return <LiveLoadingShell />;
  }

  return <LiveSession sessionId={sessionId} myLocation={myLocation} />;
}
