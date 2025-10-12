---
id: task-048
title: Backend performance testing for nasc-server
status: To Do
assignee: []
created_date: '2025-10-12 15:46'
labels:
  - backend
  - performance
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Goal: Establish a repeatable performance testing workflow and baseline for the backend (packages/nasc-server), covering microbenchmarks and end-to-end HTTP event processing.

Approach:
- Scope: Focus on handler execution + diffing (applyEvent), message pipeline (createProcessor), and the HTTP path (/nasc/event) under minimal Express. Leave WebSocket out initially.
- Scenarios:
  1) Mount cold start (no prior state) and warm re-mount hydration
  2) Single-property update (cheap diff)
  3) Array operations (append, toggle, reorder)
  4) Large payloads (e.g., 10–50KB state) to measure patch size and serialization costs
  5) No-op events (control)
- Metrics:
  - Throughput (ops/s), latency P50/P95/P99, patch size bytes, and CPU time per op.
  - Sample sizes >= 5k ops for microbenchmarks; warm-up runs before measurement.
- Methodology:
  - Micro (pure Node): benchmark applyEvent and createProcessor directly with synthetic handlers and an in-memory store. Use node:perf_hooks for high-resolution timing.
  - HTTP (optional): spin up a minimal Express app with attachNasc and hit POST /nasc/event using an internal runner (or autocannon if available), measuring end-to-end latency without network calls outside localhost. Skip gracefully if Express unavailable.
  - Profiles (optional): document how to run Node --cpu-prof/--cpu-prof-dir and inspect flamegraphs locally; do not commit profiles.
- Reporting:
  - Emit JSON and Markdown summaries to a temp dir and console; include env (Node version, CPU model), config flags, and scenario parameters.
  - Define an initial baseline file in-repo; when STRICT_PERF=true, fail if throughput regresses >20% or latency worsens >25% vs baseline for key scenarios.
- Non-goals: full DB adapters and WebSocket benchmarks; can be added later as separate tasks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Add perf suite under packages/nasc-server/perf with micro + HTTP scenarios
- [ ] #2 Add npm run perf to execute suite and print JSON+markdown
- [ ] #3 Measure ops/s and P50/P95; sample size >= 5k where feasible
- [ ] #4 Produce baseline file and support STRICT_PERF regression check
- [ ] #5 HTTP benchmark runs locally and skips if Express missing
- [ ] #6 Document methodology and usage in docs/performance.md
- [ ] #7 Include guidance for Node CPU profiling; exclude profiles from VCS
- [ ] #8 Works cross-platform; skips optional parts gracefully
<!-- AC:END -->
