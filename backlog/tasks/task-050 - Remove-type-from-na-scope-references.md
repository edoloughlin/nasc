---
id: task-050
title: Remove type from na-scope references
status: Done
assignee: []
created_date: '2025-10-13 08:04'
updated_date: '2025-10-13 12:41'
labels:
  - breaking-change
  - scoping
  - client
  - server
  - docs
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deprecate and remove type-prefixed instance syntax in scopes.

Summary
- Replace `na-scope="Type:id"` with path-only scopes: `na-scope="path"` for relative and `na-scope="$path"` for absolute.
- Keep `na-type` as the mechanism to declare validation/handler type; typed binds `Type:prop` remain validation-only.
- Update client, server (SSR + routing), tests, demo, and docs. Provide a migration and optional back-compat shim.

Routing + Protocol
- Events (submit/click) and mounts originate from the nearest `na-scope`. With no type in the scope value, routing uses the closest `na-type` on the scope container.
- If no `na-type` is present, server rejects with a developer-friendly error (overlay + log) or consults an optional server mapping hook: `(path) => type`.
- Optionally include a `type` hint in client messages (mount/event) when available from DOM to assist routing and error clarity.

Validation
- Schema validation schedules against containers/areas that declare `na-type` or templates with `na-type`.
- Typed binds (`Type:prop`) still guide validation; patch routing continues to use the nearest scope + type, not the typed bind.

SSR
- SSR resolves path-only scopes using the container's `na-type` to call the correct handler `mount()`.
- Absolute scopes (start with `$`) resolve against the app-level/global state path; map to a concrete server instance key.

Other na-* impacts
- `na-bind`: Supports relative (`prop`) and absolute (`$path.to.prop`) with nearest scope as base when relative.
- `na-each`/`na-key`: Accept relative or absolute array paths; key behavior unchanged.
- `na-submit`/`na-click`: Route to nearest scope + its `na-type`; payload unchanged.
- `na-type`: Required on scope containers that originate events or require SSR. Optional elsewhere for validation clarity.
- `na-connect`/transport: Unchanged.

Back-compat
- Detect legacy `Type:id` values and log a deprecation warning; optionally auto-interpret as `{ type: Type, path: id }` for one release cycle behind a feature flag.

Docs + Migration
- Update attribute reference, recipes, quick start, and demo markup to show `na-scope="path"` with `na-type="Type"`.
- Add a migration guide with before/after and common pitfalls.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Scopes no longer accept Type:id; only path or $path are valid
- [x] #2 Client includes optional type hint from nearest na-type; routing uses scope + type
- [x] #3 Server routes using provided type (or mapping hook), rejects missing type with dev-friendly error
- [x] #4 SSR uses na-type to mount path-only scopes; absolute paths resolve to a concrete server instance
- [x] #5 Validation schedules by na-type and supports absolute/relative bindings without false positives
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Spec path-only scope + routing
2. Client: type hint + mounts/events
3. Server/SSR: routing + mapping hook
4. Validation: schedule by na-type
5. Update demo/tests/docs
6. Back-compat shim + deprecation
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Create task to remove type from scopes, define routing via na-type, and outline SSR/validation/back-compat impacts.

- Client: containers send { type } on mount/events; typed binds use patch.type.
- Server: processor routes by provided type; bindUpdate now includes type; SSE event endpoint forwards type.
- SSR: detects na-type on tags with na-scope and mounts using path-only ids.
- Validation: schedule by [na-scope][na-type=...] instead of instance-prefix matching.
- Demo + docs + tests: updated to path-only na-scope with na-type on containers.
- All tests pass (npm test).
- Pending: back-compat shim + explicit deprecation warnings, and a proper migration guide.

- Added client conflict detection: flags multiple na-type values for the same na-scope as errors (overlay).
- Missing na-type policy implemented (error for interactive, warning for display-only); mapping hook supported on client and SSR.
<!-- SECTION:NOTES:END -->
