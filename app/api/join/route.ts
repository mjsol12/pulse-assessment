import type { NextRequest } from "next/server";
import * as presenceDb from "@/lib/db/presence";
import { applyPrivacyOffset, isValidLatLng } from "@/lib/geo";
import {
  clientIp,
  hashSessionToken,
  isValidSessionId,
  newSessionToken,
} from "@/lib/session";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/join — body { id, lat, lng } (raw coords).
// Applies a 1–3 km privacy offset and creates the presence row. Raw
// coordinates are never stored. Returns a per-tab bearer token.
export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const limited = rateLimit(`join:${ip}`, 10, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterMs);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { id, lat, lng } = (body ?? {}) as Record<string, unknown>;

  if (!isValidSessionId(id)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  if (!isValidLatLng(lat, lng)) {
    return Response.json({ error: "invalid coordinates" }, { status: 400 });
  }

  const offset = applyPrivacyOffset(lat as number, lng as number);
  const sessionToken = newSessionToken();

  const created = await presenceDb.createOnJoin({
    id,
    authTokenHash: hashSessionToken(sessionToken),
    lat: offset.lat,
    lng: offset.lng,
  });

  if (!created) {
    return Response.json({ error: "session already exists" }, { status: 409 });
  }

  return Response.json({ ok: true, sessionToken });
}
