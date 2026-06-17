"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { EndCallIcon } from "@/components/ui/Icons";

export default function VideoPanel({
  localStream,
  remoteStream,
  onEnd,
}: {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onEnd: () => void;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localRef.current && localRef.current.srcObject !== localStream) {
      localRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteRef.current && remoteRef.current.srcObject !== remoteStream) {
      remoteRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-black text-zinc-100">
      <div className="relative flex-1">
        {/* Remote (full screen) */}
        <video
          ref={remoteRef}
          autoPlay
          playsInline
          aria-label="Remote video"
          className="h-full w-full bg-zinc-900 object-cover"
        />
        {!remoteStream && (
          <div
            role="status"
            className="absolute inset-0 flex items-center justify-center p-6 text-center text-zinc-400"
          >
            <div className="rounded-2xl border border-white/10 bg-zinc-950/80 px-5 py-4 shadow-2xl backdrop-blur">
              Waiting for stranger&rsquo;s video…
            </div>
          </div>
        )}
        {/* Local (picture-in-picture) */}
        <video
          ref={localRef}
          autoPlay
          playsInline
          muted
          aria-label="Your video preview"
          className="absolute bottom-4 right-4 h-32 w-24 rounded-2xl border border-white/15 bg-zinc-800 object-cover shadow-2xl sm:h-40 sm:w-28"
        />
      </div>
      <div className="flex justify-center border-t border-white/10 bg-zinc-950/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          variant="danger"
          size="lg"
          icon={<EndCallIcon className="h-5 w-5" />}
          responsiveLabel
          onClick={onEnd}
        >
          End video
        </Button>
      </div>
    </div>
  );
}
