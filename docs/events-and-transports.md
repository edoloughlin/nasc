---
layout: default
title: Event & Transport Model
nav_order: 5
---

# Event & Transport Model

Inspired by the htmx events narrative, this guide focuses on the contract between browser and server and how transports behave under real-world conditions.

## Message Shape

Every interaction travels as a small JSON envelope:

```json
{
  "event": "save_profile",
  "instance": "User:currentUser",
  "payload": { "name": "Ada" }
}
```

The browser emits this envelope when a user submits a form (`na-submit`) or activates a clickable element (`na-click`).【F:packages/nasc-client/nasc.js†L174-L205】 The server processes the message, computes a diff, and responds with an array of patches:

```json
[
  { "action": "schema", "type": "User", "schema": { … } },
  { "action": "bindUpdate", "instance": "User:currentUser", "prop": "name", "value": "Ada" }
]
```

Errors travel back as `{ action: "error", message }` patches so the client can log them without crashing.【F:packages/nasc-server/index.js†L30-L121】【F:packages/nasc-client/nasc.js†L31-L214】

## Transport Options

Nasc supports two complementary transports:

| Transport | Directionality | Default | Notes |
| --- | --- | --- | --- |
| Server-Sent Events (SSE) | Server → client stream, client → server via POST | Yes | Resilient reconnects, works through proxies, minimal setup. |
| WebSocket | Bidirectional | Optional fallback/opt-in | Useful for high-frequency updates or when SSE is blocked. |

### SSE

- Connection endpoint: `GET /nasc/stream?clientId=…`
- Events POST endpoint: `POST /nasc/event`
- Keeps a `Map` of connected clients to stream patches and heartbeats.【F:packages/nasc-server/index.js†L218-L251】
- Automatically retries on network hiccups; if repeated failures occur before the connection opens, the client can fall back to WebSockets (see below).【F:packages/nasc-client/nasc.js†L531-L588】

Because SSE is unidirectional, the client posts events over HTTP. The server acknowledges with `202 Accepted` and, if patches exist, pushes them over the open stream using the recorded `clientId`.【F:packages/nasc-server/index.js†L218-L251】

### WebSocket

- URL defaults to `ws(s)://<host>` inferred from the current page. You can override by passing `connect({ transport: 'ws', wsUrl })`.
- When available, the server instantiates a `WebSocketServer` and reuses the same `processMessage` function as SSE, so business logic stays identical.【F:packages/nasc-server/index.js†L118-L173】【F:packages/nasc-client/nasc.js†L484-L600】
- If the `ws` package is not installed, the server logs a notice and sticks to SSE-only mode.【F:packages/nasc-server/index.js†L268-L278】

### Fallback Strategy

The client favors SSE. It checks the `transport` option, then the `?transport=` query parameter, and finally defaults to SSE. During connection it counts errors; two failures before `onopen` or a hard close triggers an automatic fallback to WebSockets (if available).【F:README.md†L56-L66】【F:packages/nasc-client/nasc.js†L484-L588】

Set `connect({ transport: 'ws' })` or append `?transport=ws` during development to exercise the WebSocket path manually.【F:README.md†L56-L66】【F:packages/nasc-client/nasc.js†L484-L514】

## Client IDs & Correlation

Each browser session stores a persistent `nascClientId` in `localStorage`. The SSE POST handler includes it so the server knows which open stream to target when returning patches. If `localStorage` is unavailable, the client falls back to a random ID per session.【F:packages/nasc-client/nasc.js†L515-L527】【F:packages/nasc-server/index.js†L218-L251】

## Handler Manifest & Observability

To make it easy to reason about event coverage, the Express integration publishes `/nasc/manifest`, a JSON dictionary mapping each type to the events it exposes and whether it implements `mount`. The server also logs the mapping at startup. Use this to confirm that your template events line up with actual handler methods.【F:packages/nasc-server/index.js†L252-L266】【F:packages/nasc-server/index.js†L329-L341】

## Error Handling

- Unknown handler type: returns an error patch so you can diagnose mismatched `na-instance` values.【F:packages/nasc-server/index.js†L32-L121】
- Unknown event: `applyEvent` throws a descriptive error and stops persistence, preventing silent failures.【F:packages/nasc-server/engine.js†L35-L57】
- Validation overlay: the client warns once for schema mismatches and surfaces unknown properties in the UI.【F:packages/nasc-client/nasc.js†L224-L453】

## Tips for Production

- Keep transport endpoints behind auth; the payloads are plain JSON without extra metadata.
- Stream compression improves SSE performance on large diffs.
- Use health checks that verify `/nasc/stream` responds with event-stream headers.
- Consider heartbeats shorter than 20 seconds (the default) if your infrastructure aggressively closes idle connections.【F:packages/nasc-server/index.js†L218-L241】

With this model in mind, you can debug live interactions quickly and decide which transport best fits your features.
