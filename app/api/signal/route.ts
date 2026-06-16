import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SignalType } from "@/lib/types";
import { clientIp, requireSession } from "@/lib/session";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

const RECIPIENT_TYPES: SignalType[] = ["accept", "decline"];
const WEBRTC_TYPES: SignalType[] = ["offer", "answer", "ice"];

// POST /api/signal — body { fromId, toId, type, payload? }
// Drops one message into the recipient's mailbox. Also manages the `busy`
// flag so a user can only be in one connection at a time.
// fromId must match the authenticated per-tab session.
export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if ("error" in auth) return auth.error;
  const { sessionId } = auth;

  const limited = rateLimit(
    `signal:${sessionId}:${clientIp(request)}`,
    60,
    60_000,
  );
  if (!limited.ok) return rateLimitResponse(limited.retryAfterMs);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { fromId, toId, type, payload } = (body ?? {}) as Record<
    string,
    unknown
  >;

  if (fromId !== sessionId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (typeof toId !== "string" || toId.length < 8 || toId.length > 64) {
    return Response.json({ error: "invalid ids" }, { status: 400 });
  }
  if (fromId === toId) {
    return Response.json({ error: "invalid ids" }, { status: 400 });
  }
  if (typeof type !== "string" || !VALID_TYPES.includes(type as SignalType)) {
    return Response.json({ error: "invalid type" }, { status: 400 });
  }
  if (
    payload !== undefined &&
    payload !== null &&
    (typeof payload !== "string" || payload.length > MAX_PAYLOAD)
  ) {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }

  const signalType = type as SignalType;
  const payloadStr = typeof payload === "string" ? payload : null;

  const [sender, target] = await Promise.all([
    prisma.presence.findUnique({
      where: { id: fromId },
      select: { busy: true },
    }),
    prisma.presence.findUnique({
      where: { id: toId },
      select: { busy: true },
    }),
  ]);

  if (!sender) {
    return Response.json({ error: "not joined" }, { status: 403 });
  }

  // Enforce "one active connection at a time": if the target is already busy,
  // auto-decline the request instead of delivering it.
  if (signalType === "request") {
    if (sender.busy) {
      return Response.json({ error: "busy" }, { status: 409 });
    }
    if (!target) {
      await sendDecline(toId, fromId);
      return Response.json({ ok: true, autoDeclined: true });
    }
    if (target.busy) {
      await sendDecline(toId, fromId);
      return Response.json({ ok: true, autoDeclined: true });
    }
  }

  if (RECIPIENT_TYPES.includes(signalType)) {
    if (!target) {
      return Response.json({ error: "target offline" }, { status: 404 });
    }
    const pending = await prisma.signal.findFirst({
      where: { fromId: toId, toId: fromId, type: "request" },
      orderBy: { createdAt: "desc" },
    });
    if (!pending) {
      return Response.json({ error: "no pending request" }, { status: 409 });
    }
  }

  if (WEBRTC_TYPES.includes(signalType) || signalType === "end") {
    if (!target) {
      return Response.json({ error: "target offline" }, { status: 404 });
    }
  }

  // Busy transitions:
  // - accept: the connection is now active → mark BOTH peers busy.
  // - decline/end: free both peers.
  if (signalType === "accept") {
    await prisma.presence.updateMany({
      where: { id: { in: [fromId, toId] } },
      data: { busy: true },
    });
  } else if (signalType === "decline" || signalType === "end") {
    await prisma.presence.updateMany({
      where: { id: { in: [fromId, toId] } },
      data: { busy: false },
    });
  }

  if (
    signalType === "accept" ||
    signalType === "decline" ||
    signalType === "end"
  ) {
    await prisma.signal.deleteMany({
      where: {
        type: "request",
        OR: [
          { fromId: toId, toId: fromId },
          { fromId: fromId, toId: toId },
        ],
      },
    });
  }

  await prisma.signal.create({
    data: { fromId, toId, type: signalType, payload: payloadStr },
  });

  return Response.json({ ok: true });
}

// Helper: deliver an auto-decline from `target` back to `initiator`.
async function sendDecline(targetId: string, initiatorId: string) {
  await prisma.signal.create({
    data: {
      fromId: targetId,
      toId: initiatorId,
      type: "decline",
      payload: null,
    },
  });
}
