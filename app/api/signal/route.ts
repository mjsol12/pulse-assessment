import type { NextRequest } from "next/server";
import { deliverSignal } from "@/lib/services/signal";
import { clientIp, requireSession } from "@/lib/session";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseSignalBody } from "@/lib/utils/signal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const parsed = parseSignalBody(sessionId, body);
  if (!parsed.ok) return parsed.error;

  const result = await deliverSignal(parsed.data);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json(
    result.autoDeclined ? { ok: true, autoDeclined: true } : { ok: true },
  );
}
