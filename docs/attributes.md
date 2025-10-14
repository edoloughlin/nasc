---
layout: default
title: Template Attributes Reference
nav_order: 4
---

# Template Attributes Reference

This catalogue mirrors the thorough attribute listings in the htmx docs. Each entry explains where to use an attribute, how the client interprets it, and the most common pitfalls.

## `na-connect`

| Property | Details |
| --- | --- |
| Scope | `<body>` element |
| Purpose | Auto-start the Nasc client when the DOM becomes ready. |
| Client behavior | Calls `connect({})` exactly once, issues `mount` events for every `na-scope`, and begins streaming patches. |

Use this in static HTML pages to eliminate manual JavaScript bootstrapping. Remove it if you want to delay connection until your own script calls `connect()` (for partial hydration or testing).

## `na-scope="path"` + `na-type="Type"`

| Property | Details |
| --- | --- |
| Scope | Any container element |
| Purpose | Scopes all bindings and events beneath to a specific server-side instance. |
| Client behavior | Sends `mount` once on connect, includes the ID in the payload for every event, and routes incoming patches only to nodes within the container. |

The type selects the handler object (`handlers['User']`), and the ID flows through to `mount()` as `userId`. Keep IDs stable so reconnects and SSR hydration work seamlessly.

### Absolute `$` scopes and nested paths

You can scope a container to an absolute app path by prefixing `na-scope` with `$`. Within a `$...` scope, relative binds and list paths resolve from that base; you can still opt into fully absolute binds inside the container by prefixing the bind expression with `$`.

Examples:

```html
<div na-scope="$user" na-type="App">
  <!-- Resolves to $user.name -->
  <span na-bind="name"></span>

  <!-- Resolves to $user.todos -->
  <ul>
    <template na-each="todos" na-key="id" na-type="TodoItem">
      <li><span na-bind="label"></span></li>
    </template>
  </ul>

  <!-- Fully absolute inside a $ scope: resolves to $settings.theme -->
  <span na-bind="$settings.theme"></span>
</div>
```

Events originating inside a `$` scope route to a concrete instance ID so the server can process them consistently. By default, the client maps any `$...` scope to `instance = "root"`. You can customize this mapping in the browser:

```html
<script>
  window.NASC_OPTIONS = {
    // Map an absolute scope path (e.g., "$user") to a concrete instance id
    mapScopeToInstance(path, type, container) {
      return 'App:root';
    }
  };
<\/script>
```

Validation continues to work with `$` and dotted paths. The overlay validates the top‑level property (e.g., `$user.name` validates `User.name`). For lists, keep using `na-type` on `<template>` or rely on `$ref` inference from the parent array’s schema.

## `na-bind="prop"`

| Property | Details |
| --- | --- |
| Scope | Any element that displays or edits state |
| Purpose | Binds text content (or input value) to a property on the current instance state. |
| Client behavior | Applies `textContent` for regular elements, `value`/`checked` for inputs, and keeps form controls synchronized when patches arrive. Also validates against JSON Schema when available. |

You can opt into typed validation by writing `na-bind="Todo:title"` or by placing the element under a template with `na-type`. Inputs that use `name="prop"` receive the same updates so forms stay synchronized.

## `na-each` & `na-key`

| Property | Details |
| --- | --- |
| Scope | `<template>` elements inside a bound list container |
| Purpose | Render arrays as keyed lists with stable ordering. |
| Client behavior | Clones template content per item, sets a `na-key-val` attribute, updates nested bindings, and removes nodes whose keys disappear. Missing `na-key` values log an error and stop list rendering. |

Pair `na-each="items"` with `na-key="id"` and optionally `na-type="Todo"` for schema validation. Place the template as the last child of the list container so new nodes insert before it. Avoid duplicate keys; they cause nodes to be reused unexpectedly.

## `na-submit="eventName"`

| Property | Details |
| --- | --- |
| Scope | `<form>` elements |
| Purpose | Send form data to a server handler without page reload. |
| Client behavior | Prevents default submission, serializes `FormData(form)` into an object, and posts `{ event, instance, payload }` through the active transport. |

Pair this with standard `<button type="submit">` controls. Input names become payload keys. Keep the form inside the correct `na-scope` so the payload routes to the right handler.

## `na-click="eventName"`

| Property | Details |
| --- | --- |
| Scope | Buttons, links, checkboxes, or any clickable element |
| Purpose | Dispatch discrete events when the element is activated. |
| Client behavior | Uses event delegation to intercept clicks, prevents navigation, gathers `data-*` attributes into the payload, and sends `{ event, instance, payload }`. |

Add `data-id`, `data-index`, or other contextual values to shape the payload. Keep the element inside the correct instance to avoid cross-talk between features.

## `na-type="TypeName"`

| Property | Details |
| --- | --- |
| Scope | Any element or template |
| Purpose | Provide explicit schema hints for validation overlays. |
| Client behavior | Overrides inference when validating `na-bind` or `name` attributes. Templates propagate the hint to cloned nodes via a `data-na-type-scope` attribute. |

Use this when schema inference cannot guess the nested type (for example, when array items use discriminated unions). Combined with typed binds (e.g., `na-bind="Todo:title"`), this keeps validation precise.

## `ng-bind="path"` (Form Controls)

Use `ng-bind` on form-associated elements (`input`, `textarea`, `select`) to bind their values and to determine payload keys on `na-submit`.

- Value sync: When patches arrive, inputs with `ng-bind` update to match state (supports dotted and `$` paths).
- Form payloads: On submit, the client serializes controls with `ng-bind` into `{ [path]: value }` and ignores `name` attributes.
- Validation: The overlay validates `ng-bind` paths against the active schema and flags unknown fields.
- SSR: Server-side fill updates input `value` for `ng-bind` (lists hydrate on client).

Note: `name="..."` is not used for binding or serialization.

## Putting It Together

A minimal instance often looks like this:

```html
<body na-connect>
  <div na-scope="my-list" na-type="TodoList">
    <form na-submit="add_todo">
      <input name="title" placeholder="What needs to be done?" />
      <button>Add</button>
    </form>

    <ul na-bind="items">
      <template na-each="items" na-key="id" na-type="Todo">
        <li>
          <label>
            <input type="checkbox" na-click="toggle_todo" data-id="{{id}}" na-bind="completed" />
            <span na-bind="title"></span>
          </label>
          <button na-click="remove_todo" data-id="{{id}}">×</button>
        </li>
      </template>
    </ul>
  </div>
</body>
```

This layout showcases all the moving parts you will use most often: auto-connect, instance scoping, form submits, list templates, typed hints, and event payloads.
