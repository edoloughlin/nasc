# Biggest DX risks (and fixes)

**1) “Magic” persistence from diffs**

* **Annoyance:** Dev updates a nested field, and *something* writes to a DB, but it’s not obvious which table/columns changed or why. When it goes wrong, it’s hard to know if it’s schema, mapping, or handler output.
* **Fix:**
  * **DONE (backend):** Make persistence rules **deterministic and visible**. The `applyEvent` function in `backend/engine.js` now logs a detailed persistence plan (state, diff, new state) for every event.
  * **TODO:** Add a **DevTools panel** that shows: previous state, new state, computed diff, persistence plan, applied DOM patches.
  * **DONE (backend):** Provide a `dryRun: true` mode for handlers/tests to preview plans. This is implemented in `applyEvent`.

**2) Overloading JSON Schema**

* **Annoyance:** JSON Schema is great for validation, not perfect for relational mapping, ACLs, or lifecycle rules; `x-na:*` annotations can become a grab bag.
* **Fix:** Split concerns:
  * **DONE:** Keep **JSON Schema** for validation + types. (`app.schema.json`)
  * **DONE:** Add a **Store Mapping DSL** (YAML/JSON) for persistence (`entity`, `pk`, relations, write policies). This is now in `app.mapping.json`.
  * **TODO:** Add a **Policy DSL** for field ACLs and computed/derived fields.
  * **TODO:** Generate types from both so editors get intellisense.

**3) Latency + server-authoritative inputs**

* **Annoyance:** With server as the source of truth, typing can feel laggy, and IME/auto-fill can misbehave if you echo values from the server.
* **Fix:**

  * **Local-echo** inputs (optimistic) with reconciliation; only revert on validation failure.
  * Handle **IME composition** events explicitly; don’t patch mid-composition.
  * Provide `na-debounce="300"` and `na-on="input|change|blur"` controls per input.

**4) List/collection diffs**

* **Annoyance:** `na-each` without stable keys → reordering bugs, lost focus, and broken inputs.
* **Fix:**

  * Require a **stable key** (e.g., `na-key="todo.id"`).
  * Patch at keyed child scope; avoid wholesale re-renders.

**5) Implicit instance scoping**

* **Annoyance:** `na-scope="currentUser"` + `na-type="User"` + `na-bind="name"` is clean, but nested scopes can be confusing; devs may not realize which instance a bind resolves to.
* **Fix:**

  * Add `na-scope-inspector` (hover to see the resolved instance/type for any node).
  * Allow explicit binds: `na-bind="User:currentUser.name"` in tricky spots.
  * Document the **resolution rules** (nearest scope wins, no surprises).

**6) Error surfaces**

* **Annoyance:** Where do validation or write conflicts appear? In the console? Nowhere?
* **Fix:**

  * Standardize server responses to include **field errors** and **form errors**; client maps them to `[na-error="field"]`.
  * Provide a default toast/error outlet and a way to slot your own.

**7) Schema/versioning & migrations**

* **Annoyance:** Evolving schemas will break pages silently if annotations and mappings drift.
* **Fix:**

  * Add **schema versioning** (`$id` with semver) and migration helpers.
  * Fail loudly: if frontend schema version ≠ backend schema version, show a banner and block writes.

**8) Routing/URL state**

* **Annoyance:** Everything is “instances” but apps also need URL-addressable state (deep links, back/forward behavior).
* **Fix:**

  * Provide a first-class **router** that binds route params to `mount()` and syncs parts of state to the URL (`na-sync="filter -> query:filter"`).

**9) Testing story**

* **Annoyance:** Hard to write unit/integration tests if persistence and DOM patching are implicit.
* **Fix:**

  * Export a **headless runner** that feeds events, records diffs, and asserts patches/persist plans.
  * Ship a **contract test kit** (given schema + mapping + handler, assert produced SQL/ops).

**10) Observability**

* **Annoyance:** Debugging a live system with sockets and diffs is painful without tracing.
* **Fix:**

  * Correlate everything with an **event ID**.
  * Emit **structured logs** (JSON) for: inbound event, state before/after, validation result, persist plan, DOM patches, timing.

# Frontend specifics

**11) Attribute name collisions**

