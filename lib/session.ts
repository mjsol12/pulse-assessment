import type { NextRequest } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import * as presenceDb from "@/lib/db/presence";

export const SESSION_ID_HEADER = "x-pulse-session-id";
export const SESSION_TOKEN_HEADER = "x-pulse-session-token";

export function isValidSessionId(id: unknown): id is string {
  return typeof id === "string" && id.length >= 8 && id.length <= 64;
}

export function isValidSessionToken(token: unknown): token is string {
  return typeof token === "string" && token.length >= 32 && token.length <= 128;
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function requireSession(
  request: NextRequest,
): Promise<{ sessionId: string } | { error: Response }> {
  const headerId = request.headers.get(SESSION_ID_HEADER);
  const headerToken = request.headers.get(SESSION_TOKEN_HEADER);
  if (isValidSessionId(headerId) && isValidSessionToken(headerToken)) {
    const presence = await presenceDb.findAuthTokenHash(headerId);
    if (presence?.authTokenHash === hashSessionToken(headerToken)) {
      return { sessionId: headerId };
    }
    return {
      error: Response.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  return {
    error: Response.json({ error: "unauthorized" }, { status: 401 }),
  };
}

export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}
