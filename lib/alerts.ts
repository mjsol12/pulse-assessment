export type AlertPrefs = {
  sound: boolean;
  messageSound: boolean;
  desktop: boolean;
};

export type IncomingAlertKind = "connect" | "video";

const STORAGE_KEY = "pulse-alert-prefs";

export const DEFAULT_ALERT_PREFS: AlertPrefs = {
  sound: true,
  messageSound: true,
  desktop: false,
};

const ALERT_COPY: Record<IncomingAlertKind, { title: string; body: string }> = {
  connect: {
    title: "A stranger wants to connect",
    body: "Open Pulse to accept or decline.",
  },
  video: {
    title: "Video call request",
    body: "A stranger wants to turn on video.",
  },
};

let repeatTimer: ReturnType<typeof setInterval> | null = null;
let activeNotification: Notification | null = null;
let audioCtx: AudioContext | null = null;
let audioPrimed = false;
let visibilityHandler: (() => void) | null = null;

export function loadAlertPrefs(): AlertPrefs {
  if (typeof window === "undefined") return DEFAULT_ALERT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ALERT_PREFS;
    const parsed = JSON.parse(raw) as Partial<AlertPrefs>;
    return {
      sound: parsed.sound ?? DEFAULT_ALERT_PREFS.sound,
      messageSound: parsed.messageSound ?? DEFAULT_ALERT_PREFS.messageSound,
      desktop: parsed.desktop ?? DEFAULT_ALERT_PREFS.desktop,
    };
  } catch {
    return DEFAULT_ALERT_PREFS;
  }
}

export function saveAlertPrefs(prefs: AlertPrefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function notificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission():
  | NotificationPermission
  | "unsupported" {
  if (!notificationSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctx =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    return audioCtx;
  } catch {
    return null;
  }
}

export async function primeAlertAudio(): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return;
    }
  }
  if (ctx.state !== "running" || audioPrimed) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  gain.gain.value = 0.0001;
  osc.frequency.value = 440;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.03);
  audioPrimed = true;
}

export function playIncomingChime(): void {
  void playToneSequence(
    [
      { freq: 880, start: 0, duration: 0.4 },
      { freq: 1174.66, start: 0.16, duration: 0.4 },
    ],
    0.14,
  );
}

export function playMessageTone(): void {
  void playToneSequence([{ freq: 784, start: 0, duration: 0.2 }], 0.09);
}

async function playToneSequence(
  tones: { freq: number; start: number; duration: number }[],
  peakGain: number,
): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return;
  await primeAlertAudio();
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return;
    }
  }
  if (ctx.state !== "running") return;

  const now = ctx.currentTime;
  for (const { freq, start, duration } of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t0 = now + start;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peakGain, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }
}

export function showDesktopNotification(kind: IncomingAlertKind): void {
  if (!notificationSupported() || Notification.permission !== "granted") return;

  const copy = ALERT_COPY[kind];
  activeNotification?.close();
  activeNotification = new Notification(copy.title, {
    body: copy.body,
    tag: "pulse-incoming",
    silent: true,
  });
  activeNotification.onclick = () => {
    window.focus();
    activeNotification?.close();
    activeNotification = null;
  };
}

function ping(kind: IncomingAlertKind, prefs: AlertPrefs): void {
  if (prefs.sound) playIncomingChime();
  if (prefs.desktop && document.hidden) showDesktopNotification(kind);
}

export function startIncomingAlert(
  kind: IncomingAlertKind,
  prefs: AlertPrefs,
): void {
  stopIncomingAlert();
  if (!prefs.sound && !prefs.desktop) return;

  ping(kind, prefs);
  repeatTimer = setInterval(() => ping(kind, prefs), 2800);

  if (prefs.desktop) {
    visibilityHandler = () => {
      if (document.hidden) showDesktopNotification(kind);
    };
    document.addEventListener("visibilitychange", visibilityHandler);
  }
}

export function stopIncomingAlert(): void {
  if (visibilityHandler) {
    document.removeEventListener("visibilitychange", visibilityHandler);
    visibilityHandler = null;
  }
  if (repeatTimer) {
    clearInterval(repeatTimer);
    repeatTimer = null;
  }
  activeNotification?.close();
  activeNotification = null;
}