* **Annoyance:** Custom attributes (`na-*`) might collide with other tools or be stripped by sanitizers.
* **Fix:** Namespace is okay, but document SSR/security implications; consider `data-na-*` alias.

**12) SSR & SEO**

* **Annoyance:** Pure client patching → blank initial content hurts SEO and TTI.
* **Fix:**

  * Support **SSR with initial state hydration**; server renders HTML with `na-scope` and values, client only attaches.
  * Progressive enhancement: page works without WS, forms do full POST fallback.

**13) Accessibility**

* **Annoyance:** Patching text is fine; but dynamic lists/forms need ARIA announcements and focus retention.
* **Fix:**

  * Provide helpers to retain focus and announce changes; ship an `na-a11y` module.

**14) Formatting & i18n**

* **Annoyance:** Devs will need currency/date formatting, pluralization, etc.
* **Fix:**

  * Add `na-format="currency(EUR)"`, `na-format="date(yyyy-MM-dd)"` that run on the server (or deterministic client) to keep consistency.
  * Integrate a simple i18n catalog with schema-driven formats.

# Backend & data model

**15) Transactions & unit-of-work**

* **Annoyance:** What if one event mutates multiple types? How do you ensure all-or-nothing?
* **Fix:**

  * Let handlers return **multi-instance patches** in a single unit; engine opens a transaction across all touched entities and emits patches only if commit succeeds.

**16) Concurrency/conflicts**

* **Annoyance:** Two tabs/users editing the same record → last-write wins surprises.
* **Fix:**

  * Add **optimistic concurrency** (`version`/`updated_at` checks) and a conflict callback; expose a standard conflict UI pattern.

**17) Computed/derived fields**

* **Annoyance:** Where do you define `fullName = first + last`, denormalized counters, etc.?
* **Fix:**

  * Support **computed fields** in the mapping DSL with explicit recompute triggers; treat them as non-persisted unless pinned.

**18) Security/ACLs**

* **Annoyance:** Field-level ACL in annotations can get brittle; mistakes leak data.
* **Fix:**

  * Default-deny posture; require explicit `readable/writeable` declarations for non-public fields.
  * Enforce **output filtering** server-side *before* diff/patch.

# Ecosystem & interop

**19) Using this with React/Vue/Svelte**

* **Annoyance:** Teams won’t throw away their component systems.
* **Fix:**

  * Provide **thin bindings**: `<NaScope instance="User:currentUser">` for React, etc., that map `na-bind` to framework idioms.
  * Or expose a **store API** so frameworks subscribe to typed instances without DOM attributes.

**20) Tooling fatigue**

* **Annoyance:** New attributes, new schema annotations, new lifecycle—the learning curve is real.
* **Fix:**

  * Scaffolders, codegen, VS Code extension (schema intellisense, hover docs), and a **playground** that shows live diff/persist/patch.

# Operational concerns

**21) Offline/spotty connections**

* **Annoyance:** WS-only breaks on flaky mobile/Wi-Fi.
* **Fix:**

  * Include HTTP fallback (long-poll) and **replay queue**; mark UI as offline and temporarily buffer events.

**22) Memory & session pressure**

* **Annoyance:** Server keeps instance state caches—can balloon.
* **Fix:**

  * LRU/TTL per instance, backpressure metrics, and explicit `na-disconnect` to prune.

**23) Schema drift between environments**

* **Annoyance:** Dev → staging → prod differences cause “works on my machine”.
* **Fix:**

  * Ship a **schema compatibility check** in CI; fail deploys on breaking diffs.

# Concrete priorities to smooth DX

1. **DevTools** (event → diff → persist plan → patches timeline).
2. **Mapping DSL** separate from JSON Schema; generate types + editor hints.
3. **DONE:** **SSR + hydration** + progressive enhancement fallback.
4. **DONE:** **Stable keys + keyed diffing** for lists; focus/IME-safe input handling with optimistic local echo.
5. **Transactions & concurrency** out of the box.
6. **Testing kit** (headless runner + golden persist plans).
7. **Adapters** (start with Prisma) and visible SQL in dev.

If you want, I’ll extend the repo with: (a) a DevTools overlay that shows diff/persist/patches per event, (b) keyed `na-each`, and (c) a Prisma/Postgres adapter with dry-run SQL logging.
