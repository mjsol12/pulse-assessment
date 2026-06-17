"use client";

import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Map as MapboxMap, Marker } from "mapbox-gl";
import type { PeerDot } from "@/lib/types";

const TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  "pk.eyJ1IjoicHVsc2UtbWFwIiwiYSI6ImNrMDBkZW1vMDAwMDAwMDAifQ.AAAAAAAAAAAAAAAAAAAAAA";

function dotColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return `hsl(${Math.abs(hash) % 360}, 70%, 60%)`;
}

function LoadingDots() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % 3);
    }, 350);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="inline-flex" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block w-[0.35em] text-center"
          style={{
            opacity: i === active ? 1 : 0.25,
            transform: i === active ? "translateY(-3px)" : "translateY(0)",
          }}
        >
          .
        </span>
      ))}
    </span>
  );
}

export default function WorldMap({
  peers,
  me,
  onPeerClick,
  canConnect,
  highlightPeerId = null,
}: {
  peers: PeerDot[];
  me: { lat: number; lng: number } | null;
  onPeerClick: (id: string) => void;
  canConnect: boolean;
  highlightPeerId?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const meMarkerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);

  // Marker click handlers are bound once, so read the live click handler +
  // connectability through refs (synced in an effect, never during render).
  const onPeerClickRef = useRef(onPeerClick);
  const canConnectRef = useRef(canConnect);
  useEffect(() => {
    onPeerClickRef.current = onPeerClick;
    canConnectRef.current = canConnect;
  });

  // Initialise the map once.
  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    let cancelled = false;
    const markers = markersRef.current;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = TOKEN;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        // Open centered on the user if we know where they are, else world view.
        center: me ? [me.lng, me.lat] : [0, 20],
        zoom: me ? 4 : 1.4,
        attributionControl: true,
      });
      map.on("load", () => {
        if (!cancelled) setReady(true);
      });
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      markers.forEach((m) => m.remove());
      markers.clear();
      meMarkerRef.current?.remove();
      meMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // `me` is only read for the initial center; we don't want to re-init on change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show / move the user's own "you are here" pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !me) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      if (!meMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "pulse-me";
        el.title = "You are here";
        el.innerHTML = `<span class="pulse-me-label">Me</span>📍`;
        // anchor "bottom" → the pin's tip sits on the exact coordinate.
        meMarkerRef.current = new mapboxgl.Marker({
          element: el,
          anchor: "bottom",
        })
          .setLngLat([me.lng, me.lat])
          .addTo(map);
      } else {
        meMarkerRef.current.setLngLat([me.lng, me.lat]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [me, ready]);

  // Reconcile markers whenever the peer list changes (or the map becomes ready).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      const markers = markersRef.current;
      const seen = new Set<string>();

      for (const peer of peers) {
        seen.add(peer.id);
        let marker = markers.get(peer.id);
        if (!marker) {
          const el = document.createElement("button");
          el.className = "pulse-dot";
          el.style.setProperty("--pulse-color", dotColor(peer.id));
          el.title = "Tap to connect";
          el.type = "button";
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            if (canConnectRef.current) onPeerClickRef.current(peer.id);
          });
          marker = new mapboxgl.Marker({ element: el })
            .setLngLat([peer.lng, peer.lat])
            .addTo(map);
          markers.set(peer.id, marker);
        }
        const element = marker.getElement() as HTMLButtonElement;
        element.classList.toggle(
          "pulse-dot--incoming",
          peer.id === highlightPeerId,
        );
        element.disabled = peer.busy || !canConnect;
        element.title = peer.busy
          ? "This stranger is already connected"
          : canConnect
            ? "Tap to connect"
            : "Finish your current connection first";
        element.setAttribute(
          "aria-label",
          peer.busy
            ? "Stranger is busy"
            : canConnect
              ? "Request connection with stranger"
              : "Connection unavailable while you are busy",
        );
        element.style.opacity = peer.busy ? "0.45" : "1";
      }

      // Drop markers for peers that went offline / got filtered out.
      for (const [id, marker] of markers) {
        if (!seen.has(id)) {
          marker.remove();
          markers.delete(id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [peers, ready, canConnect, highlightPeerId]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full bg-zinc-900" />

      {!ready && TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/40 p-6 text-center">
          <div
            role="status"
            className="rounded-2xl border border-white/10 bg-zinc-950/85 px-5 py-4 text-sm text-zinc-300 shadow-2xl backdrop-blur"
          >
            Loading live map
            <LoadingDots />
          </div>
        </div>
      )}

      {!TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <p className="max-w-md rounded-2xl border border-white/10 bg-zinc-950/90 p-4 text-sm leading-6 text-zinc-200 shadow-2xl">
            Set{" "}
            <code className="text-emerald-400">NEXT_PUBLIC_MAPBOX_TOKEN</code>{" "}
            in <code>.env</code> to load the map.
          </p>
        </div>
      )}

      <div className="absolute bottom-16 left-4 max-w-[calc(100%-2rem)] rounded-2xl border border-white/10 bg-zinc-950/75 px-4 py-3 text-sm text-zinc-200 shadow-xl backdrop-blur md:bottom-auto md:top-4 md:max-w-sm">
        <p className="font-semibold text-white">Live strangers nearby</p>
        <p className="mt-1 text-xs leading-5 text-zinc-400">
          Tap an available dot to request a private peer-to-peer chat.
        </p>
      </div>

      <div
        role="status"
        aria-live="polite"
        className="absolute bottom-4 left-4 rounded-full border border-white/10 bg-zinc-950/80 px-3 py-1.5 text-xs font-medium text-zinc-200 shadow-lg backdrop-blur"
      >
        {peers.length} {peers.length === 1 ? "stranger" : "strangers"} online
      </div>
    </div>
  );
}
