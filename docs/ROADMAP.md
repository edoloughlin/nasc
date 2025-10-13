# Roadmap

This roadmap highlights upcoming work related to transports, reliability, and DX. The current default is SSE with optional WebSockets; per‑instance transport selection is intentionally deferred.

## Transport

- Per‑instance transport selection (Deferred)
  - Add `na-transport="ws|sse|inherit"` on `na-scope` containers.
  - Client: resolve requested transports, coerce all bindings of the same instance to one transport; warn on conflicts.
  - Server: maintain `clientId -> instance -> transport` map and route patches to exactly one channel; never double‑send.
  - WS identity: include `clientId` in WS URL (e.g., `wss://…?clientId=…`).
  - Fallback: if WS degrades, downgrade instance to SSE and continue.
  - Sequencing: include per‑instance `seq` in patches; client tracks last‑seen seq to drop stale/duplicate frames.
  - Tests: conflict coercion, disconnect fallback, ordering under jitter.

## Reliability & Observability

- Add `eventId` and per‑instance `seq` to patches and logs.
- Expose a DevTools overlay for event → diff → persist plan → patches timeline.
- Tune keepalives (SSE comment pings; WS ping/pong) under common LB/proxy timeouts.

## DX & Testing

- Contract tests: same inputs produce identical patches over SSE and WS.
- Headless runner to drive events and assert diffs/patches.
- Document troubleshooting for both transports (CDN/proxy notes, headers, timeouts).

## Nice‑to‑Haves

- Transport negotiation (`auto`): detect WS health and prefer WS when a page or instance requests it.
- Optional message signing (HMAC) for SSE frames when fronted by edge caches.

## Data Model & Persistence

- Mapping DSL refinements and adapters
  - Scope: Full mapping DSL + migrations is out of core scope. Prefer existing ORMs (Prisma/Drizzle/TypeORM/Knex) via a thin `Store` bridge.
  - Provide recipes and contrib adapters instead of building a full ORM in core.
  - Ship example adapters (Prisma/Drizzle) and show visible SQL/persist plan in dev.
  - Transactions/unit‑of‑work across multiple instances; emit patches only on commit.
- Concurrency & conflicts
  - Optimistic concurrency (version/updated_at checks) with conflict callbacks and standard UI.
- Computed/derived fields
  - Declarative computed fields with explicit recompute triggers; treat as non‑persisted unless pinned.
- Schema & migrations
  - Schema versioning (`$id` semver) and migration helpers; CI guardrail for breaking diffs. (Core does not own DB migrations.)

## Frontend UX & Accessibility

- Input latency & IME handling
  - Optimistic local‑echo with reconciliation; handle composition events to avoid mid‑composition patches.
  - `na-debounce` and `na-on` controls for input/change/blur.
- Lists & keyed diffs
  - Enforce stable keys for `na-each` and improve reorder/focus retention.
- Scope clarity
  - Add scope inspector (hover) and allow explicit binds like `User:currentUser.name`.
- Error surfaces
  - Standardize field/form errors; default error outlet + slots.
- Accessibility
  - Helpers to announce dynamic content changes and retain focus.
- Formatting & i18n
  - `na-format` for dates/currency; basic i18n catalog.

## Routing & URL State

- Router that binds route params to `mount()` and syncs selected state to URL (`na-sync` to query/hash).

## Security & Auth

- Default‑deny field ACLs; explicit readable/writeable declarations.
- Server‑side output filtering before diff/patch.
- CSRF protection for POST `/event`; Origin/Referer validation.

## Scaling & Ops

- In‑memory store hygiene: LRU/TTL per instance; explicit `na-disconnect` pruning.
- Multi‑process scaling: sticky sessions or external pub/sub for fanout (works for SSE and WS).
- Keepalive tuning: SSE comment pings; WS ping/pong; proxy/CDN compatibility notes.
- Structured logs (JSON) with eventId, timings, state before/after, persist plan, and patches.
- Metrics & backpressure: track send buffers, patch batching, rate limits per client.

## Ecosystem & Tooling

- DevTools overlay: event → diff → persist plan → patches timeline; correlate with eventId.
- VS Code extension: schema/mapping intellisense, hovers, and quick‑fixes.
- Scaffolder/CLI: generate handlers, schemas, mappings, and demo pages.
- Adapters (contrib): host community `Store` adapters (Prisma/Drizzle/etc.) in a separate contrib space.
- React/Vue/Svelte bindings or a store API to consume Nasc instances without DOM attributes.

## Offline & Resilience

- Offline/spotty networks: POST replay queue, offline UI state, and sync on reconnect.
- Transparent transport downgrade/upgrade (WS↔SSE) with minimal disruption.

## CI & Testing

- Headless runner to feed events, record diffs, and assert patches/persist plans.
- Contract tests to ensure SSE and WS produce identical patches for the same inputs.
- Fault injection (latency/jitter/disconnect) to verify ordering and fallback behaviors.
