---
layout: default
title: Debugging & Tooling
nav_order: 9
---

# Debugging & Tooling

Nasc includes built-in diagnostics inspired by the "Debugging" section of the htmx docs. Use them to trace state flow and catch integration mistakes quickly.

## Console Logging

- `nasc.js` logs connection status and validation warnings in development mode.【F:packages/nasc-client/nasc.js†L17-L259】
- The server logs every event application, including the payload, diff, and resulting state, so you can inspect persistence plans in real time.【F:packages/nasc-server/engine.js†L35-L58】
- When transports fail, the client prints informative warnings and falls back automatically where possible.【F:packages/nasc-client/nasc.js†L531-L588】

## Schema Validation Overlay

When schemas are available, the client overlays a red panel listing invalid bindings. Click **Reveal** to scroll to the offending element and highlight it temporarily. Press `Esc` to dismiss the panel.【F:packages/nasc-client/nasc.js†L252-L333】

Tips:

- If you see "Unknown property" warnings, verify your schema and template usage match. Add `na-type` or typed binds to clarify intent.【F:packages/nasc-client/nasc.js†L365-L453】
- Validation runs whenever schemas load, so you can hot-reload pages and get immediate feedback.【F:packages/nasc-client/nasc.js†L352-L482】

## Manifest Endpoint

Visit `/nasc/manifest` to inspect which events each handler exposes and whether it implements `mount`. This endpoint helps track down typos in `na-submit` or `na-click` attributes and should be kept behind auth outside development.【F:packages/nasc-server/index.js†L252-L341】

## Transport Diagnostics

- SSE keeps an internal `clientId` and heartbeats every 20 seconds; check server logs to ensure clients remain connected.【F:packages/nasc-server/index.js†L218-L241】
- Force `?transport=ws` or `?transport=sse` in the URL to exercise each path. Watch the console to confirm which transport is active.【F:README.md†L56-L66】【F:packages/nasc-client/nasc.js†L484-L588】
- If WebSocket initialization fails, the server prints a warning and continues in SSE-only mode.【F:packages/nasc-server/index.js†L268-L278】

## Dry Runs & Testing

Call `applyEvent(handler, event, payload, current, store, type, id, true)` to compute diffs without persisting. This is handy in integration tests when you want to assert on the generated patches before touching a database.【F:packages/nasc-server/engine.js†L35-L58】

During automated tests you can also inject a fake store to capture diffs instead of writing to disk.【F:packages/nasc-server/index.js†L186-L288】

## Troubleshooting Checklist

1. **No patches arriving?** Confirm the instance ID matches between HTML and handler (e.g., `TodoList:my-list`). The server returns an `error` patch if the handler type is unknown.【F:packages/nasc-server/index.js†L30-L121】
2. **Bindings not updating?** Ensure `na-bind` names match the properties your handler returns. Schemas will point to mismatches if enabled.【F:packages/nasc-client/nasc.js†L47-L214】
3. **Events ignored?** Check the manifest and verify the handler exports a function with the same name as the `na-submit`/`na-click` attribute.【F:packages/nasc-server/index.js†L252-L341】
4. **List glitches?** Make sure your templates specify `na-key`. The client logs an error and halts list rendering otherwise.【F:packages/nasc-client/nasc.js†L104-L171】
5. **Transport disconnects?** Inspect reverse proxy timeouts and consider lowering the SSE heartbeat interval if idle connections close too quickly.【F:packages/nasc-server/index.js†L218-L241】

With these tools you can iterate rapidly, keeping your HTML and server handlers in sync without guesswork.
