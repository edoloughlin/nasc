---
layout: default
title: Schemas & Validation
nav_order: 6
---

# Schemas & Validation

Nasc treats JSON Schema as a developer-experience feature: handlers remain in charge of logic, but schemas let the client catch binding drift, highlight mistakes, and power typed hints. This mirrors the “trust but verify” philosophy from the htmx docs.

## Why Ship Schemas?

- **Detect drift early.** When a handler drops a property, the client shows an overlay pointing to stale `na-bind` or `name` attributes.【F:packages/nasc-client/nasc.js†L224-L453】
- **Document intent.** Typed bindings (`na-bind="Type:prop"`) and `na-type` hints become self-checking documentation during development.【F:README.md†L95-L101】【F:packages/nasc-client/nasc.js†L365-L453】
- **Help persistence adapters.** Optional SQLite stores and custom adapters can use the same definitions to map rows back to plain objects.【F:README.md†L84-L92】

## Where Schemas Live

Schemas are ordinary JSON files. The demo keeps them in `demo/schemas/app.schema.json` with a top-level `$defs` object mapping type names to definitions. Provide either the `$defs` map or a function returning individual schemas when you initialize the server.【F:demo/README.md†L82-L176】【F:packages/nasc-server/index.js†L30-L85】

```json
{
  "$defs": {
    "User": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "email": { "type": "string", "format": "email" }
      }
    },
    "Todo": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "title": { "type": "string" },
        "completed": { "type": "boolean" }
      }
    }
  }
}
```

## Server Responsibilities

1. **Expose schemas.** Pass `schemaProvider` to `attachNasc` (object map or async function).【F:packages/nasc-server/index.js†L30-L197】
2. **Push on mount.** For every `mount` event, the server streams a `schema` patch for the instance type and any `$ref`-based child types before sending `bindUpdate` patches.【F:packages/nasc-server/index.js†L30-L85】
3. **Optional HTTP access.** If you pass `attachApp`, Nasc registers `/nasc/schema` endpoints so tooling can fetch schemas directly.【F:packages/nasc-server/index.js†L131-L181】

## Client Responsibilities

1. **Cache definitions.** Each `schema` patch is stored in `window.__NASC_SCHEMAS` and remembered per type.【F:packages/nasc-client/nasc.js†L31-L214】
2. **Validate patches.** When a `bindUpdate` arrives, the client checks the schema before updating the DOM. Mismatches trigger overlay warnings but do not block rendering.【F:packages/nasc-client/nasc.js†L47-L100】【F:packages/nasc-client/nasc.js†L224-L453】
3. **Sweep declared bindings.** After schemas arrive, the client scans every `[na-bind]` and `name="…"` within matching instances to flag unknown properties. Templates propagate type scopes so nested bindings validate correctly.【F:packages/nasc-client/nasc.js†L352-L453】
4. **Visual feedback.** Errors land in a floating overlay with “Reveal” buttons that scroll and highlight the element. Press `Esc` to dismiss.【F:packages/nasc-client/nasc.js†L252-L333】

## Typed Bindings Cheat Sheet

- `na-type="Todo"` on list templates clarifies the type for cloned nodes.【F:README.md†L95-L101】【F:packages/nasc-client/nasc.js†L130-L171】
- `na-bind="Todo:title"` explicitly ties a binding to the `Todo` schema even outside templates.【F:packages/nasc-client/nasc.js†L365-L400】
- Inputs with `name="prop"` are validated too; use `na-type` when the input belongs to a child item rather than the parent instance.【F:packages/nasc-client/nasc.js†L401-L453】

## Best Practices

- Keep `$defs` in source control alongside handlers so reviews capture schema changes.【F:demo/README.md†L82-L176】
- Version schemas by updating `$id` strings or filenames so other services can detect incompatible changes.
- Derive schemas from your domain models (e.g., generate from TypeScript types) to avoid duplication.
- Disable or customize the overlay for production if desired; it is purely a development aid.

## Frequently Asked Questions

**Do I need schemas?** No. Without them the client skips validation and simply applies patches. However, you lose drift detection and typed hints.【F:packages/nasc-client/nasc.js†L47-L214】

**Will Nasc block invalid data?** No. Schemas are advisory. Handlers remain responsible for enforcing invariants, though you can reject bad events yourself before returning state.【F:packages/nasc-server/engine.js†L35-L58】

**Can I fetch schemas via HTTP?** Yes. Mounting the Express integration exposes `/nasc/schema/:type`. Use it to power editor integrations or CLI tooling.【F:packages/nasc-server/index.js†L131-L181】
