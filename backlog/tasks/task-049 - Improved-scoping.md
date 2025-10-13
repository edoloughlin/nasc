---
id: task-049
title: Improved scoping
status: Done
assignee: []
created_date: '2025-10-13 07:50'
updated_date: '2025-10-13 16:27'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rename na-instance to na-scope and formalize scoping semantics.

Absolute References + Nested Scopes
- `na-scope` supports two forms:
  - Instance form: `id` — sets the instance context; data path = root of that instance.
  - Absolute form: `$path` — binds to a top-level app state path, independent of any instance (e.g., `$currentUser`).
- Nested `na-scope` rules:
  - Relative value (no `$`): resolves from the nearest ancestor scope's data path.
  - Absolute value (starts with `$`): resets to the absolute app path, ignoring ancestor scopes.
- `na-bind` resolution:
  - Relative: `na-bind="prop"` binds to `ancestorPath.prop`.
  - Absolute: `na-bind="$path.to.prop"` ignores ancestors and binds to the given app path.
  - Typed binds `Type:prop` continue to influence validation only; routing still uses the nearest `na-scope` instance context.

Impact on other `na-*` attributes with `$` and nesting
- `na-submit` / `na-click`: Events route to the nearest `na-scope`'s instance context (instance form or the configured global context for `$`). Payload formation unchanged.
- `na-each` / `na-key`: Support relative (`items`) and absolute (`$path.items`) list paths. Key behavior unchanged.
- `na-type` (optional): Continues to affect validation only. For `$` paths or inferred arrays, use `na-type` to disambiguate when schema inference is not possible.
- `na-connect`: Unchanged; auto-connects the client.
- Transport selection (`?transport=` or code): Unchanged.

Server + SSR considerations
- Define a concrete mapping for `$` (e.g., a canonical global instance like `App:root`) so events/patches have a stable instance id.
- SSR must resolve `$` scopes while rendering initial HTML (fills `[na-bind]` and `name` inputs).

Validation + Errors
- Validation overlay should resolve absolute and relative paths; unknown props surface as non-fatal overlay errors with a reveal action.
- Multiple containers that share the same effective instance should not cause duplicate `mount` events.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Repo-wide rename: na-instance -> na-scope
- [x] #2 Client selectors, routing, and SSR updated to use na-scope
- [x] #3 Docs updated: attribute reference and examples mention na-scope and impacted tags
- [x] #4 All tests pass via npm test
- [x] #5 Specify and implement  absolute references for na-scope/na-bind (design + tests)

- [x] #6 Define and document absolute `$` scope + bind rules (relative vs absolute, nesting precedence)
- [x] #7 Route events from `$` scopes to a concrete global instance; avoid duplicate mounts
- [x] #8 Support absolute paths in `na-each` and preserve `na-key` and item typing
- [x] #9 SSR resolves `$` scopes; initial content renders correctly
- [x] #10 Validation overlay handles absolute paths and typed binds without false positives
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Specify `$` semantics + mapping
2. Client: scope/selector resolution + de-dupe mounts
3. Server/SSR: parse `$` scopes, map to global instance
4. Validation overlay: absolute/relative path support
5. Expand tests: events, lists, SSR, errors
6. Update docs + examples
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Renamed na-instance to na-scope across client, server (SSR), demo HTML, tests, and docs.
- Verified no leftovers with ripgrep; all tests pass (npm test).
- Updated docs to describe impact on na-bind, na-submit/na-click, na-each/na-key, na-type, na-connect; na-transport remains unchanged.
- Next: specify and implement absolute `$` reference semantics for na-scope/na-bind, with unit tests and docs.

- Added explicit design for absolute `$` paths, nested `na-scope` precedence, and attribute-by-attribute impact.
- Documented SSR + event routing for global `$` mapping (e.g., `App:root`).
- Clarified validation overlay expectations and de-duped mounts.

- Implemented absolute $ scoping on client (path parsing; instance mapping default='root')
- Updated event routing and validation for $/dotted paths
- SSR middleware resolves $ scopes and fills from base path; added mapScopeToInstance
- Added tests for $ binds, lists, and event routing
- Updated docs: attributes and server integration
- All tests pass via `npm test`
<!-- SECTION:NOTES:END -->
