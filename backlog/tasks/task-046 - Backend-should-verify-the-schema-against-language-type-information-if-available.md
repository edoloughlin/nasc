---
id: task-046
title: >-
  Backend should verify the schema against language type information if
  available
status: In Progress
assignee: []
created_date: '2025-10-12 14:49'
updated_date: '2025-10-12 15:19'
labels:
  - 'epic:dx'
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Where the handler implementation provides type information, the backend should verify it against the schema information.

For Typescript, there should be a developer cli to validate the schema against the handler types. It should determine the mappings and examine the Typescript type and/or interface definitions and ensure they match the schema json.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Type extraction supports TS handler input/output types
- [ ] #2 JSDoc @type/@param fallback supported when TS types unavailable
- [ ] #3 Checker reports path-level diffs vs app.schema.json with clear messages
- [ ] #4 Dev mode warns on mismatch; CI fails when STRICT_SCHEMA_TYPES=true
- [ ] #5 Unit tests cover extractor and checker (positive/negative), coverage >= 85%
- [ ] #6 Integration tests: mismatch blocks CI; match passes with zero warnings
- [ ] #7 Caching prevents stale results; incremental rebuild reflects file changes
- [ ] #8 Documentation added for usage, flags, and examples
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inventory type sources (TS/JSDoc); choose extraction path.
2. Implement TS program-based type→schema extraction for handler I/O; add JSDoc fallback.
3. Build schema compatibility checker vs app.schema.json (assignability rules; path-level diffs).
4. Integrate into dev/CI: dev warnings; CI fails on mismatch; STRICT_SCHEMA_TYPES flag.
5. Unit tests: extractor/checker positive & negative cases with fixtures; coverage ≥ 85%.
6. Integration tests: backend start/CI flows for match/mismatch; verify error messages.
7. Performance: cache generated schemas; incremental rebuild on file changes.
8. Docs: usage, flags, examples (TS and JSDoc).
<!-- SECTION:PLAN:END -->
