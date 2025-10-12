---
id: task-047
title: Auto-extract handler types from TS/JSDoc to populate __types
status: To Do
assignee: []
created_date: '2025-10-12 15:04'
labels:
  - dx
  - tooling
  - types
  - 'epic:dx'
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a TypeScript/JSDoc based extractor that infers handler state/input types and populates handler.__types automatically. Prefer TS program API; support JSDoc @type/@param fallback. Integrate with dev/CI verification.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 TS program extracts handler state/input types
- [ ] #2 JSDoc fallback when TS types unavailable
- [ ] #3 Works across multiple files and basic generics
- [ ] #4 Integrates with existing verification; zero-config in dev
- [ ] #5 Document usage and limitations
<!-- AC:END -->
