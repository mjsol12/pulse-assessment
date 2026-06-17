import type { NextRequest } from "next/server";
import * as presenceDb from "@/lib/db/presence";
import * as signalDb from "@/lib/db/signal";
import { requireSession } from "@/lib/session";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/leave — body { id }. Removes the presence row and any pending
// signals to/from this user. The authenticated session must match id.
export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if ("error" in auth) return auth.error;
  const { sessionId } = auth;

  const limited = rateLimit(`leave:${sessionId}`, 20, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterMs);

  let id: string | undefined;
  try {
    const text = await request.text();
    id = text ? (JSON.parse(text)?.id as string | undefined) : undefined;
  } catch {
    id = undefined;
  }

  if (id !== sessionId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await signalDb.deleteForSession(id);
  await presenceDb.deleteById(id);

  return Response.json({ ok: true });
}
