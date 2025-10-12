---
id: task-001
title: 'DevTools overlay: event→diff→persist plan→patches'
status: To Do
assignee: []
created_date: '2025-10-12 11:01'
updated_date: '2025-10-12 11:07'
labels:
  - annoyances
  - dx
  - tooling
  - observability
  - devtools
  - docs
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a DevTools panel/overlay to visualize previous state, new state, computed diff, persistence plan, and applied DOM patches per event (sources: ANNOYANCES.md #1, ROADMAP).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Design UI/UX and data taps for overlay
- [ ] #2 Hook into processor to expose event lifecycle data
- [ ] #3 Toggle overlay on/off and per-instance filtering
- [ ] #4 Document usage and troubleshooting
<!-- AC:END -->
