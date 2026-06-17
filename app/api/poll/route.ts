import type { NextRequest } from "next/server";
import { getPollResponse } from "@/lib/services/poll";
import { clientIp, requireSession } from "@/lib/session";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/poll — the single endpoint that drives the live map.
// Session is read from per-tab auth headers, falling back to the legacy cookie.
// It (1) heartbeats the caller, (2) reaps stale presence + orphan signals,
// (3) returns the filtered online peers, and (4) drains this user's mailbox.
export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if ("error" in auth) return auth.error;
  const { sessionId } = auth;

  const limited = rateLimit(
    `poll:${sessionId}:${clientIp(request)}`,
    120,
    60_000,
  );
  if (!limited.ok) return rateLimitResponse(limited.retryAfterMs);

  const response = await getPollResponse(sessionId);
  return Response.json(response);
}
