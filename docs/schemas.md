# Schemas in Nasc

This document explains how JSON Schemas are used in Nasc for developer ergonomics (DX), typed validation hints, and predictable wiring between HTML and handlers.

Nasc relies on a simple, server‑authoritative model: handlers return plain objects as state; Nasc diffs and streams DOM patches. Schemas are optional but highly recommended for a great DX.

## What Schemas Are Used For

- Types and shape: Define each domain type (e.g., `User`, `Todo`, `TodoList`) and their properties.
- Validation hints (dev): The client uses schemas pushed from the server to validate your HTML bindings. Unknown or mismatched bindings are highlighted with a small overlay and a “Reveal” button.
- Typed binds: `na-type="Type"` and `na-bind="Type:prop"` leverage schemas so validation stays precise even with nested templates.

Schemas are not runtime enforcement in core. They exist for DX (warnings/overlay) and for optional persistence adapters.

## Where Schemas Live

- Demo location: `demo/schemas/app.schema.json`
- Structure: a single file with a top-level `$defs` map where each key is a type name. Example:

```json
{
  "$id": "/schemas/app.schema.json",
  "$defs": {
    "User": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "email": { "type": "string", "format": "email" }
      },
      "required": ["id", "name", "email"]
    },
    "Todo": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "title": { "type": "string" },
        "completed": { "type": "boolean" }
      },
      "required": ["id", "title", "completed"]
    },
    "TodoList": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "items": { "type": "array", "items": { "$ref": "#/$defs/Todo" } }
      },
      "required": ["id", "items"]
    }
  }
}
```

## How Schemas Flow

1) Provide to the server
- When starting Nasc, you pass the `$defs` provider to `attachNasc`:

```ts
attachNasc({ app, server, handlers, schemaProvider: appSchema.$defs, ssr: { rootDir } });
```

2) Server pushes schemas on mount
- On every mount, the server pushes a schema patch:
  - `{ action: "schema", type: "TodoList", schema: <…> }`
  - It also pushes child type schemas if the parent references them via array `$ref` (e.g., `TodoList.items → Todo`).

3) Client caches and validates
- The client keeps schemas in `window.__NASC_SCHEMAS` and validates your HTML bindings:
  - Unknown `[na-bind]` and inputs with `name="…"` are flagged.
  - Inside list templates, the client uses `na-type` (or array `$ref`) to validate against the child’s schema.
  - Typed shorthand `na-bind="Type:prop"` pins a binding to a specific type.

4) Dev overlay
- The client shows a small overlay with issues and a “Reveal” button that scrolls to and highlights the offending element.
- This is intended for development; production apps can alter or disable the overlay if desired.

## Typed Bindings Recap

- `na-type="Todo"` on a list template clarifies the schema for bindings inside:

```html
<ul na-bind="items">
  <template na-each="items" na-key="id" na-type="Todo">
    <li>
      <span na-bind="title"></span>
    </li>
  </template>
  </ul>
```

- `na-bind="User:name"` explicitly targets the `User` schema for that binding.
- Patch routing still uses the nearest `na-instance`; typing affects validation/ergonomics.

## Best Practices

- Keep `$defs` in sync with handlers. The server pushes schemas on every page load so drift is obvious via the overlay.
- Prefer `na-type` on list templates; it makes intent clear and avoids inference pitfalls.
- Use stable keys for lists (`na-key`), and bind only properties you control server‑side.
- Consider adding schema versioning (`$id` with semver) and running a schema compatibility check in CI.

## Mapping (Out of Scope for Core)

- A separate `app.mapping.json` can be used by optional persistence adapters to create normalized tables (see the demo’s `SqliteMappedStore`).
- Nasc core does not implement a full mapping/ORM. For production apps, prefer ORMs like Prisma/Drizzle and implement a tiny `Store` bridge.

## FAQ

- Do I need schemas? No, but you get much better DX (typed overlays, early drift detection).
- Are schemas enforced at runtime? Not by core. They’re advisory for the client and optional adapters.
- Can I fetch schemas via HTTP? The demo uses push-on-mount. An explicit GET can be mounted if needed, but is not required.

