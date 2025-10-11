# Nasc Demo (TypeScript)

This demo shows how to build a real app with Nasc using plain HTML, a tiny client, and server handlers. It includes:

- User Profile (User:currentUser)
- Todo List (TodoList:my-list), with add, toggle, reorder (↑/↓), and remove
- SSR + live updates over SSE (default) or WebSocket
- Schema push + client-side validation overlay for developer feedback
- Optional SQLite persistence (JSON-column or normalized mapping)

Open the app at:

- http://localhost:3000/app.html


## Quick Start

Prerequisites
- Node 18+
- pnpm or npm

Install and run (pnpm workspace):

```
pnpm i        # install at the repo root (workspace)
cd demo
pnpm start    # or: npm start
```

Open a browser to http://localhost:3000/app.html. The client auto-connects and streams patches from the server.

Transport selection
- SSE is the default.
- Switch via query param: append `?transport=ws` or `?transport=sse`.
- The combined demo (`app.html`) has a small UI picker at the bottom.

WebSocket dependency note
- WebSocket support is optional. If the `ws` package is not available to `packages/nasc-server`, the server runs in SSE-only mode and logs a notice.
- To enable WebSocket, install `ws` at the repo root (so it’s resolvable from `packages/nasc-server`) — e.g. run `pnpm i` at the root, or add `ws` as a dependency in `packages/nasc-server` within a workspace setup.
- Installing `ws` only in `demo` is not sufficient due to Node’s module resolution (the server code requiring `ws` lives under `packages/nasc-server`).

Workspace tips
- Add root runtime deps (used by `packages/nasc-server`): `pnpm add express ws -w`
- Add a dependency just for the demo: `pnpm add <pkg> --filter nasc-demo` (use `-D` for dev-only)
- You can also run the demo without `cd` using filters: `pnpm --filter nasc-demo start`


## How It Works (end-to-end)

1) HTML with na-attributes
- Scope: `na-instance="Type:id"` wraps a region bound to a single instance.
- Send events: `na-submit="event"` on forms, `na-click="event"` on buttons/inputs (with `data-*` as payload).
- Bind data:
  - `na-bind="prop"` binds text/value within the scoped instance
  - `na-each="items"` + `na-key="id"` on a `<template>` clones keyed list items
  - Optional typing for clarity: `na-type="Todo"` on the template, or `na-bind="User:prop"`

2) Client library (`/nasc.js`)
- Auto-connects when `<body na-connect>` is present
- On connect, sends a mount for each `na-instance`
- Sends event payloads for `na-submit`/`na-click`
- Receives patches and updates the DOM:
  - `{ action: "bindUpdate", instance, prop, value }`
  - List diffs: uses keyed template cloning, stable order, focus-safe
  - Checkboxes sync using `checked` for boolean props

3) Handlers (server)
- `demo/handlers/user.ts` and `demo/handlers/todo.ts`
- Must export an object with:
  - `mount(params) → initialState`
  - One function per event (e.g., `save_profile`, `add_todo`, `toggle_todo`, `move_up`, `move_down`, `remove_todo`) returning the next state
- You write your logic; the framework diffs previous vs new state and emits patches

4) SSR
- The server uses SSR middleware to render initial HTML:
  - Detects `na-instance` in the page
  - Calls `mount()` to get initial state
  - Injects values into `[na-bind]` and `<input name="…">`
  - Client hydrates and only applies deltas

5) Schema + validation
- `demo/schemas/app.schema.json` defines `$defs` for `User`, `Todo`, `TodoList`
- The server pushes `{ action: "schema", type, schema }` on mount (and child schemas referenced by `$ref`)
- The client validates your bindings and shows a small overlay with a “Reveal” button for quick fixes
- Optional typed hints: `na-type="Todo"` on list templates or `na-bind="User:name"`

### Walkthrough: HTML ↔ Handlers linking

This is the most important mental model: HTML declares what to bind and which event to send; the server decides what to do by calling a method on your handler whose name matches the event.

HTML (from `app.html`):

```
<!-- Scope everything below to the User:currentUser instance -->
<div class="card" na-instance="User:currentUser">
  <h2>Hello, <span na-bind="name">Guest</span></h2>
  <p>Email: <strong na-bind="email"></strong></p>

  <!-- When submitted, send event 'save_profile' for this instance -->
  <form class="form" na-submit="save_profile">
    <input class="input" name="name" placeholder="Your name" />
    <input class="input" name="email" type="email" placeholder="you@example.com" />
    <button class="btn" type="submit">Save profile</button>
  </form>
</div>
```

What the client sends on submit:

```
{
  event: "save_profile",
  instance: "User:currentUser",
  payload: { name: "…", email: "…" }
}
```

What the server invokes:

```
// handlers['User'] is the User handler object
await handlers['User'].save_profile(payload, currentState)
```

The returned next state is diffed against `currentState`, and for each changed property you get a patch:

```
{ action: "bindUpdate", instance: "User:currentUser", prop: "name", value: "…" }
```

List items (from `app.html`):

