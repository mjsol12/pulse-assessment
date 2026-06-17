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

| Issue                        | Severity | Endpoints          | Impact                                                                         |
| ---------------------------- | -------- | ------------------ | ------------------------------------------------------------------------------ |
| No session ownership (IDOR)  | Critical | all four routes    | Impersonate any user, drain mailboxes, force disconnects, spoof WebRTC signals |
| Global poll heartbeat        | High     | `GET /api/poll`    | Keeps all ghost sessions alive; breaks privacy + availability                  |
| Unauthenticated signal relay | High     | `POST /api/signal` | Harassment, signaling injection, busy-state manipulation                       |
| No rate limiting             | Medium   | all routes         | Signal/mailbox spam, DB write pressure                                         |
| Busy-state manipulation      | Medium   | `POST /api/signal` | Fake `accept` could mark victims busy without a real connection                |
| Client-supplied geolocation  | Low      | `POST /api/join`   | Dot can be placed anywhere (expected tradeoff for anonymous app)               |

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

| File                      | Change                                                                     |
| ------------------------- | -------------------------------------------------------------------------- |
| `lib/session.ts`          | New — per-tab token auth, cookie fallback, session validation, client IP   |
| `lib/rate-limit.ts`       | New — in-memory rate limiter                                               |
| `app/api/join/route.ts`   | Issue per-tab session token; set fallback cookie; rate limit               |
| `app/api/poll/route.ts`   | Authenticated poll; scoped heartbeat; retain `request` signals on drain    |
| `app/api/signal/route.ts` | Authenticated signal relay; authorization rules; busy on `end`; rate limit |
| `app/api/leave/route.ts`  | Authenticated leave; id must match session; rate limit                     |
| `lib/api.ts`              | Per-tab token storage; auth headers; poll without id param                 |
| `app/page.tsx`            | Updated `poll()` call                                                      |
| `lib/webrtc.ts`           | Chat envelope fix; apply remote SDP before queued ICE candidates           |
| `prisma/schema.prisma`    | Added `Presence.authTokenHash` for per-tab session auth                    |

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
- **Chat panel enter/exit transitions** — opening a connection now animates the chat UI in and out instead of popping in instantly (see below).
- Connection/video prompts: accessible dialog semantics, focus management, Escape to decline.
- Status banners and video overlay: `aria-live` regions, focus-visible rings, reduced-motion support.
- Component layout: shared UI in `components/ui/`, feature templates in `components/templates/`.

### Chat panel transitions

When a connection starts or ends, the chat panel no longer mounts/unmounts instantly. `ChatPanel` takes an `open` prop from `app/page.tsx` (`open={inChat}`) and drives a two-phase show/hide:

1. **Open** — `requestAnimationFrame` sets `mounted` (panel enters the DOM), then a second frame sets `visible` so CSS can transition from the closed state.
2. **Close** — `visible` flips false first; `onTransitionEnd` unmounts after the animation completes so the exit is visible.

State is exposed on the root `<section>` as `data-state="open" | "closed"` and `aria-hidden` when closed. Styles live in `app/globals.css` under `.chat-panel`:

| Viewport         | Closed                                               | Open                           |
| ---------------- | ---------------------------------------------------- | ------------------------------ |
| Mobile (`< md`)  | `translateY(100%)` + fade — slides down off-screen   | `translateY(0)` + full opacity |
| Desktop (`≥ md`) | `translateX(100%)` + fade — slides in from the right | `translateX(0)` + full opacity |

Timing: 320ms transform (`cubic-bezier(0.32, 0.72, 0, 1)`), 240ms opacity. Closed panels use `pointer-events: none` so they do not block map taps during the exit animation.

**Reduced motion:** the global `prefers-reduced-motion: reduce` block shortens all transitions/animations to ~0ms, so the panel still opens and closes functionally without sliding.

**Files:** `components/templates/chat-panel.tsx` (mount/visible lifecycle), `app/globals.css` (`.chat-panel` rules), `app/page.tsx` (`open` wiring).

### Design rationale

- Keep the map as the primary surface; overlays should feel temporary and non-blocking on mobile.
- Prioritize trust and clarity for anonymous use: privacy copy, connection states, and non-color busy cues.
- Accessibility improvements (dialogs, labels, touch targets, live regions) were treated as part of polish, not a separate pass.

### Trade-offs

- No new UI library — Tailwind-only to avoid dependency bloat; less animation/theming flexibility than a full design system.
- Chat transitions are CSS-only (no motion library); enter/exit timing is fixed rather than gesture-driven.
- Map-first interaction remains hard for keyboard users; no separate peer list yet.
- Dialog focus trapping is lightweight (no dedicated focus-trap library).
- `EntryGate` and `ConnectionPrompt` still live under `app/components/`; only larger templates were moved to `components/templates/`.

---

## Phase 3

### Architectural optimization (coordination API)

