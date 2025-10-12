---
layout: default
title: Quick Start
nav_order: 2
---

# Quick Start

This walkthrough spins up the demo application, explains how HTML `na-*` attributes map to server handlers, and points you to the next steps for building your own feature. It mirrors the storytelling pace of the htmx docs so you can skim, copy, and adapt.

## Prerequisites

- Node.js 18 or newer
- [pnpm](https://pnpm.io/) (recommended) or npm
- A terminal session inside the repository root

These requirements match the reference demo shipped with the repo.

## Install & Run the Demo

```bash
pnpm install    # install workspace dependencies at the repo root
cd demo
pnpm start      # boots the Express server on http://localhost:3000
```

Open `http://localhost:3000/app.html` in your browser. The `<body na-connect>` hook auto-connects the client to the backend, mounts each declared instance, and begins streaming DOM patches.

### Choose a Transport

SSE is the default transport. Append `?transport=ws` to try WebSockets or `?transport=sse` to force SSE. The demo even includes a transport picker so you can observe fallback behavior without editing code.

> **WebSocket optionality** – If the `ws` dependency is missing, Nasc logs a notice and continues in SSE-only mode. Install `ws` at the workspace root when you need bidirectional messaging so that `packages/nasc-server` can resolve it.

## Understand the HTML ↔ Handler Contract

Every interactive region is wrapped in `na-instance="Type:id"`. Inside that container:

- `na-bind="prop"` displays state from the instance.
- `na-submit="event"` on a form converts `FormData` into the event payload.
- `na-click="event"` on a button gathers `data-*` attributes (e.g., `data-id`).
- `<template na-each="items" na-key="id">` repeats list items with keyed diffing.

Here is the profile section from the demo page:

```html
<div class="card" na-instance="User:currentUser">
  <h2>Hello, <span na-bind="name">Guest</span></h2>
  <p>Email: <strong na-bind="email"></strong></p>
  <form class="form" na-submit="save_profile">
    <input class="input" name="name" placeholder="Your name" />
    <input class="input" name="email" type="email" placeholder="you@example.com" />
    <button class="btn" type="submit">Save profile</button>
  </form>
</div>
```

When the form submits, the client emits:

```json
{
  "event": "save_profile",
  "instance": "User:currentUser",
  "payload": { "name": "…", "email": "…" }
}
```

The server routes that payload to `handlers['User'].save_profile` and diffs the returned state. Each changed property becomes a `{ action: "bindUpdate", prop, value }` patch that updates matching `na-bind` and `name` attributes in the DOM.

## Scaffold Your Own Feature

1. **Create markup.** Add a new `na-instance="Feature:some-id"` container with the binds and events you need. Use the [Template Attributes Reference](./attributes) as a checklist.
2. **Add a handler.** Export an object with a `mount()` method plus one function per event name (e.g., `save`, `archive`). Return the next state from each event handler.
3. **Register the handler.** Pass your handler into `attachNasc({ handlers })` or `createProcessor()` so the server knows how to process events.
4. **(Optional) Define schema.** Provide JSON Schema via `schemaProvider` to unlock validation overlays and typed hints. See [Schemas & Validation](./schemas).

Restart the server or hot-reload as needed, then exercise the UI. Within seconds you can iterate on new features while the framework handles transports, state diffs, and DOM patching for you.

## Workspace Tips

- Install shared runtime dependencies (like `express` or `ws`) at the repository root so the `packages/nasc-server` code can `require()` them.
- Use pnpm filters to avoid directory changes: `pnpm --filter nasc-demo start`.
- Keep `nasc.js` served statically by mounting `attachNasc` or copying the file into your own build pipeline.

You are now ready to explore the deeper concepts that make Nasc tick.
