export default function VideoWaitingBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute bottom-24 left-1/2 z-30 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-white/10 bg-zinc-950/90 px-4 py-3 text-center text-sm leading-6 text-zinc-100 shadow-2xl backdrop-blur md:bottom-6"
    >
      Waiting for stranger to accept video…
    </div>
  );
}
