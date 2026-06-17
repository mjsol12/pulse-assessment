"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EndCallIcon, SendIcon, VideoIcon } from "@/components/ui/icons";

export interface ChatMessage {
  id: number;
  mine: boolean;
  text: string;
}

export default function ChatPanel({
  open,
  messages,
  connected,
  videoBusy,
  onSend,
  onStartVideo,
  onEnd,
}: {
  open: boolean;
  messages: ChatMessage[];
  connected: boolean;
  videoBusy: boolean;
  onSend: (text: string) => void;
  onStartVideo: () => void;
  onEnd: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      let innerFrame = 0;
      const outerFrame = requestAnimationFrame(() => {
        setMounted(true);
        innerFrame = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(outerFrame);
        if (innerFrame) cancelAnimationFrame(innerFrame);
      };
    }

    const closeFrame = requestAnimationFrame(() => setVisible(false));
    return () => cancelAnimationFrame(closeFrame);
  }, [open]);

  function handleTransitionEnd(event: React.TransitionEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) return;
    if (!visible && !open) setMounted(false);
  }

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    endRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !connected) return;
    onSend(text);
    setDraft("");
  }

  if (!mounted) return null;

  return (
    <section
      aria-label="Conversation with stranger"
      aria-hidden={!visible}
      data-state={visible ? "open" : "closed"}
      onTransitionEnd={handleTransitionEnd}
      className="chat-panel absolute inset-x-3 bottom-3 z-20 flex max-h-[82dvh] z-[999] flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-zinc-950/95 text-zinc-100 shadow-2xl shadow-black/45 backdrop-blur-xl md:inset-x-auto md:inset-y-4 md:right-4 md:max-h-none md:w-[26rem]"
    >
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="font-semibold tracking-tight">Stranger</h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            {connected ? "Connected" : "Connecting…"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<VideoIcon />}
            responsiveLabel
            onClick={onStartVideo}
            disabled={!connected || videoBusy}
          >
            Video
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={<EndCallIcon />}
            responsiveLabel
            onClick={onEnd}
          >
            End
          </Button>
        </div>
      </header>

      <div
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
        className="flex-1 space-y-2 overflow-y-auto p-4"
      >
        {messages.length === 0 && (
          <p className="mx-auto mt-8 max-w-xs rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-sm leading-6 text-zinc-400">
            Say hello. Messages are peer-to-peer and never stored.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.mine ? "justify-end" : "justify-start"}`}
          >
            <span
              className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm ${
                m.mine
                  ? "bg-emerald-300 text-zinc-950"
                  : "border border-white/10 bg-zinc-900 text-zinc-100"
              }`}
            >
              {m.text}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={submit}
        className="flex gap-2 border-t border-white/10 p-3"
      >
        <label htmlFor="chat-message" className="sr-only">
          Message
        </label>
        <input
          id="chat-message"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={connected ? "Type a message…" : "Connecting…"}
          disabled={!connected}
          className="min-h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-zinc-900 px-4 py-2 text-sm outline-none placeholder:text-zinc-500 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/40 disabled:cursor-not-allowed disabled:text-zinc-500"
        />
        <Button
          type="submit"
          icon={<SendIcon />}
          responsiveLabel
          disabled={!connected || !draft.trim()}
        >
          Send
        </Button>
      </form>
    </section>
  );
}
