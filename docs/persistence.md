---
layout: default
title: Persistence & Stores
nav_order: 8
---

# Persistence & Stores

Nasc separates transport logic from persistence so you can plug in any database or cache. This guide mirrors the pragmatic storage advice from the htmx docs.

## Store Interface

A store is an object with two async methods:

```ts
interface Store {
  load(type: string, id: string): Promise<any | null>;
  persist(type: string, id: string, diff: Record<string, unknown>, full: any): Promise<void>;
}
```

`createProcessor` and `attachNasc` call `load` during `mount` and `persist` after each event. The default `MemoryStore` ships in `packages/nasc-server/engine.js` and simply keeps a deep-cloned object per `type:id` key.

## Choosing a Strategy

| Option | When to use | Notes |
| --- | --- | --- |
| `MemoryStore` | Prototyping, unit tests | Volatile data, no external dependencies. |
| `SqliteStore` | Small apps, single-node deployments | Stores each instance as JSON in a table keyed by ID. Requires `better-sqlite3`. |
| `SqliteMappedStore` | Demos needing normalized tables | Expands arrays into child tables using schema + mapping metadata. Also requires `better-sqlite3`. |
| Custom store | Production systems with existing databases | Implement the `Store` interface and wrap persistence in transactions as needed. |

## Implementing Your Own Store

1. **Load current state.** Fetch and return the last persisted object. Nasc passes this to handlers so they can compute the next state.
2. **Persist diffs.** You receive both the diff and the full new state. Use whichever is more convenient for your backend. The reference engine logs the diff for transparency.
3. **Handle concurrency.** Wrap persistence in transactions or optimistic locks if events might run in parallel.
4. **Serialize arrays carefully.** Keyed templates assume arrays preserve order and keys; make sure your storage layer does the same.

## SQLite Helpers

Both SQLite adapters lazy-load `better-sqlite3` and throw a helpful error if the dependency is missing. Install it at your app root (`npm i better-sqlite3`) so workspace resolution works as expected.

- `SqliteStore` creates a table per type (by default `<type>s`) with `id` + JSON payload. Use it when you want persistence without relational modeling.
- `SqliteMappedStore` reads mapping metadata (like `app.mapping.json`) and schema definitions to create normalized tables for scalar properties and one-to-many relationships. It replaces child rows on each persist to keep data consistent.

## app.mapping.json

Purpose: describe how a feature type maps to storage. The demo ships `schemas/app.mapping.json` to drive the normalized SQLite adapter (`SqliteMappedStore`). It does not change runtime behavior; it only informs how to create/read/write tables.

Linkage:
- Type key: Each top-level key in `app.mapping.json` is a feature type name (e.g., `User`, `TodoList`). It should match both:
  - The schema type under `schemas/app.schema.json` → `$defs.<Type>`
  - The handler name you register (e.g., `handlers['TodoList']`)

Shape:

```json
{
  "$id": "/schemas/app.mapping.json",
  "User":   { "x-nc:store": { "entity": "users",      "pk": "id" } },
  "Todo":   { "x-nc:store": { "entity": "todos",      "pk": "id" } },
  "TodoList": { "x-nc:store": { "entity": "todo_lists", "pk": "id" } }
}
```

Fields:
- `x-nc:store.entity`: Table name for the type. If omitted, defaults to the pluralized form `<type.toLowerCase()>s` (e.g., `todolist` → `todolists`).
- `x-nc:store.pk`: Name of the primary key property in the type’s schema. Defaults to `id`.

How `SqliteMappedStore` uses it:
- Scalars → main table: For each type, `schema.$defs[Type].properties` is scanned. Scalar properties (`string`, `number`, `integer`, `boolean`) become columns on the main table (`entity`). Booleans are stored as INTEGER 0/1.
- One‑to‑many arrays → child table: Array‑of‑object properties whose items are `$ref: '#/$defs/<ChildType>'` are stored in the child type’s `entity` table. On each persist, existing child rows for the parent are deleted and re‑inserted to match the current array.
- Foreign key naming: The child table gets a foreign key column named `<parentEntitySingular>_<parentPk>`. The singular form is derived by stripping a trailing `s` from the parent entity (e.g., `todo_lists` → `todo_list_id`).
- Defaults: If a type is missing from `app.mapping.json`, the adapter throws an error for that type. Provide `entity`/`pk` for every type you want to persist via the mapped store.

Initialization example:

```ts
import appSchema from './schemas/app.schema.json';
import appMapping from './schemas/app.mapping.json';
import { SqliteMappedStore } from '../packages/nasc-server/store/sqlite-mapped';

const store = new SqliteMappedStore(process.env.DB_PATH!, {
  mapping: appMapping,
  schema: appSchema
});
```

Runtime data flow:
- `na-instance="Type:id"` → the `Type` selects the mapping and schema type; the `id` value is the row key in the main table (`pk`).
- Your handler returns the full state; the processor computes diffs and calls `store.persist(Type, id, diff, full)`; the mapped store applies an upsert to the main table and fully replaces child rows for array relations.

## Testing Tips

- Inject a fake store (e.g., `new Map()`) into `attachNasc({ store })` to capture diffs during unit tests.
- Use the `dryRun` flag of `applyEvent` if you need to preview diffs without persisting. (Call it directly with `dryRun = true`.)
- Combine schema validation overlays with your store’s logging to spot mismatches between HTML and server state early.

Persistence is deliberately thin so you can bring your favorite ORM or data layer—just implement the interface and let Nasc handle the rest.
