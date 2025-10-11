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
| Client behavior | Calls `connect({})` exactly once, issues `mount` events for every `na-instance`, and begins streaming patches. |

Use this in static HTML pages to eliminate manual JavaScript bootstrapping. Remove it if you want to delay connection until your own script calls `connect()` (for partial hydration or testing).【F:packages/nasc-client/nasc.js†L208-L222】

## `na-instance="Type:id"`

| Property | Details |
| --- | --- |
| Scope | Any container element |
| Purpose | Scopes all bindings and events beneath to a specific server-side instance. |
| Client behavior | Sends `mount` once on connect, includes the ID in the payload for every event, and routes incoming patches only to nodes within the container. |

The type selects the handler object (`handlers['User']`), and the ID flows through to `mount()` as `userId`. Keep IDs stable so reconnects and SSR hydration work seamlessly.【F:packages/nasc-client/nasc.js†L17-L100】【F:packages/nasc-server/index.js†L30-L121】

## `na-bind="prop"`

| Property | Details |
| --- | --- |
| Scope | Any element that displays or edits state |
| Purpose | Binds text content (or input value) to a property on the current instance state. |
| Client behavior | Applies `textContent` for regular elements, `value`/`checked` for inputs, and keeps form controls synchronized when patches arrive. Also validates against JSON Schema when available. |

You can opt into typed validation by writing `na-bind="Todo:title"` or by placing the element under a template with `na-type`. Inputs that use `name="prop"` receive the same updates so forms stay synchronized.【F:packages/nasc-client/nasc.js†L47-L214】【F:README.md†L95-L119】

## `na-each` & `na-key`

| Property | Details |
| --- | --- |
| Scope | `<template>` elements inside a bound list container |
| Purpose | Render arrays as keyed lists with stable ordering. |
| Client behavior | Clones template content per item, sets a `na-key-val` attribute, updates nested bindings, and removes nodes whose keys disappear. Missing `na-key` values log an error and stop list rendering. |

Pair `na-each="items"` with `na-key="id"` and optionally `na-type="Todo"` for schema validation. Place the template as the last child of the list container so new nodes insert before it. Avoid duplicate keys; they cause nodes to be reused unexpectedly.【F:packages/nasc-client/nasc.js†L65-L171】【F:README.md†L95-L119】

## `na-submit="eventName"`

| Property | Details |
| --- | --- |
| Scope | `<form>` elements |
| Purpose | Send form data to a server handler without page reload. |
| Client behavior | Prevents default submission, serializes `FormData(form)` into an object, and posts `{ event, instance, payload }` through the active transport. |

Pair this with standard `<button type="submit">` controls. Input names become payload keys. Keep the form inside the correct `na-instance` so the payload routes to the right handler.【F:packages/nasc-client/nasc.js†L174-L205】【F:demo/README.md†L48-L130】

## `na-click="eventName"`

| Property | Details |
| --- | --- |
| Scope | Buttons, links, checkboxes, or any clickable element |
| Purpose | Dispatch discrete events when the element is activated. |
| Client behavior | Uses event delegation to intercept clicks, prevents navigation, gathers `data-*` attributes into the payload, and sends `{ event, instance, payload }`. |

Add `data-id`, `data-index`, or other contextual values to shape the payload. Keep the element inside the correct instance to avoid cross-talk between features.【F:packages/nasc-client/nasc.js†L189-L205】【F:demo/README.md†L131-L170】

## `na-type="TypeName"`

| Property | Details |
| --- | --- |
| Scope | Any element or template |
| Purpose | Provide explicit schema hints for validation overlays. |
| Client behavior | Overrides inference when validating `na-bind` or `name` attributes. Templates propagate the hint to cloned nodes via a `data-na-type-scope` attribute. |

Use this when schema inference cannot guess the nested type (for example, when array items use discriminated unions). Combined with typed binds (e.g., `na-bind="Todo:title"`), this keeps validation precise.【F:README.md†L95-L101】【F:packages/nasc-client/nasc.js†L130-L453】

## Input `name="prop"`

Although not an `na-*` attribute, matching input names are first-class citizens. When the server patches a property, the client updates any matching inputs automatically—even if they lack `na-bind`. The validator also checks these names against the schema and emits overlay errors if a field does not exist. Use this for form fields that submit data but do not need live display.【F:packages/nasc-client/nasc.js†L94-L453】

## Putting It Together

A minimal instance often looks like this:

```html
<body na-connect>
  <div na-instance="TodoList:my-list">
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

This layout showcases all the moving parts you will use most often: auto-connect, instance scoping, form submits, list templates, typed hints, and event payloads.【F:README.md†L95-L133】【F:demo/README.md†L131-L170】
