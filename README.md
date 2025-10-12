# Nasc: A "Live HTML" Framework

Nasc means 'bind' in the Irish language.

You can read the online documentation at https://edoloughlin.github.io/nasc/

Nasc is a proof-of-concept framework for building reactive user interfaces with plain HTML and a backend that manages state. By default it streams server→client patches over Server‑Sent Events (SSE) and sends client→server events via HTTP; WebSockets are also supported for features that need bidirectional, high-frequency updates.

*Note:* this is currently a PoC. There is currently no packaged version of this project.

## Project Philosophy

Taking inspiration from HTMX, the core idea is to keep the client as simple as possible. The server is the source of truth for both state and logic. The client sends events to the server, and the server responds with fine-grained state updates. These are sent over SSE (or WS) in a similar fashion to Datastar, but sending arbitrary HTML is not supported by design.

This approach has several potential benefits:

* **Minimal client-side code:** The client is a small, generic library.
* **Backend-driven logic:** All business logic lives on the server, where it can be written in any language.
* **Simple HTML:** The HTML is just plain HTML with a few special attributes.

The project currently supports ExpressJS backends, but others may be accomodated in future, potentially including Java, Python or PHP.

## Project Structure

The project is organized into two main parts: the `packages` and the `demo`.

Note that this structure is highly likely to change.

* `packages/`: Contains the reusable parts of the Nasc framework.
  * `nasc-client/`: The client-side JavaScript library (`nasc.js`). This is the only file you need to include in your HTML.
  * `nasc-server/`: The reference implementation of the Nasc server protocol, written in Node.js. This can be used as a starting point for building your own Nasc-compatible backend in any language.

* `demo/`: A standalone example application that shows how to use the Nasc framework.
  * `index.ts`: The TypeScript entry point for the demo server (compiled to `dist/index.js`). It shows how to bootstrap a Nasc application.
  * `handlers/`: The demo-specific event handlers.
  * `schemas/`: The demo's data schemas
    * `app.schema.json`: JSON Schema `$defs` for domain types used in the demo (e.g., `User`, `TodoList`).
    * `app.mapping.json`: Example store-mapping metadata for persistence (entity, pk) — not used at runtime in the demo.
  * `*.html`: The demo's HTML pages.

## Getting Started

This repo is a pnpm workspace (monorepo). Install dependencies at the repo root, then run the demo.

- Install deps (root): `pnpm i`
- Run demo: `cd demo && pnpm start` (or `pnpm --filter nasc-demo start`)

For a full, guided example (run + read + extend), see `demo/README.md`.

### Workspace layout and dependency resolution

- Workspace packages: `packages/*` and `demo/` (see `pnpm-workspace.yaml`).
- Server code under `packages/nasc-server` is what `require()`s runtime deps like `express` and `ws`.
- Keep server runtime deps at the root so they resolve for `packages/nasc-server`.
  - Add root deps: `pnpm add express ws -w`
  - Add demo-only deps: `pnpm add <pkg> --filter nasc-demo` (use `-D` for dev-only)

## How it Works

1. The browser loads a plain HTML file.
2. The `nasc.js` client connects to the server via SSE by default. You can opt into WebSockets per page or feature if needed.

Transport selection

* Default: SSE.
* Force via code: `connect({ transport: 'ws' })` or `connect({ transport: 'sse' })`.
* Force via URL for testing: append `?transport=ws` or `?transport=sse` to the page URL (e.g., `/app.html?transport=ws`).

3. When you interact with the page (e.g., submit a form), the client sends an event to the server.
4. The server processes the event in a handler, computes a state change, and calculates a diff.
5. The server sends the diff back to the client as a set of DOM patches.
6. The client applies the patches to the HTML, updating the UI.

## Project Scope

Core responsibilities

* Transport and rendering: SSE/WS streaming, DOM patching (`bindUpdate`), keyed list diffing, SSR middleware, and auto‑connect.
* Protocol and validation: simple, typed event→diff→patch flow; push schema on mount; best‑effort client validation with clear, dev‑only errors.
* Persistence seam: a tiny `Store` interface (`load(type,id)`, `persist(type,id,diff,full)`) that apps or adapters can implement.

Intentionally out of scope

* Full mapping/ORM layer for nested objects and arbitrary relations, migrations, indexes, and vendor‑specific features. Teams should use an existing ORM (Prisma/Drizzle/TypeORM/Knex) and plug it into the `Store` seam.

Reference adapters (for demos and small apps)

* `SqliteStore` (JSON column): simplest persistence with one table per type storing the full object as JSON.
* `SqliteMappedStore` (normalized demo): creates normalized tables for scalars and 1:N arrays (full‑replace writes). This is an example, not a full mapping DSL.

Bring your own ORM

* Implement a thin `Store` bridge to your ORM: wrap each event in a transaction in `persist()`, and return plain JS objects in `load()`.

## Typed Bindings (optional)

* You can optionally annotate types to improve validation clarity:
  * Lists: `<template na-each="items" na-type="Todo" na-key="id">…` tells the client that bindings inside the template target the `Todo` schema.
  * Single binds: `<span na-bind="name" na-type="User">` or shorthand `<span na-bind="User:name">`.
* Instance scoping (`na-instance="Type:id"`) still controls where patches apply; `na-type` affects validation and developer tooling only.
* If no `na-type` is provided, the client infers list item types from your schema’s `$ref` when possible; otherwise it skips validation to avoid false positives.

See `docs/schemas.md` for a deeper look at how schemas are structured, pushed by the server, and used by the client for validation and typed bindings.

## Supported `na-*` Attributes

| Attribute            | Where                 | Purpose                                                        |
|----------------------|-----------------------|----------------------------------------------------------------|
| `na-connect`         | `<body>`              | Auto‑connect the client to the backend on page load.          |
| `na-instance`        | Any container         | Scope all binds/events inside to `Type:id` (e.g., `User:42`). |
| `na-bind`            | Any element/input     | Bind text/value to a state property (e.g., `name`).           |
| `na-each`            | `<template>`          | Repeat template content for each item of an array.            |
| `na-key`             | `<template>`          | Stable key for items in `na-each` (e.g., `id`).               |
| `na-submit`          | `<form>`              | Send an event on submit. Payload = `FormData(form)`.          |
| `na-click`           | Any clickable element | Send an event on click. Payload from `data-*` attributes.     |
| `na-type` (optional) | Any / `<template>`    | Hint the schema type for validation (e.g., `Todo`).           |

Notes
* Typed bind shorthand: `na-bind="Type:prop"` explicitly targets a type for validation; patch routing still uses the nearest `na-instance`.
* Inputs with `name="prop"` are auto‑updated by patches for `prop` within the same `na-instance`.
* For lists, place `na-each` and `na-key` on a `<template>` inside a container bound with `na-bind="items"`.

### Minimal Example

```
<body na-connect>
  <div na-instance="User:current">
    <h2>Hello, <span na-bind="name">Guest</span></h2>
    <form na-submit="save_profile">
      <input name="name">
      <button>Save</button>
    </form>
  </div>
</body>
```
