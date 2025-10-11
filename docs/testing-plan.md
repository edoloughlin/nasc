# Testing Plan for `packages/nasc-server`

This plan establishes the initial suite of automated tests for the Nasc server package and outlines how we will maintain comprehensive unit coverage. The suites run with Node's built-in `node:test` runner so they stay lightweight and avoid extra tooling dependencies.

## Objectives

1. Exercise the core event engine so that regressions in state mutation, diffing, or persistence behaviour are caught early.
2. Validate request/response utilities (schema helpers and processor) to ensure protocol compatibility.
3. Provide targeted coverage for server integration helpers with lightweight mocks.
4. Document additional scenarios for future expansion (e.g., persistence adapters, SSR) to guide ongoing work.
5. Add DOM-level regression tests for the browser client so we can validate binding behaviour against HTML fixtures.

## Test Suites

### 1. Engine Behaviour (`engine.test.js`)
- `applyEvent` should call the requested handler method, compute diffs correctly, and persist the new state.
- `applyEvent` must respect the `dryRun` flag by avoiding persistence.
- An informative error is thrown when an unknown event name is invoked.

### 2. Message Processor (`processor.test.js`)
- Mounting a new instance persists initial state, emits schema patches (including referenced child schemas), and sends bind updates.
- Mounting an existing instance replays schema and current state without invoking `mount` again.
- Subsequent events call the matching handler method, persist the mutation, and emit bind updates from the diff.
- Unknown handlers and handler failures return error patches without crashing the processor.

### 3. Schema Utilities (`schema.test.js`)
- `normalizeSchemaProvider` supports functional and map providers and gracefully handles missing schemas.
- `createSchemaHandler` responds with the expected HTTP status codes (200, 400, 404, 500) and payload shapes across edge cases.

### 4. Client Bindings (`client-bindings.test.js`)
- Simulate SSE-driven patch streams against HTML fragments to ensure mount events post the correct payload and bind updates hydrate text and form controls.
- Validate keyed template rendering for `na-each` lists so reorder/regeneration logic stays stable.
- Confirm typed `na-bind` syntax stays in sync with untyped bindings when diff patches arrive.

## Out of Scope (Future Work)
- End-to-end SSE/WebSocket transport tests (would require integration environment).
- Persisted store adapters beyond the in-memory implementation (e.g., SQLite) once dedicated test harnesses are available.
- SSR middleware HTML transformation (requires fixture HTML documents).

By implementing these suites now and expanding later as new features stabilise, we ensure fast feedback for the most critical server behaviours while leaving clear guidance for future contributors.
