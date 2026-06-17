import * as signalDb from "@/lib/db/signal";
import { isValidSessionId } from "@/lib/session";
import type { SignalType } from "@/lib/types";

const VALID_TYPES: SignalType[] = [
  "request",
  "accept",
  "decline",
  "offer",
  "answer",
  "ice",
  "end",
];

const MAX_PAYLOAD = 64 * 1024; // SDP/ICE are small; cap to be safe.

export const RECIPIENT_TYPES: SignalType[] = ["accept", "decline"];
const WEBRTC_TYPES: SignalType[] = ["offer", "answer", "ice"];

/** Signals that resolve a connection attempt or active session. */
export const LIFECYCLE_TYPES: SignalType[] = ["accept", "decline", "end"];

export const TARGET_REQUIRED_TYPES: SignalType[] = [
  ...RECIPIENT_TYPES,
  ...WEBRTC_TYPES,
];

export type ParsedSignalBody = {
  fromId: string;
  toId: string;
  signalType: SignalType;
  payload: string | null;
};

export function parseSignalBody(
  sessionId: string,
  body: unknown,
): { ok: true; data: ParsedSignalBody } | { ok: false; error: Response } {
  const { fromId, toId, type, payload } = (body ?? {}) as Record<
    string,
    unknown
  >;

  if (fromId !== sessionId) {
    return {
      ok: false,
      error: Response.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  if (!isValidSessionId(toId) || fromId === toId) {
    return {
      ok: false,
      error: Response.json({ error: "invalid ids" }, { status: 400 }),
    };
  }
  if (typeof type !== "string" || !VALID_TYPES.includes(type as SignalType)) {
    return {
      ok: false,
      error: Response.json({ error: "invalid type" }, { status: 400 }),
    };
  }
  if (
    payload !== undefined &&
    payload !== null &&
    (typeof payload !== "string" || payload.length > MAX_PAYLOAD)
  ) {
    return {
      ok: false,
      error: Response.json({ error: "invalid payload" }, { status: 400 }),
    };
  }

  return {
    ok: true,
    data: {
      fromId,
      toId,
      signalType: type as SignalType,
      payload: typeof payload === "string" ? payload : null,
    },
  };
}

/** Deliver an auto-decline from `target` back to `initiator`. */
export async function sendDecline(targetId: string, initiatorId: string) {
  await signalDb.createDecline(targetId, initiatorId);
}
