function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

class MemoryStore {
  constructor() {
    this.data = new Map();
  }
  async load(type, id) {
    return this.data.get(`${type}:${id}`);
  }
  async persist(type, id, diff, full) {
    // For MVP, store the full object keyed by type:id
    this.data.set(`${type}:${id}`, deepClone(full));
  }
}

function diffObjects(a = {}, b = {}) {
  const changed = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const av = a[k];
    const bv = b[k];
    if (JSON.stringify(av) !== JSON.stringify(bv)) {
      changed[k] = bv;
    }
  }
  return changed;
}

/**
 * applyEvent(handler, event, payload, current, store, type, id)
 * - invoke the event on the handler
 * - compute diff
 * - persist via store
 */
async function applyEvent(handler, event, payload, current, store, type, id, dryRun = false) {
  const fn = handler[event];
  if (typeof fn !== "function") throw new Error(`Unknown event '${event}' for ${type}`);
  const newState = await fn.call(handler, payload, deepClone(current));
  const diff = diffObjects(current, newState);

  console.log(`
--- ${dryRun ? "DRY RUN" : "PERSISTENCE"} PLAN ---
  Type:    ${type}
  ID:      ${id}
  Event:   ${event}
  Payload: ${JSON.stringify(payload)}
  ----------------------
  State:   ${JSON.stringify(current)}
  Diff:    ${JSON.stringify(diff)}
  New:     ${JSON.stringify(newState)}
--- END PLAN ---
`);

  if (!dryRun) {
    await store.persist(type, id, diff, newState);
  }
  return { diff, newState };
}

module.exports = {
  MemoryStore,
  applyEvent
};
