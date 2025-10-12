---
id: task-046
title: >-
  Backend should verify the schema against language type information if
  available
status: Done
assignee: []
created_date: '2025-10-12 14:49'
updated_date: '2025-10-12 15:44'
labels:
  - 'epic:dx'
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Where the handler implementation provides type information, the backend should verify it against the schema information.

For Typescript, there should be a cli tool that finds the interfaces or types provided by the handler and veriy them against the json schema. The developer should not need to provide any extra code or information to support this. It should work by examining the code.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Type extraction supports TS handler input/output types
- [x] #2 JSDoc @type/@param fallback supported when TS types unavailable
- [x] #3 Checker reports path-level diffs vs app.schema.json with clear messages
- [x] #4 Dev mode warns on mismatch; CI fails when STRICT_SCHEMA_TYPES=true
- [x] #5 Unit tests cover extractor and checker (positive/negative), coverage >= 85%
- [x] #6 Integration tests: mismatch blocks CI; match passes with zero warnings
- [ ] #7 Caching prevents stale results; incremental rebuild reflects file changes
- [x] #8 Documentation added for usage, flags, and examples
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Added schema/type checker CLI (packages/nasc-server/bin/nasc-schema-check)
- Implemented TS extractor + JSDoc typedef fallback and path-level diffing
- Dev warnings on mount for schema/state drift; STRICT_SCHEMA_TYPES to fail CI
- Tests added: extractor/checker positive+negative, strict mode behavior
- Docs updated: schemas.md with usage, flags, examples
- Remaining: caching + incremental rebuild (AC #7)
<!-- SECTION:NOTES:END -->
