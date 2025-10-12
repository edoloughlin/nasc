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
2. **Add a handler.** Export an object with a `mount()` method plus one function per event name (e.g., `save`, `archive`). Return the next state from each event handler. Following the convention in the demo, you would create a `handlers/feaure.ts` file and export a `Feature` object.
3. **Register the handler.** Pass your handler into `attachNasc({ handlers })` or `createProcessor()` so the server knows how to process events.
4. **(Optional) Define schema.** Provide JSON Schema via `schemaProvider` to unlock validation overlays and typed hints. Following the demo convention, you would add a `Feature` property to the `$defs` object in `schemas/app.schema.json`. See [Schemas & Validation](./schemas).

Demo convention: instance → schema → handler

- `na-instance="Feature:some-id"`: The left side (`Feature`) is the feature type; the right side (`some-id`) is the instance key.
- `schemas/app.schema.json`: The demo defines reusable types under `"$defs"` (e.g., `"$defs".Feature`). The left side of `na-instance` (`Feature`) maps to that type definition; the right side (`some-id`) is an instance identifier used at runtime (seeded by `mount`, a store, or fixtures), not enumerated in the schema.
- `schemas/app.mapping.json` (optional): Maps feature types to backing stores/entities (e.g., table name and primary key). This influences where `some-id` is looked up, not the JSON Schema shape.
- `handlers/feature.ts`: By convention, the feature type name maps to a TypeScript file of the same name that exports a `Feature` interface for state shape and a default handler implementation for events.

Example HTML

```html
<section class="card" na-instance="Feature:some-id">
  <h3><span na-bind="title">Untitled</span></h3>
  <button class="btn" na-click="archive">Archive</button>
  <form na-submit="rename">
    <input name="title" placeholder="New title" />
    <button type="submit">Save</button>
  </form>
  <p>Status: <strong na-bind="status"></strong></p>
  <template na-each="items" na-key="id">
    <li><span na-bind="label"></span></li>
  </template>
</section>
```

Example schema type (schemas/app.schema.json)

```json
{
  "$id": "/schemas/app.schema.json",
  "$defs": {
    "Feature": {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "status": { "type": "string", "enum": ["active", "archived"] },
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string" },
              "label": { "type": "string" }
            },
            "required": ["id", "label"]
          }
        }
      },
      "required": ["title", "status"]
    }
  }
}
```

Example handler (handlers/feature.ts)

```ts
// State shape used by this feature instance
export interface Feature {
  title: string;
  status: 'active' | 'archived';
  items: { id: string; label: string }[];
}

// Default export implements lifecycle + event handlers
const Feature = {
  mount(id: string): Feature {
    return { title: `Feature ${id}`, status: 'active', items: [] };
  },

  rename(state: Feature, input: { title: string }): Feature {
    return { ...state, title: input.title };
  },

  archive(state: Feature): Feature {
    return { ...state, status: 'archived' };
  }
};

export default Feature;
```

With this convention, the `Feature` part of `na-instance` links to `handlers/feature.ts` (for behavior) and to `"$defs".Feature` in `schemas/app.schema.json` (for shape/validation). The `some-id` portion is the instance identifier used by your handler’s `mount`, in-memory state, or backing store (optionally guided by `schemas/app.mapping.json`). The runtime does not require TypeScript, but exporting a `Feature` interface helps keep handlers and templates in sync.

Restart the server or hot-reload as needed, then exercise the UI. Within seconds you can iterate on new features while the framework handles transports, state diffs, and DOM patching for you.

## Workspace Tips

- Install shared runtime dependencies (like `express` or `ws`) at the repository root so the `packages/nasc-server` code can `require()` them.
- Use pnpm filters to avoid directory changes: `pnpm --filter nasc-demo start`.
- Keep `nasc.js` served statically by mounting `attachNasc` or copying the file into your own build pipeline.

You are now ready to explore the deeper concepts that make Nasc tick.
