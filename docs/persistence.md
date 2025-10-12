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

## Testing Tips

- Inject a fake store (e.g., `new Map()`) into `attachNasc({ store })` to capture diffs during unit tests.
- Use the `dryRun` flag of `applyEvent` if you need to preview diffs without persisting. (Call it directly with `dryRun = true`.)
- Combine schema validation overlays with your store’s logging to spot mismatches between HTML and server state early.

Persistence is deliberately thin so you can bring your favorite ORM or data layer—just implement the interface and let Nasc handle the rest.
