# SSE First, WebSocket Optional: Migration and Dual-Transport Plan

This document proposes switching Nasc’s default transport to Server‑Sent Events (SSE) for server→client patches, while keeping WebSockets available for specific interactive features and as an upgrade path. It outlines goals, design, concrete changes, phased rollout, and acceptance criteria for this repo.

## Goals

- Simpler, more robust default: server→client via SSE; client→server via HTTP POST.
- Preserve bidirectional capability when needed via optional WebSockets.
- Keep the existing message schema (events, patches) to minimize churn.
- Support per-feature/per-instance transport selection (SSE by default, WS where it matters).
- Improve operability: auto‑reconnect, better proxy/CDN compatibility, explicit HTTP logs.

## Current State (Repo)

- Server: `demo/index.ts` (compiled to `dist/index.js`) uses Express + `ws`; `packages/nasc-server/index.js` processes events and returns JSON patches over WS.
- Client: `packages/nasc-client/nasc.js` opens a WebSocket to send events (`mount`, `na-submit`, `na-click`) and apply `bindUpdate` patches.
- Traffic pattern: low frequency, discrete events; patches are small JSON objects; no broadcast/fanout yet.

## Target Design Overview

- Transport abstraction in the client so we can plug multiple transports.
  - `SSETransport` (default): receive patches via `EventSource` (`GET /events`), send events via `fetch` POST (`POST /event`).
  - `WSTransport` (optional): existing WebSocket path.
- Server exposes both:
  - `GET /events` (SSE stream) + client registry keyed by `clientId`.
  - `POST /event` handling `{ event, instance, payload, clientId, eventId }` and queuing patches to that client’s SSE stream.
  - Keep current WS server; optionally share handler logic and message shape.
  - `GET /nasc/schema/:type` mounted automatically by NascServer when provided a `schemaProvider` and an Express `app` (no endpoint code needed in apps).
- Message shape:
  - Events: `{ event, instance, payload, eventId? }`.
  - Patches: `[{ action: "schema", type, instance, schema }, { action: "bindUpdate", instance, prop, value }, …] | [{ action: "error", message }]`.
- Identity and reconnection:
  - `clientId` issued by server (cookie) or generated client‑side and sent as a header/query param for `GET /events` and in `POST /event`.
  - SSE uses `Last-Event-ID` and server can emit `id: <eventId>` for at‑least‑once semantics.

## Server Changes (Express)

