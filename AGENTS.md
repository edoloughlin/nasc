# AGENTS.md

Purpose: This file defines how coding agents should work in this repository using the Codex CLI. It prioritizes correctness, safety, and fast feedback.

## Workflow

- Planning: Use the plan tool for multi-step or ambiguous work. Keep steps short (5–7 words), with exactly one step marked in_progress.
- Preambles: Before tool calls, send a brief 1–2 sentence note of what you’re about to do. Group related actions.
- Edits: Use apply_patch for all file changes. Keep patches small and focused on the task.
- Commits: Only commit when the user asks or confirms. Use clear, descriptive messages. Ask before pushing.

## Tests (run after every change)

- Always run the test suite after making any change that touches code or tests.
- Command (run from `nasc`): `npm test`
- Targeted runs (optional): `node --test packages/<pkg>/**/*.test.js`
- Validate the specific area you changed first (if feasible), then run the full suite.

## Validation Philosophy

- Start specific: Validate the smallest affected unit first, then expand.
- Don’t add new test frameworks. If adding tests, follow existing patterns and locations.
- Don’t fix unrelated issues unless requested. If discovered, note them succinctly to the user.

## Safety and Approvals

- Sandboxing: Respect the current sandbox mode. Request escalation only when necessary (e.g., writing files, installing deps, or otherwise blocked).
- Network: Assume restricted. Do not access network without explicit approval.
- Destructive actions: Avoid or ask first (e.g., `rm -rf`, resets, large refactors).

## Coding Practices

- Root-cause fixes: Prefer durable solutions over superficial patches.
- Minimal scope: Change only what’s required; preserve naming and structure unless there’s a strong reason.
- Style consistency: Match existing code style; don’t introduce new formatters.
- Documentation: Update README/inline docs when behavior changes or new concepts are introduced.

## Tooling Conventions

- Search: Prefer `rg` for speed (fallback to `grep` if unavailable).
- File reads: Output at most 250 lines per chunk.
- Patching: Use `apply_patch` only; do not edit files via other means.
- Commands: Wrap commands and paths in backticks in messages for clarity.

## Communication Style

- Tone: Concise, direct, and friendly. Focus on actionable steps.
- Progress updates: For longer tasks, provide short check-ins (8–10 words) summarizing what’s done and what’s next.
- Final messages: Summarize changes, rationale, and next steps; avoid unnecessary verbosity.

## Common Commands

- Run tests (from `nasc`): `npm test`
- Run a single test file: `node --test packages/nasc-client/tests/client-bindings.test.js`
- List workspaces/packages: check `packages/` and `pnpm-workspace.yaml`

## Notes Specific to This Repo

- Node’s built-in test runner is used via `npm test`.
- DOM-related tests use a minimal DOM shim in `packages/nasc-client/tests/minimal-dom.js`.
- Avoid changing licensing or adding headers unless explicitly requested.

