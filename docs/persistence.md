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

`createProcessor` and `attachNasc` call `load` during `mount` and `persist` after each event. The default `MemoryStore` ships in `packages/nasc-server/engine.js` and simply keeps a deep-cloned object per `type:id` key.【F:packages/nasc-server/engine.js†L3-L58】【F:packages/nasc-server/index.js†L186-L273】

## Choosing a Strategy

| Option | When to use | Notes |
| --- | --- | --- |
| `MemoryStore` | Prototyping, unit tests | Volatile data, no external dependencies.【F:packages/nasc-server/engine.js†L3-L58】 |
| `SqliteStore` | Small apps, single-node deployments | Stores each instance as JSON in a table keyed by ID. Requires `better-sqlite3`.【F:packages/nasc-server/store/sqlite.js†L1-L53】 |
| `SqliteMappedStore` | Demos needing normalized tables | Expands arrays into child tables using schema + mapping metadata. Also requires `better-sqlite3`.【F:packages/nasc-server/store/sqlite-mapped.js†L1-L212】 |
| Custom store | Production systems with existing databases | Implement the `Store` interface and wrap persistence in transactions as needed.【F:README.md†L74-L92】 |

## Implementing Your Own Store

1. **Load current state.** Fetch and return the last persisted object. Nasc passes this to handlers so they can compute the next state.
2. **Persist diffs.** You receive both the diff and the full new state. Use whichever is more convenient for your backend. The reference engine logs the diff for transparency.【F:packages/nasc-server/engine.js†L16-L58】
3. **Handle concurrency.** Wrap persistence in transactions or optimistic locks if events might run in parallel.
4. **Serialize arrays carefully.** Keyed templates assume arrays preserve order and keys; make sure your storage layer does the same.

## SQLite Helpers

Both SQLite adapters lazy-load `better-sqlite3` and throw a helpful error if the dependency is missing. Install it at your app root (`npm i better-sqlite3`) so workspace resolution works as expected.【F:packages/nasc-server/store/sqlite.js†L1-L53】【F:packages/nasc-server/store/sqlite-mapped.js†L1-L212】

- `SqliteStore` creates a table per type (by default `<type>s`) with `id` + JSON payload. Use it when you want persistence without relational modeling.【F:packages/nasc-server/store/sqlite.js†L11-L50】
- `SqliteMappedStore` reads mapping metadata (like `app.mapping.json`) and schema definitions to create normalized tables for scalar properties and one-to-many relationships. It replaces child rows on each persist to keep data consistent.【F:packages/nasc-server/store/sqlite-mapped.js†L32-L192】

## Testing Tips

- Inject a fake store (e.g., `new Map()`) into `attachNasc({ store })` to capture diffs during unit tests.【F:packages/nasc-server/index.js†L186-L288】
- Use the `dryRun` flag of `applyEvent` if you need to preview diffs without persisting. (Call it directly with `dryRun = true`.)【F:packages/nasc-server/engine.js†L35-L58】
- Combine schema validation overlays with your store’s logging to spot mismatches between HTML and server state early.【F:packages/nasc-client/nasc.js†L224-L453】

Persistence is deliberately thin so you can bring your favorite ORM or data layer—just implement the interface and let Nasc handle the rest.
