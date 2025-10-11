---
layout: default
title: Examples & Recipes
nav_order: 10
---

# Examples & Recipes

Borrowing the pattern-driven style of the htmx docs, this section collects common scenarios drawn from the bundled demo.

## Profile Form with Validation

Goal: Update profile details and surface schema errors.

1. **HTML** – Wrap the form in `na-instance="User:currentUser"`, bind fields with `na-bind`, and keep input `name` attributes aligned.
2. **Handler** – Implement `mount()` to load the user and `save_profile(payload)` to return the updated object.
3. **Validation** – Define the `User` schema with required properties so the overlay flags missing binds immediately.【F:demo/README.md†L48-L130】【F:demo/README.md†L82-L186】

```html
<div na-instance="User:currentUser">
  <h2>Hello, <span na-bind="name">Guest</span></h2>
  <form na-submit="save_profile">
    <input name="name" placeholder="Your name" />
    <input name="email" type="email" placeholder="you@example.com" />
    <button>Save profile</button>
  </form>
  <p class="hint" na-bind="error_email"></p>
</div>
```

## Todo List with Keyed Templates

Goal: Render an array of todos, toggle completion, and maintain order.

1. **HTML** – Bind the list container to `na-bind="items"` and place a `<template na-each="items" na-key="id" na-type="Todo">` inside.
2. **Handlers** – Implement `add_todo`, `toggle_todo`, `move_up`, `move_down`, and `remove_todo` methods that return the entire list state.
3. **Events** – Add `na-click` to buttons and include `data-id` attributes so payloads route to the correct todo.【F:demo/README.md†L131-L170】

```html
<ul class="todo-list" na-bind="items">
  <template na-each="items" na-key="id" na-type="Todo">
    <li class="todo-item">
      <label>
        <input type="checkbox" na-click="toggle_todo" data-id="{{id}}" na-bind="completed" />
        <span na-bind="title"></span>
      </label>
      <button na-click="remove_todo" data-id="{{id}}">✕</button>
    </li>
  </template>
</ul>
```

## SSE/WebSocket Transport Picker

Goal: Let developers toggle transports without editing code.

1. **HTML** – Add a simple toolbar with buttons linking to `?transport=sse` or `?transport=ws`.
2. **Client** – The runtime reads the query parameter and switches transports accordingly.【F:README.md†L56-L66】【F:packages/nasc-client/nasc.js†L484-L588】
3. **Server** – Ensure the `ws` dependency is installed if you want the WebSocket option to succeed.【F:packages/nasc-server/index.js†L268-L278】【F:demo/README.md†L32-L45】

## SSR Bootstrapped Page

Goal: Serve meaningful HTML before the live connection starts.

1. **Server** – Pass `ssr: { rootDir }` to `attachNasc`.
2. **HTML** – Author pages with `na-bind` placeholders; SSR fills them with values from `mount()` so the first paint looks complete.【F:packages/nasc-server/index.js†L280-L317】【F:demo/README.md†L74-L86】

## Persistence Swap

Goal: Switch from in-memory state to SQLite.

1. Install `better-sqlite3` at the workspace root.
2. Require `SqliteStore` or `SqliteMappedStore` from `packages/nasc-server` and pass an instance via `attachNasc({ store })`.
3. Provide mapping metadata (`app.mapping.json`) if you use the normalized adapter.【F:README.md†L84-L92】【F:packages/nasc-server/store/sqlite.js†L1-L53】【F:packages/nasc-server/store/sqlite-mapped.js†L1-L192】

These recipes are starting points—mix and match them to build richer experiences while keeping your HTML declarative and server logic focused.