1. Add SSE endpoint
   - `GET /events`: sets headers `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.
   - Keep connection open; store writer in `clients[clientId]`.
   - Send keepalive comments `:\n\n` every 15–25s to avoid idle timeouts.
   - On `close`, cleanup registry.

2. Add Event endpoint
   - `POST /event`: parse JSON `{ event, instance, payload, eventId? }` + infer `clientId` from cookie/header/body.
   - Route to existing `NascServer` logic: `applyEvent` → `diff` → `patches`.
   - If client has an active SSE stream, write patches via `sendSse(clientId, patches, eventId?)`.
   - If not connected, optionally buffer briefly or return 409/202 (non‑blocking is acceptable for MVP).

3. Shared message format
   - Extract patch serialization to a helper used by both SSE and WS paths to avoid drift.

4. Optional WS coexistence
   - Keep existing `WebSocketServer` hookup; it uses the same `NascServer` handler.
   - Allow selecting WS per route/feature without affecting SSE path.

Files to touch:
- `demo/index.ts` (add routes and client registry)
- `packages/nasc-server/index.js` (factor patch sending, remain transport‑agnostic)

## Client Changes (nasc.js)

1. Introduce a minimal transport layer
   - Interface: `{ connect(onPatches), send(event) , close() }`.
   - Implement `SSETransport`:
     - `EventSource('/events?clientId=…')` → `onmessage` parse JSON → `onPatches(patches)`.
     - `send` uses `fetch('/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ... }) })`.
     - Handle automatic reconnect (native), and backoff for `send` failures.
   - Keep `WSTransport` using current logic.

2. Transport selection
   - Default: SSE.
   - Global override: `connect({ transport: 'ws' | 'sse' | 'auto' })` where `auto` prefers WS only if a feature requests it.
   - Per‑instance override: allow `na-transport="ws|sse|inherit"` on `na-scope` containers; the client chooses WS if any active instance requests WS.

3. Identity
   - Generate/stash a `clientId` in `localStorage` and append to `/events` + include in POST body.
   - Optionally accept a server‑issued cookie.

Files to touch:
- `packages/nasc-client/nasc.js` (refactor to pluggable transports, default SSE)
- `demo/*.html` (optional: show `na-transport` example)

## Protocol Notes

- SSE framing: each message is a single JSON array of patches written as `data: <json>\n\n`. Optionally include `id: <eventId>` for resume.
- Keep WS payloads identical (array of patches). No protocol forks.
- Keep patch actions the same (`bindUpdate`, `error`).

## Migration Phases

Phase 0 — Prep (no behavior change)
- Define `clientId` handling helper (cookie or localStorage) in client.
- Extract common patch serialization on server.

Phase 1 — Add SSE alongside WS (behind flag)
- Implement `GET /events` and `POST /event` in `demo/index.ts`.
- Add `SSETransport` in client and a feature flag to opt‑in (`?transport=sse` or `window.NASC_USE_SSE`).
- Verify user and todo demos work end‑to‑end over SSE.

Phase 2 — Make SSE the default
- Switch client default to SSE; keep WS selectable via flag.
- Update README and demo pages.

Phase 3 — Per‑feature WS upgrades
- Add `na-transport` attribute support.
- Demonstrate a feature that benefits from WS (e.g., keystroke echo, presence) using `WSTransport` only for that instance.

Phase 4 — Clean up and harden
- Add keepalive tuning, backoff, and small offline queue for POSTs.
- Document observability: include `eventId` in logs and patches; map `Last-Event-ID`.
- Write contract tests for both transports (same inputs → same patches).

## Acceptance Criteria

- Both transports produce identical patches for the same event flow in demos.
- Default path with no flags uses SSE, including auto‑reconnect.
- Per‑instance `na-transport="ws"` forces WS connection when present.
- Server supports both `/events` SSE and existing WS with shared handler logic.
- README updated with transport guidance and tradeoffs.

## Operational Considerations

- Keepalives: SSE sends comment pings; WS uses ping/pong if needed. Tune under LB idle timeouts.
- Timeouts: Increase server keepalive headers; disable proxy buffering for SSE if necessary.
- Auth/CSRF: Use cookies/sessions for SSE; include CSRF token in POST; validate `Origin`/`Referer`.
- Backpressure: POST is naturally back‑pressured; SSE relies on TCP; keep patches small, batch when busy.
- Fanout: For future multi‑client updates, iterate over `clients` registry and write the same SSE frame.

## When To Prefer WebSockets (In Nasc)

- High‑frequency bidirectional interactions (typing-level collaboration, presence, whiteboards).
- Binary payloads or ultra‑compact custom frames.
- Multiplexing multiple logical channels with custom flow control.

## Future Work

- Transport negotiation (`auto`): detect WS support/health and prefer it for WS‑requested instances.
- Headless test harness that runs events through both transports to assert patch equality.
- Optional message signing (HMAC) for edge‑cached SSE.

## Concrete Next Steps (Short List)

1. Server: add `/events` and `/event` to `demo/index.js`; simple in‑memory `clients` map. ✔ Implemented
2. Client: introduce `SSETransport`; refactor `connect()` to accept `{ transport }`. ✔ Implemented
3. Default to SSE; keep WS transport in codebase. ✔ Implemented
4. Add `?transport=ws|sse` query toggle. ✔ Implemented
5. Add `na-transport` attribute per instance. ✖ Deferred (see below)
6. Update README with usage and troubleshooting. ✔ Implemented

## Current Implementation Status

- Server
  - `GET /events` SSE endpoint with keepalives and client registry. ✔
  - `POST /event` intake, uses shared processor to produce patches. ✔
  - WebSocket server retained and shares the same store/processor. ✔

- Client
  - Dual transports: SSE (default) and WebSocket. ✔
  - `connect()` without args uses SSE; `connect({ transport: 'ws' })` forces WS. ✔
  - URL toggle: `?transport=ws|sse` overrides default unless explicitly set in code. ✔
  - Receives schema via a `schema` action on mount; caches in `window.__NASC_SCHEMAS` for tooling. ✔
  - Single transport per page/client; per‑instance transport selection is not supported. ✔

- Message shape
  - Unchanged: events via JSON, patches as arrays of `{ action, instance, prop, value }`. ✔

## Per‑Instance Transport (Not Supported)

Current policy
- Use a single transport per page/client (chosen by code or `?transport=`). All `na-scope` scopes on a page share that transport.
- Do not mix transports per instance for now. If multiple components bind to the same instance, they implicitly share the page’s transport.

Rationale
- Keeps ordering simple (per‑instance FIFO on one channel) and avoids duplicate or out‑of‑order patches.
- Minimizes client/server coordination and eliminates the need for dedupe logic.

If we ever enable per‑instance transports (future)
- Server
  - Track subscriptions: `clientId -> instance -> transport` and route patches to exactly one transport per instance per client.
  - Identify WS connections by `clientId` (e.g., query string) similar to SSE.
  - Implement fallback: on WS close, optionally route that instance to SSE.
- Client
  - Resolve transport per instance (e.g., future `na-transport`), but coerce all bindings of the same instance to a single chosen transport.
  - Add per‑instance sequence numbers (`seq`) to apply patches idempotently and drop duplicates/stale.
  - Health checks and downgrade/upgrade paths between transports.
- Testing
  - Contract tests to guarantee identical patches over SSE/WS.
  - Fault injection to validate fallback and ordering guarantees.
