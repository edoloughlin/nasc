---
layout: default
title: Server Integration
nav_order: 7
---

# Server Integration

Nasc keeps server code straightforward: provide handlers that return plain objects, plug them into the reference Express integration (or your own runtime), and let the framework stream patches. This section mirrors the integration deep dives you would expect in the htmx docs.

## Minimal Express Setup

```js
const express = require('express');
const http = require('http');
const { attachNasc } = require('packages/nasc-server');

const app = express();
const server = http.createServer(app);
const handlers = { User: require('./handlers/user') };
const schemaProvider = require('./schemas/app.schema.json').$defs;

attachNasc({ app, server, handlers, schemaProvider, ssr: { rootDir: __dirname } });
server.listen(3000);
```

`attachNasc` wires together transports, schema endpoints, SSR middleware, and optional persistence in one call. It expects an Express app and HTTP server; otherwise it throws a descriptive error.【F:packages/nasc-server/index.js†L186-L288】

## How `attachNasc` Works

1. **Create shared state.** Instantiates a `MemoryStore` (or your custom store) and a `processMessage` function shared by SSE and WebSocket transports.【F:packages/nasc-server/index.js†L186-L273】
2. **Ensure dependencies.** Lazily `require('express')` and throw a helpful message if it is missing so workspace installations stay consistent.【F:packages/nasc-server/index.js†L199-L205】
3. **Serve assets.** Mounts JSON body parsing, serves `nasc.js`, and optionally serves a static root directory for SSR’d HTML pages.【F:packages/nasc-server/index.js†L207-L217】
4. **Expose transports.** Registers `/nasc/stream` and `/nasc/event` for SSE (plus legacy aliases) and optionally spins up WebSockets if the `ws` dependency is available.【F:packages/nasc-server/index.js†L218-L278】
5. **SSR middleware.** If you pass `ssr.rootDir`, Nasc parses your HTML, calls `mount()` for each instance, and injects initial values before sending the response.【F:packages/nasc-server/index.js†L280-L317】
6. **Observability.** Publishes `/nasc/manifest` so you can inspect handlers at runtime and logs the mapping during startup.【F:packages/nasc-server/index.js†L252-L266】

## Custom Stores

The default `MemoryStore` is in-memory only. Implement your own store by providing objects with `load(type, id)` and `persist(type, id, diff, full)` functions. The SQLite adapters included with the repo follow the same contract and can serve as inspiration.【F:README.md†L74-L92】【F:packages/nasc-server/engine.js†L3-L58】【F:packages/nasc-server/index.js†L322-L327】

When events run, `applyEvent` diffs the current and next state, logs the persistence plan, and invokes your store’s `persist` method unless the call is a dry run.【F:packages/nasc-server/engine.js†L16-L58】 This makes it easy to wrap operations in transactions or replicate changes to external systems.

## Alternative Integrations

If you are not using Express, build your own transport layer with `createProcessor`:

```js
const { createProcessor, MemoryStore } = require('packages/nasc-server');
const store = new MemoryStore();
const processMessage = createProcessor(handlers, store, { schemaProvider });

// Feed messages from your framework of choice
const patches = await processMessage({ event, instance, payload });
```

The processor is transport-agnostic: send it messages, forward the resulting patches back to the client, and persist using the provided store.【F:packages/nasc-server/index.js†L12-L143】

## SSR Deep Dive

The SSR middleware inspects HTML responses before sending them to the browser:

1. Parse each `na-instance` attribute.
2. Call `mount()` to fetch initial state.
3. Replace matching `na-bind` inner text and `<input name>` values with the returned data.

This primes the DOM so the page renders meaningful content before the client connects, enabling progressive enhancement.【F:packages/nasc-server/index.js†L290-L317】

## Handler Manifest Endpoint

Hit `/nasc/manifest` during development to verify that your HTML events match server methods. The payload looks like:

```json
{
  "User": { "events": ["save_profile"], "hasMount": true }
}
```

Keep this endpoint behind authentication if you expose it in production; it reveals which events are available for each type.【F:packages/nasc-server/index.js†L252-L341】

## Deployment Checklist

- Install runtime dependencies (`express`, optionally `ws`) at the workspace root so `packages/nasc-server` can resolve them.【F:README.md†L48-L55】【F:packages/nasc-server/index.js†L199-L278】
- Terminate HTTPS at your load balancer or proxy and forward requests to the Node server; both SSE and WebSockets work through standard reverse proxies when properly configured.
- Configure process managers (PM2, systemd, Docker) to restart on crashes. `applyEvent` logs the payload and diff to help you diagnose issues quickly.【F:packages/nasc-server/engine.js†L35-L58】

With these building blocks you can host Nasc in Express, wrap it in your framework of choice, or embed the processor inside an existing server architecture.
