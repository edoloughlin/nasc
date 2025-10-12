---
id: task-016
title: Transactions and unit-of-work
status: To Do
assignee: []
created_date: '2025-10-12 11:01'
updated_date: '2025-10-12 11:09'
labels:
  - annoyances
  - backend
  - persistence
  - transactions
  - 'epic:persistence'
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow handlers to return multi-instance patches within a transactional unit-of-work; emit patches only on commit (ANNOYANCES.md #15; ROADMAP Persistence).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Transaction API and Store integration
- [ ] #2 Atomic multi-entity persist
- [ ] #3 Rollback behavior and tests
<!-- AC:END -->
