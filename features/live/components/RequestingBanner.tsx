export default function RequestingBanner({ onCancel }: { onCancel: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="bottom-popup-enter absolute bottom-24 left-1/2 z-30 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-zinc-950/90 px-4 py-3 text-sm text-zinc-100 shadow-2xl backdrop-blur light:border-slate-200 light:bg-white/95 light:text-slate-900 light:shadow-slate-200/80 md:bottom-6"
    >
      <span className="font-medium">Requesting connection…</span>
      <button
        onClick={onCancel}
        className="min-h-10 rounded-full bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 light:bg-slate-100 light:text-slate-700 light:hover:bg-slate-200 light:focus-visible:ring-slate-400 light:focus-visible:ring-offset-white"
      >
        Cancel
      </button>
    </div>
  );
}
