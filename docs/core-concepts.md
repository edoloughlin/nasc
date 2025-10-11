---
layout: default
title: Core Concepts
nav_order: 3
---

# Core Concepts

This section explains the mental model that powers Nasc. If you understand how instances, mounts, events, and patches collaborate, you can build entire features with plain HTML and server-side functions.

## Instances & State Ownership

Every interactive region declares `na-instance="Type:id"`. The prefix before the colon (`Type`) selects the handler object on the server; the suffix (`id`) identifies which record that handler should load and mutate. Instances scope everything inside—bindings, events, and validation.【F:README.md†L56-L120】【F:packages/nasc-client/nasc.js†L17-L205】

When the client connects it automatically issues a `mount` event for every instance it finds. The payload includes a friendly parameter like `userId` or `todoListId` (derived from the type name) so your handler can hydrate initial state.【F:packages/nasc-client/nasc.js†L17-L29】【F:packages/nasc-server/index.js†L30-L95】

## Mount Lifecycle

The `mount` event is special:

1. The handler’s `mount(params)` function returns the full initial state for the instance.
2. The server persists that state via the configured store.
3. The server emits patches to the client:
   - Optional `schema` patches for the instance type and any child types referenced by `$ref` in arrays.
   - A `bindUpdate` patch for every property in the state object.【F:packages/nasc-server/index.js†L30-L95】
4. The client renders each property into matching `na-bind` elements and list templates; for arrays it performs keyed diffing using the template’s `na-key` attribute.【F:packages/nasc-client/nasc.js†L31-L172】

If the client reconnects later, the server replays the latest state plus schemas so hydration stays consistent.【F:packages/nasc-server/index.js†L70-L95】

## Bindings & Templates

Bindings are declarative connections between DOM nodes and state properties:

- `na-bind="prop"` updates text content or form values when patches arrive.
- `name="prop"` on inputs mirrors the same state, so forms stay in sync after patches.【F:packages/nasc-client/nasc.js†L75-L100】
- `<template na-each="items" na-key="id">` repeats list items and keeps them stable by key. Optional `na-type="Todo"` hints schema inference for nested bindings.【F:packages/nasc-client/nasc.js†L65-L171】【F:README.md†L95-L119】

The client applies keyed diffs, reuses DOM nodes when keys match, and preserves `data-*` attributes so event payloads stay correct.【F:packages/nasc-client/nasc.js†L104-L171】

## Events & Diffs

Two event entry points exist today:

- `na-submit="eventName"` on a form serializes `FormData` into the payload and prevents the default navigation.
- `na-click="eventName"` on a clickable element collects `data-*` attributes into the payload.【F:packages/nasc-client/nasc.js†L174-L205】

The server looks up the handler by type, executes the method matching the event name, and receives the next state object in return. Nasc diffs the previous and new state, persists it with the configured store, and streams `{ action: "bindUpdate", prop, value }` patches back to the browser.【F:packages/nasc-server/index.js†L30-L121】【F:packages/nasc-server/engine.js†L3-L58】

Because diffs operate on plain objects, you can model state however you like—as long as properties map cleanly to `na-bind` usage in your templates.

## Schema-Aware Validation

Handlers can expose JSON Schema definitions through the `schemaProvider`. When a schema arrives, the client caches it, validates incoming patches, and scans the DOM for declared bindings that do not exist in the schema. Problems show up in a red overlay with a “Reveal” button to jump to the offending element.【F:packages/nasc-server/index.js†L30-L85】【F:packages/nasc-client/nasc.js†L31-L453】

Typed hints enhance this experience:

- Add `na-type="Todo"` to templates so nested binds are validated against the `Todo` schema.
- Use `na-bind="Todo:title"` for explicit typed binds inside or outside templates.【F:README.md†L95-L119】【F:packages/nasc-client/nasc.js†L365-L453】

Validation runs after mount and whenever new schemas arrive, mirroring the “batteries included” guardrails emphasized in the htmx docs.【F:packages/nasc-client/nasc.js†L456-L482】

## Autoconnect & Progressive Enhancement

Include `<body na-connect>` and the client will automatically connect once the DOM is ready, issue `mount` events for each instance, and begin streaming updates—no manual bootstrap required. If the attribute is absent you can call `connect()` yourself (e.g., for partial hydration or testing).【F:packages/nasc-client/nasc.js†L208-L222】

Because everything lives in HTML, the pages remain legible even without JavaScript; the SSR middleware can prefill bindings so users see real content before the live connection upgrades it. Learn more in [Server Integration](./server-integration).
