---
layout: default
title: Overview
nav_order: 1
permalink: /
---

# Nasc Documentation

Nasc is a "live HTML" framework that keeps your markup simple while letting the server drive state and logic. It streams DOM updates from the backend to the browser over Server-Sent Events (SSE) by default and can transparently upgrade to WebSockets for bidirectional scenarios.【F:README.md†L1-L70】

## Why Nasc?

- **Minimal client footprint.** The browser loads a generic `nasc.js` client that knows how to bind data, patch the DOM, and validate schemas—nothing more.【F:README.md†L15-L37】【F:packages/nasc-client/nasc.js†L1-L205】
- **Server-owned state.** Each HTML container declares an `na-instance="Type:id"`; the matching server handler performs all business logic and emits diffs that become DOM patches.【F:README.md†L56-L70】【F:packages/nasc-server/index.js†L12-L121】
- **Transport flexibility.** SSE is the default, but you can opt into WebSockets per page or URL query parameter without rewriting templates.【F:README.md†L56-L66】【F:packages/nasc-client/nasc.js†L238-L320】
- **Schema-aware safety.** JSON Schemas stream from the server during mount so the client can validate bindings, highlight mistakes, and help you catch regressions early.【F:packages/nasc-server/index.js†L26-L85】【F:packages/nasc-client/nasc.js†L13-L214】

## Documentation Map

| Section | What you will find |
| --- | --- |
| [Quick Start](./quick-start) | Spin up the demo, wire a page to handlers, and deploy.
| [Core Concepts](./core-concepts) | Learn how instances, bindings, events, and diffs interact.
| [Template Attributes Reference](./attributes) | Detailed behavior for every `na-*` attribute.
| [Event & Transport Model](./events-and-transports) | Understand how SSE/WS streams, payloads, and fallbacks work.
| [Schemas & Validation](./schemas) | How JSON Schema powers runtime validation and tooling.
| [Server Integration](./server-integration) | Use `attachNasc`, SSR middleware, and custom stores.
| [Persistence & Stores](./persistence) | Implement the store contract or plug in SQLite adapters.
| [Debugging & Tooling](./debugging) | Tips for tracing patches, schema overlays, and manifests.
| [Examples & Recipes](./recipes) | Patterns distilled from the bundled demo app.
| [FAQ](./faq) | Answers to the most common architectural questions.

> **Tip:** If you are new to "hypermedia driven UI", spend five minutes with [Quick Start](./quick-start) and then skim [Core Concepts](./core-concepts). The remaining sections dive deeper into specific tasks inspired by the htmx documentation flow.

## Project Structure Recap

Nasc currently ships as a monorepo with a reusable client/server pair and a demo app that showcases end-to-end wiring.【F:README.md†L21-L38】

```
packages/
  nasc-client/     # Browser runtime (nasc.js)
  nasc-server/     # Express-friendly reference server

demo/              # Example application with handlers, schemas, and HTML
```

Use pnpm from the repository root to install dependencies and run the demo app while you experiment with the code samples in this guide.【F:README.md†L39-L55】

## Next Steps

1. Head to [Quick Start](./quick-start) to run the demo and scaffold your first page.
2. Read [Core Concepts](./core-concepts) to understand how mounts, events, and patches fit together.
3. Bookmark [Template Attributes Reference](./attributes) for day-to-day development.

Happy building!
