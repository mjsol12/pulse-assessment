// Client-side helpers for talking to the coordination API.
import type { PollResponse, SignalType } from "@/lib/types";

const FETCH_OPTS: RequestInit = { credentials: "include" };
const SESSION_TOKEN_KEY_PREFIX = "pulse_session_token:";
const SESSION_ID_HEADER = "x-pulse-session-id";
const SESSION_TOKEN_HEADER = "x-pulse-session-token";

interface JoinResponse {
  sessionToken?: string;
}

function storeSessionToken(id: string, token: string) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(`${SESSION_TOKEN_KEY_PREFIX}${id}`, token);
}

function authHeaders(id: string): HeadersInit {
  if (typeof sessionStorage === "undefined") return {};
  const token = sessionStorage.getItem(`${SESSION_TOKEN_KEY_PREFIX}${id}`);
  if (!token) return {};
  return {
    [SESSION_ID_HEADER]: id,
    [SESSION_TOKEN_HEADER]: token,
  };
}

export async function join(
  id: string,
  lat: number,
  lng: number,
): Promise<void> {
  const res = await fetch("/api/join", {
    ...FETCH_OPTS,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, lat, lng }),
  });
  if (!res.ok) throw new Error(`join failed: ${res.status}`);
  const data = (await res.json()) as JoinResponse;
  if (data.sessionToken) storeSessionToken(id, data.sessionToken);
}

export async function poll(id: string): Promise<PollResponse> {
  const res = await fetch("/api/poll", {
    ...FETCH_OPTS,
    headers: authHeaders(id),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`poll failed: ${res.status}`);
  return res.json();
}

export async function sendSignal(
  fromId: string,
  toId: string,
  type: SignalType,
  payload?: string,
): Promise<void> {
  await fetch("/api/signal", {
    ...FETCH_OPTS,
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(fromId) },
    body: JSON.stringify({ fromId, toId, type, payload }),
  });
}

// Fire-and-forget leave; keepalive lets it run during tab close with auth headers.
export function leave(id: string): void {
  const body = JSON.stringify({ id });
  void fetch("/api/leave", {
    ...FETCH_OPTS,
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(id) },
    body,
    keepalive: true,
  });
}