Before deepening the security review, the four coordination routes were refactored into a thin-handler / service / data-access layout so authorization and state rules are easier to audit and change in one place.

#### Problem

`app/api/poll/route.ts` and `app/api/signal/route.ts` each carried ~100+ lines of Prisma calls, validation, and business rules inline. That made Phase 3 review noisy: HTTP wiring, DB access, and security policy were interleaved, and the same Prisma patterns were duplicated across routes.

#### Layering

| Layer          | Role                         | Modules                                          |
| -------------- | ---------------------------- | ------------------------------------------------ |
| Route handlers | Auth, rate limits, JSON I/O  | `app/api/{join,leave,poll,signal}/route.ts`      |
| Services       | Orchestration and policy     | `lib/services/poll.ts`, `lib/services/signal.ts` |
| Data access    | Prisma only, no HTTP         | `lib/db/presence.ts`, `lib/db/signal.ts`         |
| Utils          | Parsing and shared constants | `lib/utils/signal.ts`                            |

Routes now delegate after `requireSession` / rate limiting; services own heartbeat + reap, mailbox drain, busy transitions, and signal authorization checks.

#### What moved where

- **Presence** — join upsert, heartbeat, stale reap, peer listing, busy flags, session cleanup → `lib/db/presence.ts`
- **Signals** — inbox drain, TTL reap, pending-request lookup, lifecycle cleanup → `lib/db/signal.ts`
- **Poll loop** — heartbeat → reap → parallel peer list + mailbox drain → `lib/services/poll.ts`
- **Signal delivery** — busy checks, pending-request gate, lifecycle ordering → `lib/services/signal.ts`
- **Input validation** — type allowlist, payload cap, session id checks → `lib/utils/signal.ts`
- **Session auth** — token hash lookup now goes through `presenceDb.findAuthTokenHash` in `lib/session.ts`

#### Behavioral notes (unchanged contract)

- No public API or client changes; same endpoints, status codes, and JSON shapes.
- Independent deletes remain (no transactions) — still required for PgBouncer / serverless poolers.
- Lifecycle signals (`accept` / `decline` / `end`) are **delivered before** the pending `request` row is deleted so the recipient always receives the resolution event used for server-side authorization.

#### Why this helps Phase 3

- Security rules for signaling live in `deliverSignal()` instead of being scattered through a route file.
- DB surface area is named (`drainInbox`, `deletePendingBetween`, `setBusyForPeers`) — easier to grep during review.
- Services can be unit-tested without mocking Next.js request objects.
- Future hardening (shared rate-limit store, stricter validation, audit logging) has clear insertion points.

#### Files touched

| File                      | Change                                             |
| ------------------------- | -------------------------------------------------- |
| `lib/db/presence.ts`      | New — presence CRUD and queries                    |
| `lib/db/signal.ts`        | New — signal mailbox and lifecycle queries         |
| `lib/services/poll.ts`    | New — poll orchestration                           |
| `lib/services/signal.ts`  | New — signal delivery and authorization            |
| `lib/utils/signal.ts`     | New — body parsing and signal constants            |
| `lib/session.ts`          | Auth lookup via presence db module                 |
| `app/api/join/route.ts`   | Thin handler → `presenceDb.upsertOnJoin`           |
| `app/api/leave/route.ts`  | Thin handler → db cleanup helpers                  |
| `app/api/poll/route.ts`   | Thin handler → `getPollResponse`                   |
| `app/api/signal/route.ts` | Thin handler → `parseSignalBody` + `deliverSignal` |

### Client route code-splitting

Full layout and diagrams: [docs/project-structure.md](docs/project-structure.md).

- Slimmed `app/page.tsx` to gate orchestration only (`phase`, `sessionId`, `join`); live session loads via `next/dynamic` after entry.
- New `features/live/` module: `useLiveSession` (polling, WebRTC, signals), `LiveSession` (live UI), `types.ts`.
- Nested dynamic imports defer heavy chunks: `WordMap` (mapbox-gl) on live mount, `VideoPanel` when video is active.
- Live-only UI colocated under `features/live/components/` (`ConnectionPrompt`, `RequestingBanner`, `VideoWaitingBanner`).

**Files:** `app/page.tsx`, `features/live/*`, `app/components/EntryGate.tsx` (gate stays in initial bundle).

---

## Phase 4

### Connection alerts (new feature)

Optional alert tones for incoming connection/video requests and each received chat message, plus desktop notifications when the tab is in the background. Toggles live in the **Alerts** panel (top-right on desktop); preferences persist in `localStorage`. Incoming requests also get an animated prompt, caller dot highlight on the map, and repeating chime until accept/decline.

**Files:** `lib/alerts.ts`, `app/components/AlertSettings.tsx`, `app/components/ConnectionPrompt.tsx`, `app/page.tsx`, `app/globals.css`, `components/templates/world-map.tsx`.
