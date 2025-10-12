---
id: task-046
title: >-
  Backend should verify the schema against language type information if
  available
status: To Do
assignee: []
created_date: '2025-10-12 14:49'
updated_date: '2025-10-12 14:52'
labels:
  - 'epic:dx'
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Where the handler implementation provides type information, the backend should verify it against the schema information.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inventory type sources in handlers (TS/JSDoc); choose extraction path.
2. Implement type→schema extraction (TS program) for handler I/O; JSDoc fallback.
3. Add schema compatibility checker vs app.schema.json (assignability, path‑level diffs).
4. Wire into dev/CI: warn on dev start; CI task fails on mismatch; env flag STRICT_SCHEMA_TYPES.
5. Tests: extractor/checker unit tests; fixtures for match/mismatch; backend integration test.
6. Perf: cache generated schemas; incremental rebuild on file changes in dev.
7. Docs: usage, flags, annotations; examples for TS and JSDoc.
<!-- SECTION:PLAN:END -->