```
<div class="card" na-instance="TodoList:my-list">
  <form class="todo-header" na-submit="add_todo">
    <input class="input" name="title" placeholder="What needs to be done?" />
    <button class="btn" type="submit">Add</button>
  </form>

  <ul class="todo-list" na-bind="items">
    <template na-each="items" na-key="id" na-type="Todo">
      <li class="todo-item">
        <label class="todo-item" style="flex:1">
          <input type="checkbox" na-click="toggle_todo" data-id="{{id}}" na-bind="completed" />
          <span class="todo-title" na-bind="title"></span>
        </label>
        <div>
          <button class="btn" na-click="move_up" data-id="{{id}}">↑</button>
          <button class="btn" na-click="move_down" data-id="{{id}}">↓</button>
          <button class="btn" na-click="remove_todo" data-id="{{id}}">✕</button>
        </div>
      </li>
    </template>
  </ul>
</div>
```

- The list template (`<template na-each="items" na-key="id">`) is cloned for each item; `na-type="Todo"` lets the validator know inner binds (like `title`) belong to `Todo`.
- Clicking a control inside the list sends the `na-click` event with any `data-*` attributes as payload, for example:

```
{
  event: "toggle_todo",
  instance: "TodoList:my-list",
  payload: { id: "2" }
}
```

On the server that calls `handlers['TodoList'].toggle_todo(payload, currentState)`.

Server setup (from `demo/index.ts`):

```
const handlers = { User: UserHandler, TodoList: TodoListHandler };
attachNasc({ app, server, handlers, schemaProvider: appSchema.$defs, ssr: { rootDir } });
```

The key rule is simple and consistent:

- Type = the part before the colon in `na-instance="Type:id"` → selects the handler object.
- Event = the string in `na-submit="…"` or `na-click="…"` → selects the method on that handler.
- Payload = `FormData` for `na-submit`; for `na-click`, the element’s `data-*` attributes.
- Return the new state from the handler; the framework diffs and emits patches that update `[na-bind]` and inputs with matching `name`.


## Project Layout (demo)

- `index.ts`      – Express server using `attachNasc` (SSR + transports)
- `handlers/`     – Server handlers (your app logic)
  - `user.ts`     – `mount`, `save_profile` (demo-only inline error for `email` under `error_email`)
  - `todo.ts`     – `mount`, `add_todo`, `toggle_todo`, `move_up`, `move_down`, `remove_todo`
- `schemas/`
  - `app.schema.json` – JSON Schema `$defs` for `User`, `Todo`, `TodoList`
  - `app.mapping.json` – Example mapping metadata (used in normalized SQLite mode)
- `app.html`      – Combined app page using `na-*` attributes
- `styles.css`    – Shared styling for a slick, unified look
- `status.js`     – Demo-only status badge (transport/status indicator)


## Writing Your Own Feature

1) HTML: add markup under an `na-instance`, bind fields with `na-bind`, and add controls with `na-submit`/`na-click`.

2) Schema: add your type/fields to `app.schema.json` `$defs` to get validation overlay and DX.

3) Handler: implement your event in the corresponding handler file and return the updated state.

4) That’s it: refresh the page — SSR renders initial values; client connects, sends your event, and patches the DOM.

Tip: For lists, declare a `<template na-each="items" na-key="id" [na-type="ItemType"]>` and place your item markup inside. The client handles keyed cloning and reordering.


## Optional: SQLite Persistence

By default, the demo uses an in-memory store. You can switch to SQLite without changing handlers.

1) Install driver
```
cd demo && pnpm i better-sqlite3  # or: npm i better-sqlite3
```

2) JSON-column store (simplest)
```
DB_PATH=./demo.sqlite pnpm start
```
- Stores entire instances as JSON per type (e.g., `users`, `todo_lists`).

3) Normalized/mapped store (demo mapping)
```
DB_PATH=./demo.sqlite DB_MODE=mapped pnpm start
```
- Creates normalized tables using `schemas/app.mapping.json` + `schemas/app.schema.json`.
- 1:N lists (e.g., `TodoList.items`) are stored in child tables; writes use full-replace semantics for simplicity.

Note: Persistence is pluggable via `attachNasc({ store })`. For production apps, use an ORM (Prisma/Drizzle/etc.) and implement a tiny `Store` bridge.


## Troubleshooting

- SSE shows “blocked” in Network (Firefox/Chrome): try incognito (extensions off) or switch to WebSocket via `?transport=ws`.
- No todos on reload: ensure the server sends bindUpdate patches on mount (in this demo it does). Hard refresh.
- Validation overlay reports unknown bindings: confirm the schema `$defs`, typed hints (`na-type` on templates), and that schemas are being pushed (check `window.__NASC_SCHEMAS`).
- Console shows fallback to WebSocket: the client auto-switches if SSE fails to open.


## How to Build This From Scratch

1) Create an HTML page and include `/nasc.js`; add `<body na-connect>`.
2) Mark sections with `na-instance="Type:id"`, bind fields with `na-bind`, and define actions with `na-submit`/`na-click`.
3) Write a handler object per type with `mount()` and one method per event.
4) Provide a schema (`$defs`) for validation and better DX.
5) On the server, call `attachNasc({ app, server, handlers, schemaProvider: schema.$defs, ssr: { rootDir } })`.
6) Run it; the client streams patches; the server applies your logic and diffs; the UI updates automatically.

That’s the core loop — simple, predictable, and easy to iterate.
