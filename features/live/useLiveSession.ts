"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/components/templates/ChatPanel";
import { leave, poll, sendSignal } from "@/lib/api";
import {
  DEFAULT_ALERT_PREFS,
  playMessageTone,
  startIncomingAlert,
  stopIncomingAlert,
  type AlertPrefs,
} from "@/lib/alerts";
import { POLL_INTERVAL_MS } from "@/lib/presence";
import { type PeerDot, type SignalMsg } from "@/lib/types";
import { PeerSession, type DescType, type PeerControl } from "@/lib/webrtc";
import type { Conn, Location, VideoState } from "./types";

const REQUEST_TIMEOUT_MS = 15_000;

export function useLiveSession(sessionId: string, myLocation: Location) {
  const [peers, setPeers] = useState<PeerDot[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const [conn, _setConn] = useState<Conn>({ kind: "idle" });
  const connRef = useRef<Conn>(conn);
  const setConn = (c: Conn) => {
    connRef.current = c;
    _setConn(c);
  };

  const [video, _setVideo] = useState<VideoState>("none");
  const videoRef = useRef<VideoState>(video);
  const setVideo = (v: VideoState) => {
    videoRef.current = v;
    _setVideo(v);
  };

  const peerRef = useRef<PeerSession | null>(null);
  const msgId = useRef(0);
  const requestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incomingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoredRequestPeer = useRef<string | null>(null);
  const alertPrefsRef = useRef<AlertPrefs>(DEFAULT_ALERT_PREFS);

  const handleAlertPrefsChange = useCallback((prefs: AlertPrefs) => {
    alertPrefsRef.current = prefs;
    const incoming =
      connRef.current.kind === "incoming"
        ? ("connect" as const)
        : videoRef.current === "incoming"
          ? ("video" as const)
          : null;
    if (incoming) startIncomingAlert(incoming, prefs);
  }, []);

  function showNotice(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 3500);
  }

  function addMessage(mine: boolean, text: string) {
    setMessages((prev) => [...prev, { id: msgId.current++, mine, text }]);
  }

  function clearRequestTimer() {
    if (!requestTimer.current) return;
    clearTimeout(requestTimer.current);
    requestTimer.current = null;
  }

  function clearIncomingTimer() {
    if (!incomingTimer.current) return;
    clearTimeout(incomingTimer.current);
    incomingTimer.current = null;
  }

  function showIncomingRequest(peerId: string) {
    clearIncomingTimer();
    setConn({ kind: "incoming", peerId });
    incomingTimer.current = setTimeout(() => {
      if (
        connRef.current.kind === "incoming" &&
        connRef.current.peerId === peerId
      ) {
        declineRequest(peerId);
        setConn({ kind: "idle" });
      }
    }, REQUEST_TIMEOUT_MS);
  }

  function declineRequest(peerId: string) {
    ignoredRequestPeer.current = peerId;
    void sendSignal(sessionId, peerId, "decline").finally(() => {
      if (ignoredRequestPeer.current === peerId) ignoredRequestPeer.current = null;
    });
  }

  function teardown(message?: string) {
    clearRequestTimer();
    clearIncomingTimer();
    peerRef.current?.close();
    peerRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setVideo("none");
    setMessages([]);
    setConn({ kind: "idle" });
    if (message) showNotice(message);
  }

  function startPeer(peerId: string, initiator: boolean) {
    const ps = new PeerSession(initiator, {
      onSignal: (type: DescType, payload: string) => {
        void sendSignal(sessionId, peerId, type, payload);
      },
      onChat: (text) => {
        addMessage(false, text);
        if (alertPrefsRef.current.messageSound) playMessageTone();
      },
      onControl: (ctrl) => handleControl(ctrl),
      onRemoteStream: (stream) => setRemoteStream(stream),
      onConnectionState: (state) => {
        if (state === "failed") {
          teardown("Connection failed (network).");
        }
      },
      onChannelOpen: () => {
        setConn({ kind: "connected", peerId });
      },
    });
    peerRef.current = ps;
  }

  function handleControl(ctrl: PeerControl) {
    const ps = peerRef.current;
    switch (ctrl) {
      case "video-request":
        if (videoRef.current === "none") setVideo("incoming");
        break;
      case "video-accept":
        if (videoRef.current === "requesting" && ps) {
          ps.startVideo()
            .then((stream) => {
              setLocalStream(stream);
              setVideo("active");
            })
            .catch(() => {
              setVideo("none");
              ps.sendControl("video-end");
              showNotice("Camera unavailable.");
            });
        }
        break;
      case "video-decline":
        if (videoRef.current === "requesting") {
          setVideo("none");
          showNotice("Video declined.");
        }
        break;
      case "video-end":
        ps?.stopVideo();
        setLocalStream(null);
        setRemoteStream(null);
        setVideo("none");
        break;
    }
  }

  function requestConnection(peerId: string) {
    if (connRef.current.kind !== "idle") return;
    setConn({ kind: "requesting", peerId });
    void sendSignal(sessionId, peerId, "request");
    requestTimer.current = setTimeout(() => {
      if (
        connRef.current.kind === "requesting" &&
        connRef.current.peerId === peerId
      ) {
        void sendSignal(sessionId, peerId, "end");
        teardown("No answer.");
      }
    }, REQUEST_TIMEOUT_MS);
  }

  function cancelRequest() {
    if (connRef.current.kind === "requesting") {
      void sendSignal(sessionId, connRef.current.peerId, "end");
    }
    teardown();
  }

  function acceptIncoming() {
    if (connRef.current.kind !== "incoming") return;
    const peerId = connRef.current.peerId;
    clearIncomingTimer();
    ignoredRequestPeer.current = peerId;
    startPeer(peerId, false);
    void sendSignal(sessionId, peerId, "accept").finally(() => {
      if (ignoredRequestPeer.current === peerId) ignoredRequestPeer.current = null;
    });
    setConn({ kind: "connecting", peerId });
  }

  function declineIncoming() {
    if (connRef.current.kind !== "incoming") return;
    const peerId = connRef.current.peerId;
    clearIncomingTimer();
    declineRequest(peerId);
    setConn({ kind: "idle" });
  }

  function endConnection() {
    const c = connRef.current;
    if (c.kind === "connecting" || c.kind === "connected") {
      void sendSignal(sessionId, c.peerId, "end");
    }
    teardown();
  }

  function startVideoRequest() {
    if (videoRef.current !== "none" || !peerRef.current) return;
    setVideo("requesting");
    peerRef.current.sendControl("video-request");
  }

  function acceptVideo() {
    const ps = peerRef.current;
    if (!ps) return;
    ps.startVideo()
      .then((stream) => {
        setLocalStream(stream);
        ps.sendControl("video-accept");
        setVideo("active");
      })
      .catch(() => {
        ps.sendControl("video-decline");
        setVideo("none");
        showNotice("Camera unavailable.");
      });
  }

  function declineVideo() {
    peerRef.current?.sendControl("video-decline");
    setVideo("none");
  }

  function endVideo() {
    const ps = peerRef.current;
    ps?.stopVideo();
    ps?.sendControl("video-end");
    setLocalStream(null);
    setRemoteStream(null);
    setVideo("none");
  }

  function processSignal(sig: SignalMsg) {
    switch (sig.type) {
      case "request": {
        const c = connRef.current;
        const currentPeerId = c.kind === "idle" ? null : c.peerId;
        if (ignoredRequestPeer.current === sig.fromId) break;
        if (c.kind === "idle") {
          showIncomingRequest(sig.fromId);
        } else if (currentPeerId !== sig.fromId) {
          void sendSignal(sessionId, sig.fromId, "decline");
        }
        break;
      }
      case "accept": {
        const c = connRef.current;
        if (c.kind === "requesting" && c.peerId === sig.fromId) {
          clearRequestTimer();
          startPeer(sig.fromId, true);
          setConn({ kind: "connecting", peerId: sig.fromId });
        }
        break;
      }
      case "decline": {
        const c = connRef.current;
        if (c.kind === "requesting" && c.peerId === sig.fromId) {
          teardown("Request declined.");
        }
        break;
      }
      case "offer":
      case "answer":
      case "ice": {
        const c = connRef.current;
        const peerId =
          c.kind === "connecting" || c.kind === "connected" ? c.peerId : null;
        if (peerRef.current && peerId === sig.fromId) {
          void peerRef.current.handleSignal(
            sig.type as DescType,
            sig.payload ?? "",
          );
        }
        break;
      }
      case "end": {
        const c = connRef.current;
        if (
          (c.kind === "incoming" ||
            c.kind === "connecting" ||
            c.kind === "connected") &&
          c.peerId === sig.fromId
        ) {
          if (c.kind === "incoming") {
            clearIncomingTimer();
            setConn({ kind: "idle" });
          } else teardown("Stranger disconnected.");
        }
        break;
      }
    }
  }

  const processSignalRef = useRef(processSignal);
  useEffect(() => {
    processSignalRef.current = processSignal;
  });

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const data = await poll(sessionId);
        if (!active) return;
        setPeers(data.peers);
        for (const s of data.signals) processSignalRef.current(s);
      } catch {}
      if (active) timer = setTimeout(tick, POLL_INTERVAL_MS);
    };
    tick();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      clearRequestTimer();
      clearIncomingTimer();
      ignoredRequestPeer.current = null;
    };
  }, [sessionId]);

  useEffect(() => {
    const onLeave = () => leave(sessionId);
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [sessionId]);

  useEffect(() => {
    const incoming =
      conn.kind === "incoming"
        ? ("connect" as const)
        : video === "incoming"
          ? ("video" as const)
          : null;

    if (!incoming) {
      stopIncomingAlert();
      return;
    }

    startIncomingAlert(incoming, alertPrefsRef.current);

    return () => {
      stopIncomingAlert();
    };
  }, [conn.kind, video]);

  function sendChat(text: string) {
    peerRef.current?.sendChat(text);
    addMessage(true, text);
  }

  return {
    peers,
    messages,
    notice,
    localStream,
    remoteStream,
    conn,
    video,
    myLocation,
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
  };
}
