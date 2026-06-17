## Phase 1

### Setup & environment

- **Mapbox token** — Mapbox requires a personal account with billing on file (free tier). Added `NEXT_PUBLIC_MAPBOX_TOKEN` to `.env` from [Mapbox access tokens](https://account.mapbox.com/access-tokens/).
- **Database** — Copied `.env.example` → `.env`, provisioned Postgres (Neon), ran `npx prisma db push`.
- **Dependency audit (`npm audit`)** — 5 moderate-severity transitive issues (PostCSS XSS advisory via `next`, `@hono/node-server` via `prisma` dev tooling). `npm audit fix --force` would downgrade Next/Prisma with breaking changes; **deferred** for now. No direct app-code exposure from the PostCSS path (build-time only).

---

### Functional bugs found

#### 1. Ghost dots — stale users never removed from map (fixed)

- **How found:** Reproduced the README example — after both users closed the app, dots stayed online indefinitely.
- **Root cause:** `/api/poll` heartbeat used `updateMany({ where: {} })`, refreshing **every** presence row on each poll. The stale reaper ran immediately after but all rows had just been updated, so nothing was deleted.
- **Fix:** Heartbeat now scopes to the caller only: `updateMany({ where: { id } })` in `app/api/poll/route.ts`.

#### 2. P2P chat messages not delivered (fixed)

- **How found:** Code review of WebRTC data-channel wiring in `lib/webrtc.ts`.
- **Root cause:** `sendChat()` emits `{ t: "msg", text }` but the receiver checks `msg.t === "chat"`. Outgoing chat is silently dropped on the peer side.
- **Fix:** `sendChat()` now emits `{ t: "chat", text }`, matching the receiver.

#### 3. Server `busy` flag stuck after disconnect (fixed)

- **How found:** Security / state review of `app/api/signal/route.ts`.
- **Root cause:** `accept` and `decline` updated the `busy` column, but `end` did not — users could appear permanently busy on the map after hanging up.
- **Fix:** `end` now clears `busy` for both peers, same as `decline`.

#### 4. Same-browser windows shared one session identity (fixed)

- **How found:** Reproduced local testing with two windows from the same browser profile. The second join overwrote the shared HttpOnly cookie, so both windows authenticated as the newest session.
- **Root cause:** Server identity depended only on the `pulse_session` cookie, but cookies are shared across tabs/windows in the same browser profile.
- **Fix:** `POST /api/join` now returns a per-tab session token. The client stores it in `sessionStorage` and sends it with `x-pulse-session-id` / `x-pulse-session-token`; the server validates the token hash stored on the `Presence` row. The cookie remains only as a compatibility fallback.

#### 5. ICE candidates could be dropped during setup (fixed)

- **How found:** Code review of the WebRTC signaling path while investigating two-browser connection failures.
- **Root cause:** Queued ICE candidates were flushed before `setRemoteDescription()`, so early candidates could fail and be swallowed.
- **Fix:** Remote SDP is applied before flushing queued candidates.

---

### Security issues found

Prioritized review of the coordination API (no accounts — session UUID is the only identity).

| Issue | Severity | Endpoints | Impact |
|-------|----------|-----------|--------|
| No session ownership (IDOR) | Critical | all four routes | Impersonate any user, drain mailboxes, force disconnects, spoof WebRTC signals |
| Global poll heartbeat | High | `GET /api/poll` | Keeps all ghost sessions alive; breaks privacy + availability |
| Unauthenticated signal relay | High | `POST /api/signal` | Harassment, signaling injection, busy-state manipulation |
| No rate limiting | Medium | all routes | Signal/mailbox spam, DB write pressure |
| Busy-state manipulation | Medium | `POST /api/signal` | Fake `accept` could mark victims busy without a real connection |
| Client-supplied geolocation | Low | `POST /api/join` | Dot can be placed anywhere (expected tradeoff for anonymous app) |

**Existing controls that held (no change needed):**

- Prisma parameterized queries — no SQL injection surface.
- React text rendering for chat — no stored/reflected XSS on message display.
- Signal type allowlist + 64 KB payload cap on `/api/signal`.
- Lat/lng bounds validation on join.

---

### Security changes applied

#### Session binding (`lib/session.ts`)

- `POST /api/join` issues a random per-tab session token and stores only its SHA-256 hash in `Presence.authTokenHash`.
- `GET /api/poll`, `POST /api/signal`, and `POST /api/leave` authenticate via `x-pulse-session-id` / `x-pulse-session-token`; the old HttpOnly cookie path is kept as a fallback.
- `fromId` on signal and `id` on leave must match the authenticated session or the request is rejected (403).
- Poll identity is derived from authenticated session state — removed client-supplied `?id=` parameter.

#### Client session support (`lib/api.ts`, `app/page.tsx`)

- `join()` stores the returned session token in per-tab `sessionStorage`.
- `poll()`, `sendSignal()`, and `leave()` send the session id/token headers.
- `leave()` uses `fetch(..., { keepalive: true })` instead of `sendBeacon`, because beacon cannot attach the required auth headers.

#### Signal authorization (`app/api/signal/route.ts`)

- `accept` / `decline` require a pending `request` row in the DB for that peer pair.
- `request` rows are **not** deleted on poll delivery (other signal types still are) so the server can verify accept/decline.
- Pending `request` rows are cleaned up on `accept`, `decline`, or `end`.
- Requester blocked from sending `request` while already `busy`.

#### Rate limiting (`lib/rate-limit.ts`)

- Best-effort in-memory limits per IP / session (per serverless instance):
  - join: 10/min per IP
  - poll: 120/min per session + IP
  - signal: 60/min per session + IP
  - leave: 20/min per session
- Returns 429 with `Retry-After` when exceeded.

#### Session prerequisites

- Run `npx prisma db push` after pulling these changes so the database has `Presence.authTokenHash`.
- Run `npx prisma generate` after schema changes before building or deploying.
- Browser testing requires `sessionStorage` and same-origin requests so the per-tab token can be stored and sent as custom headers.
- Two participants can now be tested in two tabs/windows in the same browser profile, but using separate profiles or incognito still helps avoid cached state while debugging.

---

### Files touched

| File | Change |
|------|--------|
| `lib/session.ts` | New — per-tab token auth, cookie fallback, session validation, client IP |
| `lib/rate-limit.ts` | New — in-memory rate limiter |
| `app/api/join/route.ts` | Issue per-tab session token; set fallback cookie; rate limit |
| `app/api/poll/route.ts` | Authenticated poll; scoped heartbeat; retain `request` signals on drain |
| `app/api/signal/route.ts` | Authenticated signal relay; authorization rules; busy on `end`; rate limit |
| `app/api/leave/route.ts` | Authenticated leave; id must match session; rate limit |
| `lib/api.ts` | Per-tab token storage; auth headers; poll without id param |
| `app/page.tsx` | Updated `poll()` call |
| `lib/webrtc.ts` | Chat envelope fix; apply remote SDP before queued ICE candidates |
| `prisma/schema.prisma` | Added `Presence.authTokenHash` for per-tab session auth |

---

### Still open after Phase 1

- npm audit moderate transitive deps (deferred — breaking upgrade path).
- Rate limiter is per-instance only on Vercel serverless; a shared store (Redis/KV) would be needed for fleet-wide enforcement.

---

## Phase 2

### UI/UX changes

- Refreshed dark UI: Geist typography, elevated surfaces, emerald accent, clearer spacing and hierarchy.
- Entry gate: card-based onboarding with clearer privacy copy and accessible error states.
- Live map: loading overlay, onboarding hint, online count, larger peer touch targets, busy/disabled labels.
- Chat: mobile bottom sheet + desktop side panel; labeled input; shared `Button` component.
- Connection/video prompts: accessible dialog semantics, focus management, Escape to decline.
- Status banners and video overlay: `aria-live` regions, focus-visible rings, reduced-motion support.
- Component layout: shared UI in `components/ui/`, feature templates in `components/templates/`.

### Design rationale

- Keep the map as the primary surface; overlays should feel temporary and non-blocking on mobile.
- Prioritize trust and clarity for anonymous use: privacy copy, connection states, and non-color busy cues.
- Accessibility improvements (dialogs, labels, touch targets, live regions) were treated as part of polish, not a separate pass.

### Trade-offs

- No new UI library — Tailwind-only to avoid dependency bloat; less animation/theming flexibility than a full design system.
- Map-first interaction remains hard for keyboard users; no separate peer list yet.
- Dialog focus trapping is lightweight (no dedicated focus-trap library).
- `EntryGate` and `ConnectionPrompt` still live under `app/components/`; only larger templates were moved to `components/templates/`.
