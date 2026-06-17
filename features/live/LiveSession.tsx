"use client";

import dynamic from "next/dynamic";
import { AlertSettings } from "@/components/ui/AlertSettings";
import ChatPanel from "@/components/templates/ChatPanel";
import ConnectionPrompt from "./components/ConnectionPrompt";
import RequestingBanner from "./components/RequestingBanner";
import VideoWaitingBanner from "./components/VideoWaitingBanner";
import type { Location } from "./types";
import { useLiveSession } from "./useLiveSession";

const WorldMap = dynamic(() => import("@/components/templates/WordMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
      <p className="text-sm text-zinc-400">Loading map…</p>
    </div>
  ),
});

const VideoPanel = dynamic(() => import("@/components/templates/VideoPanel"), {
  ssr: false,
});

export default function LiveSession({
  sessionId,
  myLocation,
}: {
  sessionId: string;
  myLocation: Location;
}) {
  const {
    peers,
    messages,
    notice,
    localStream,
    remoteStream,
    conn,
    video,
    handleAlertPrefsChange,
    showNotice,
    requestConnection,
    cancelRequest,
    acceptIncoming,
    declineIncoming,
    endConnection,
    startVideoRequest,
    acceptVideo,
    declineVideo,
    endVideo,
    sendChat,
  } = useLiveSession(sessionId, myLocation);

  const inChat = conn.kind === "connecting" || conn.kind === "connected";

  return (
    <main
      aria-label="Pulse live map"
      className="fixed inset-0 overflow-hidden bg-zinc-950"
    >
      <WorldMap
        peers={peers}
        me={myLocation}
        onPeerClick={requestConnection}
        canConnect={conn.kind === "idle"}
        highlightPeerId={conn.kind === "incoming" ? conn.peerId : null}
      />

      <AlertSettings
        onPrefsChange={handleAlertPrefsChange}
        onNotice={showNotice}
      />

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="absolute left-1/2 top-5 z-30 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-white/10 bg-zinc-950/90 px-4 py-3 text-center text-sm leading-6 text-zinc-100 shadow-2xl backdrop-blur"
        >
          {notice}
        </div>
      )}

      {conn.kind === "requesting" && (
        <RequestingBanner onCancel={cancelRequest} />
      )}

      {conn.kind === "incoming" && (
        <ConnectionPrompt
          variant="connect"
          title="A stranger wants to connect"
          subtitle="Accept to start an anonymous chat. Nothing is saved."
          acceptLabel="Accept"
          declineLabel="Decline"
          onAccept={acceptIncoming}
          onDecline={declineIncoming}
        />
      )}

      <ChatPanel
        open={inChat}
        messages={messages}
        connected={conn.kind === "connected"}
        videoBusy={video !== "none"}
        onSend={sendChat}
        onStartVideo={startVideoRequest}
        onEnd={endConnection}
      />

      {video === "requesting" && <VideoWaitingBanner />}

      {video === "incoming" && (
        <ConnectionPrompt
          variant="video"
          title="Start video call?"
          subtitle="The stranger wants to turn on video."
          acceptLabel="Accept"
          declineLabel="Decline"
          onAccept={acceptVideo}
          onDecline={declineVideo}
        />
      )}

      {video === "active" && (
        <VideoPanel
          localStream={localStream}
          remoteStream={remoteStream}
          onEnd={endVideo}
        />
      )}
    </main>
  );
}
