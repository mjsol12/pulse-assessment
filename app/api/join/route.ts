import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import * as presenceDb from "@/lib/db/presence";
import { applyPrivacyOffset, isValidLatLng } from "@/lib/geo";
import {
  clientIp,
  hashSessionToken,
  isValidSessionId,
  newSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/session";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/join — body { id, lat, lng } (raw coords).
// Applies a 1–3 km privacy offset and upserts the presence row. Raw
// coordinates are never stored. Returns a per-tab session token; the cookie is
// kept only as a fallback for existing clients.
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

  await presenceDb.upsertOnJoin({
    id,
    authTokenHash: hashSessionToken(sessionToken),
    lat: offset.lat,
    lng: offset.lng,
  });

  const response = NextResponse.json({ ok: true, sessionToken });
  response.cookies.set(SESSION_COOKIE, id, sessionCookieOptions());
  return response;
}
