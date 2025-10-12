---
layout: default
title: Schemas & Validation
nav_order: 6
---

# Schemas & Validation

Nasc treats JSON Schema as a developer-experience feature: handlers remain in charge of logic, but schemas let the client catch binding drift, highlight mistakes, and power typed hints. This mirrors the “trust but verify” philosophy from the htmx docs.

## Why Ship Schemas?

- **Detect drift early.** When a handler drops a property, the client shows an overlay pointing to stale `na-bind` or `name` attributes.
- **Document intent.** Typed bindings (`na-bind="Type:prop"`) and `na-type` hints become self-checking documentation during development.
- **Help persistence adapters.** Optional SQLite stores and custom adapters can use the same definitions to map rows back to plain objects.

## Where Schemas Live

Schemas are ordinary JSON files. The demo keeps them in `demo/schemas/app.schema.json` with a top-level `$defs` object mapping type names to definitions. Provide either the `$defs` map or a function returning individual schemas when you initialize the server.

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

1. **Expose schemas.** Pass `schemaProvider` to `attachNasc` (object map or async function).
2. **Push on mount.** For every `mount` event, the server streams a `schema` patch for the instance type and any `$ref`-based child types before sending `bindUpdate` patches.
3. **Optional HTTP access.** If you pass `attachApp`, Nasc registers `/nasc/schema` endpoints so tooling can fetch schemas directly.

## Client Responsibilities

1. **Cache definitions.** Each `schema` patch is stored in `window.__NASC_SCHEMAS` and remembered per type.
2. **Validate patches.** When a `bindUpdate` arrives, the client checks the schema before updating the DOM. Mismatches trigger overlay warnings but do not block rendering.
3. **Sweep declared bindings.** After schemas arrive, the client scans every `[na-bind]` and `name="…"` within matching instances to flag unknown properties. Templates propagate type scopes so nested bindings validate correctly.
4. **Visual feedback.** Errors land in a floating overlay with “Reveal” buttons that scroll and highlight the element. Press `Esc` to dismiss.

## Typed Bindings Cheat Sheet

- `na-type="Todo"` on list templates clarifies the type for cloned nodes.
- `na-bind="Todo:title"` explicitly ties a binding to the `Todo` schema even outside templates.
- Inputs with `name="prop"` are validated too; use `na-type` when the input belongs to a child item rather than the parent instance.

## Best Practices

- Keep `$defs` in source control alongside handlers so reviews capture schema changes.
- Version schemas by updating `$id` strings or filenames so other services can detect incompatible changes.
- Derive schemas from your domain models (e.g., generate from TypeScript types) to avoid duplication.
- Disable or customize the overlay for production if desired; it is purely a development aid.

## Frequently Asked Questions

**Do I need schemas?** No. Without them the client skips validation and simply applies patches. However, you lose drift detection and typed hints.

**Will Nasc block invalid data?** No. Schemas are advisory. Handlers remain responsible for enforcing invariants, though you can reject bad events yourself before returning state.

**Can I fetch schemas via HTTP?** Yes. Mounting the Express integration exposes `/nasc/schema/:type`. Use it to power editor integrations or CLI tooling.

## Schema Type Checker (CLI)

Use the built-in checker to verify that handler TypeScript (or JSDoc) types align with your `app.schema.json`.

- Command: `node packages/nasc-server/bin/nasc-schema-check --handlers demo/handlers --schema demo/schemas/app.schema.json`
- Flags:
  - `--handlers <dir>`: directory containing handler source files (`.ts` or `.js`).
  - `--schema <file>`: path to `app.schema.json` with `$defs`.
  - `--strict`: exit non‑zero on mismatches (use in CI).
- Environment:
  - `STRICT_SCHEMA_TYPES=true` forces non‑zero exit on mismatches even without `--strict`.

What it checks:
- Extracts interfaces from TypeScript (e.g., `export interface UserState { … }`) and normalizes common names:
  - `FooState` → `Foo` (top‑level)
  - `FooItem[]` → `$ref: #/$defs/Foo` (array items)
- Compares generated definitions to `app.schema.json` with path‑level diffs (properties, required, refs, and array items).

Examples:

```
# Dev (warnings only)
node packages/nasc-server/bin/nasc-schema-check --handlers demo/handlers --schema demo/schemas/app.schema.json

# CI (fail on mismatch)
node packages/nasc-server/bin/nasc-schema-check --handlers demo/handlers --schema demo/schemas/app.schema.json --strict
# or
STRICT_SCHEMA_TYPES=true node packages/nasc-server/bin/nasc-schema-check --handlers demo/handlers --schema demo/schemas/app.schema.json
```

Or use the package scripts from the repo root:

```
# Dev (warnings only)
npm run schema:check

# CI-like strict mode (non-zero exit on mismatch)
npm run schema:check:strict
```

Notes:
- The server can emit gentle warnings on mount if state keys drift from the provided schema; prefer the CLI in CI.
- JSDoc projects are supported for `@typedef {Object} Name` with `@property` entries; the checker maps those to JSON Schema.
