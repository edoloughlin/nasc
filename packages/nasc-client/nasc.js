/**
 * Nasc client: dual-transport (WS or SSE + POST)
 * - transport.connect(onOpen, onPatches)
 * - transport.send(event)
 * - apply scoped patches to elements with na-bind within the matching na-scope
 */
export function connect(arg) {
  const transport = createTransport(arg);

  transport.connect(onOpen, onPatches);

  // Schema cache by type (from server 'schema' patches)
  const schemaByType = new Map();
  // Track bindings we've already validated (type.prop)
  const validatedOnce = new Set();

  function resolveType(container, instance) {
    try {
      const t = container.getAttribute('na-type');
      if (t) return t;
      const mapHook = (window && window.NASC_OPTIONS && typeof window.NASC_OPTIONS.mapScopeToType === 'function')
        ? window.NASC_OPTIONS.mapScopeToType
        : null;
      if (mapHook) {
        const mapped = mapHook(instance, container);
        if (typeof mapped === 'string' && mapped) return mapped;
      }
    } catch {}
    return '';
  }

  function resolveEffectiveInstance(instance, type, container) {
    try {
      if (instance && instance[0] === '$') {
        const mapHook = (window && window.NASC_OPTIONS && typeof window.NASC_OPTIONS.mapScopeToInstance === 'function')
          ? window.NASC_OPTIONS.mapScopeToInstance
          : null;
        if (mapHook) {
          const mapped = mapHook(instance, type, container);
          if (typeof mapped === 'string' && mapped) return mapped;
        }
        return 'root';
      }
    } catch {}
    return instance || '';
  }

  function getBasePathSegments(container) {
    try {
      const scope = container.getAttribute('na-scope') || '';
      if (scope && scope[0] === '$') {
        const segs = scope.slice(1).split('.').map(s => s.trim()).filter(Boolean);
        return segs;
      }
    } catch {}
    return [];
  }

  function parsePathExpression(expr, container) {
    let absolute = false;
    let path = expr || '';
    const idx = path.indexOf(':');
    if (idx >= 0) path = path.slice(idx + 1);
    if (path.startsWith('$')) { absolute = true; path = path.slice(1); }
    const segs = path.split('.').map(s => s.trim()).filter(Boolean);
    const base = absolute ? [] : getBasePathSegments(container);
    return { absolute, segments: base.concat(segs) };
  }

  function pathGet(root, segments) {
    try {
      let cur = root;
      for (const s of segments) {
        if (cur == null) return undefined;
        if (typeof cur !== 'object') return undefined;
        cur = cur[s];
      }
      return cur;
    } catch { return undefined; }
  }

  function isInteractiveScope(container) {
    try {
      if (container.querySelector('[na-submit]')) return true;
      if (container.querySelector('[na-click]')) return true;
      if (container.querySelector('template[na-each]')) return true;
      // Relative binds (not starting with $)
      const relBind = container.querySelector('[na-bind]');
      if (relBind) {
        const val = relBind.getAttribute('na-bind') || '';
        if (val && !val.startsWith('$')) return true;
      }
    } catch {}
    return false;
  }

  function onOpen() {
    console.log("[nasc] connected");
    // If SSR has already rendered content, don't re-mount
    const mountSent = new Set();
    const byScope = new Map(); // scope -> { types:Set<string>, entries:[{el,type}] }
    document.querySelectorAll("[na-scope]").forEach(container => {
      const rawInstance = container.getAttribute("na-scope") || '';
      const type = resolveType(container, rawInstance);
      const instance = resolveEffectiveInstance(rawInstance, type, container);
      try { container.setAttribute('data-na-instance', instance); } catch {}
      // Track for conflict detection
      const rec = byScope.get(instance) || { types: new Set(), entries: [] };
      if (type) rec.types.add(type);
      rec.entries.push({ el: container, type });
      byScope.set(instance, rec);

      // Missing type handling
      if (!type) {
        if (isInteractiveScope(container)) {
          reportValidationError(`[nasc] Missing na-type for interactive scope '${instance}'`, container);
          return;
        } else {
          warnOnce(`[nasc] Missing na-type for display-only scope '${instance}'`);
          return;
        }
      }
      const key = `${instance}::${type}`;
      if (mountSent.has(key)) return;
      mountSent.add(key);
      transport.send({ event: "mount", instance, type, payload: {} });
    });
    // Conflict detection: same scope with multiple types
    byScope.forEach((rec, scope) => {
      const types = Array.from(rec.types);
      if (types.length > 1) {
        rec.entries.forEach(({ el, type }) => {
          reportValidationError(`[nasc] Conflicting na-scope/na-type for '${scope}': ${types.join(', ')}`, el);
        });
      }
    });
  }

  function onPatches(patches) {
    for (const p of patches) {
      if (p.action === "error") {
        console.error("[nasc error]", p.message);
        continue;
      }
      if (p.action === "schema") {
        try {
          schemaByType.set(p.type, p.schema);
          window.__NASC_SCHEMAS = window.__NASC_SCHEMAS || {};
          window.__NASC_SCHEMAS[p.type] = p.schema;
        } catch {}
        // Schedule a DOM validation for all instances of this type
        try { scheduleTypeValidation(p.type); } catch {}
        continue;
      }
      if (p.action === "bindUpdate") {
        // Validate binding once per type.property using cached schema
        const type = String(p.type || "");
        const schema = type ? schemaByType.get(type) : undefined;
        const key = type ? `${type}.${p.prop}` : `${p.prop}`;
        if (schema && !validatedOnce.has(key)) {
          if (!validateBinding(schema, p.prop, p.value)) {
            const containerEl = document.querySelector(`[data-na-instance="${p.instance}"]`) || document.querySelector(`[na-scope="${p.instance}"]`);
            const typedSel = type ? `[na-bind="${type}:${p.prop}"]` : '';
            const el = containerEl && (containerEl.querySelector(`[na-bind="${p.prop}"]`) || containerEl.querySelector(typedSel) || containerEl.querySelector(`[ng-bind="${p.prop}"]`));
            reportValidationError(`Schema mismatch for ${type}.${p.prop}`, el || containerEl || null);
          }
          validatedOnce.add(key);
        }
        let containers = document.querySelectorAll(`[data-na-instance="${p.instance}"]`);
        if (!containers || !containers.length) {
          containers = document.querySelectorAll(`[na-scope="${p.instance}"]`);
        }
        if (!containers || !containers.length) continue;

        containers.forEach((container) => {
          const root = { [p.prop]: p.value };

          // Handle arrays for all templates (supports relative and absolute paths)
          let handledList = false;
          container.querySelectorAll('template[na-each]').forEach((tmpl) => {
            const expr = tmpl.getAttribute('na-each') || '';
            const { segments } = parsePathExpression(expr, container);
            if (!segments.length) return;
            if (segments[0] !== p.prop) return;
            const items = pathGet(root, segments);
            if (Array.isArray(items)) {
              const listRoot = tmpl.parentElement;
              if (listRoot) {
                applyKeyedDiff(listRoot, items, tmpl);
                handledList = true;
              }
            }
          });
          // Continue to other binds; array values will be ignored for text nodes below

          // Update simple text/value bindings (supports nested and absolute paths; supports Type:prop prefix)
          container.querySelectorAll('[na-bind]').forEach((el) => {
            const bindAttr = el.getAttribute('na-bind') || '';
            const { segments } = parsePathExpression(bindAttr, container);
            if (!segments.length) return;
            if (segments[0] !== p.prop) return;
            const val = pathGet(root, segments);
            if (typeof val === 'undefined') return; // avoid clobbering templated item bindings
            if (Array.isArray(val)) return; // don't write arrays as [object Object]
            const tag = el.tagName.toLowerCase();
            if (tag === 'input') {
              const it = el.getAttribute('type');
              if (it && it.toLowerCase() === 'checkbox') {
                el.checked = !!val;
              } else {
                el.value = val ?? '';
              }
            } else if (tag === 'textarea' || tag === 'select') {
              el.value = val ?? '';
            } else {
              el.textContent = val ?? '';
            }
          });

          // Update inputs with matching ng-bind (supports nested and absolute paths)
          container.querySelectorAll('input[ng-bind], textarea[ng-bind], select[ng-bind]').forEach((el) => {
            const expr = el.getAttribute('ng-bind') || '';
            const { segments } = parsePathExpression(expr, container);
            if (!segments.length) return;
            if (segments[0] !== p.prop) return;
            const val = pathGet(root, segments);
            if (typeof val === 'undefined') return;
            if ('value' in el) el.value = val ?? '';
          });
        });
      }
    }
  }

  function applyKeyedDiff(listRoot, items, template) {
    const tmpl = template || listRoot.querySelector("template");
    if (!tmpl) return;
    const keyName = tmpl.getAttribute("na-key");
    if (!keyName) {
      console.error("[nasc] na-each template requires na-key attribute.");
      return;
    }

    const newKeys = new Set(items.map(item => item[keyName]));
    const existingChildren = Array.from(listRoot.children).filter(el => el.hasAttribute("na-key-val"));

    // Remove old items
    existingChildren.forEach(child => {
      if (!newKeys.has(child.getAttribute("na-key-val"))) {
        child.remove();
      }
    });

    // Add or update items
    items.forEach((item, index) => {
      const keyVal = item[keyName];
      let child = listRoot.querySelector(`[na-key-val="${keyVal}"]`);
      if (!child) {
        child = document.importNode(tmpl.content, true).firstElementChild;
        child.setAttribute("na-key-val", keyVal);
        // Propagate typed scope from template, if provided
        const itemType = tmpl.getAttribute('na-type');
        if (itemType) {
          try { child.setAttribute('data-na-type-scope', itemType); } catch {}
        }
      } else {
        // Ensure existing child retains the type scope from template
        const itemType = tmpl.getAttribute('na-type');
        if (itemType && !child.hasAttribute('data-na-type-scope')) {
          try { child.setAttribute('data-na-type-scope', itemType); } catch {}
        }
      }
      // Ensure correct order: append/move each child before the template anchor
      listRoot.insertBefore(child, tmpl);

      // Update bindings within the item (support typed na-bind="Type:prop")
      child.querySelectorAll("[na-bind]").forEach(el => {
        const bindAttr = el.getAttribute("na-bind");
        if (!bindAttr) return;
        const idx = bindAttr.indexOf(":");
        const prop = idx >= 0 ? bindAttr.slice(idx + 1) : bindAttr;
        if (Object.prototype.hasOwnProperty.call(item, prop)) {
          const tag = el.tagName.toLowerCase();
          if (tag === "input") {
            const type = el.getAttribute('type');
            if (type && type.toLowerCase() === 'checkbox') {
              el.checked = !!item[prop];
            } else {
              el.value = item[prop] ?? "";
            }
          } else if (tag === "textarea" || tag === "select") {
            el.value = item[prop] ?? "";
          } else {
            el.textContent = item[prop] ?? "";
          }
        }
      });
      // Update data attributes for clicks, etc.
      child.querySelectorAll("[data-id]").forEach(el => {
        el.setAttribute("data-id", keyVal);
      });
    });
  }

  // Form submit -> event
  document.addEventListener("submit", (e) => {
    const form = e.target;
    if (!form.hasAttribute("na-submit")) return;
    e.preventDefault();
    const container = form.closest("[na-scope]");
    const rawInstance = container?.getAttribute("na-scope");
    const type = container ? (resolveType(container, rawInstance) || undefined) : undefined;
    const instance = container ? resolveEffectiveInstance(rawInstance || '', type || '', container) : undefined;
    if (!type) {
      reportValidationError(`[nasc] Missing na-type for event scope '${instance}'`, container || null);
      return;
    }
    // Build payload from ng-bind controls only
    const payload = {};
    form.querySelectorAll('input[ng-bind], textarea[ng-bind], select[ng-bind]').forEach((ctl) => {
      const key = ctl.getAttribute('ng-bind') || '';
      if (!key) return;
      let val;
      const it = ctl.getAttribute('type');
      if (it && it.toLowerCase() === 'checkbox') {
        val = !!ctl.checked;
      } else {
        val = 'value' in ctl ? ctl.value : undefined;
      }
      if (typeof val !== 'undefined') payload[key] = val;
    });
    transport.send({
      event: form.getAttribute("na-submit"),
      instance,
      type,
      payload
    });
  });

  // Click -> event (with data-* collected)
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[na-click]");
    if (!el) return;
    e.preventDefault();
    const container = el.closest("[na-scope]");
    const rawInstance = container?.getAttribute("na-scope");
    const type = container ? (resolveType(container, rawInstance) || undefined) : undefined;
    const instance = container ? resolveEffectiveInstance(rawInstance || '', type || '', container) : undefined;
    if (!type) {
      reportValidationError(`[nasc] Missing na-type for event scope '${instance}'`, container || null);
      return;
    }
    const payload = {};
    for (const { name, value } of el.attributes) {
      if (name.startsWith("data-")) payload[name.slice(5)] = value;
    }
    transport.send({
      event: el.getAttribute("na-click"),
      instance,
      type,
      payload
    });
  });
}

// Auto-connect when body has na-connect, to minimize boilerplate in apps
try {
  const auto = () => {
    try {
      if (document.body && document.body.hasAttribute('na-connect')) {
        if (!window.__NASC_AUTOCONNECTED) {
          window.__NASC_AUTOCONNECTED = true;
          connect({});
        }
      }
    } catch {}
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
  else auto();
} catch {}

// Minimal validator: handles object->properties with primitive types and arrays
function validateBinding(schema, prop, value) {
  try {
    if (!schema || typeof schema !== 'object') return true;
    const props = schema.properties || {};
    if (!Object.prototype.hasOwnProperty.call(props, prop)) {
      // Unknown property in schema: warn once, but do not treat as an error
      warnOnce(`[nasc] Unknown property per schema: ${prop}`);
      return true;
    }
    const propSchema = props[prop] || {};
    const expected = propSchema.type;
    if (!expected) return true; // nothing to validate
    if (value == null) return true; // allow null/undefined to pass silently
    switch (expected) {
      case 'string': return typeof value === 'string';
      case 'number': return typeof value === 'number';
      case 'integer': return Number.isInteger(value);
      case 'boolean': return typeof value === 'boolean';
      case 'array': return Array.isArray(value);
      case 'object': return typeof value === 'object' && !Array.isArray(value);
      default: return true;
    }
  } catch {
    return true;
  }
}

let __nascErrorBox;
const __nascErrorSeen = new Set();
const __nascWarnSeen = new Set();
function warnOnce(msg) {
  if (__nascWarnSeen.has(msg)) return;
  __nascWarnSeen.add(msg);
  console.warn(msg);
}
function reportValidationError(message, targetEl) {
  try {
    const path = targetEl ? getDomPath(targetEl) : '';
    const key = path ? `${message} @ ${path}` : message;
    if (__nascErrorSeen.has(key)) return; // de-dupe overlay entries
    __nascErrorSeen.add(key);
    if (!__nascErrorBox) {
      const box = document.createElement('div');
      box.style.position = 'fixed';
      box.style.top = '12px';
      box.style.right = '12px';
      box.style.maxWidth = '360px';
      box.style.background = 'rgba(180, 0, 0, 0.9)';
      box.style.color = '#fff';
      box.style.padding = '8px 10px';
      box.style.font = '12px/1.4 system-ui, sans-serif';
      box.style.borderRadius = '6px';
      box.style.zIndex = '99999';
      box.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
      box.textContent = 'Nasc schema validation errors:';
      const list = document.createElement('ul');
      list.style.margin = '6px 0 0 16px';
      list.style.padding = '0';
      list.style.listStyle = 'disc';
      box.appendChild(list);
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { box.remove(); __nascErrorBox = null; }
      });
      document.body.appendChild(box);
      __nascErrorBox = { box, list };
    }
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = message;
    li.appendChild(label);
    if (targetEl) {
      const where = document.createElement('button');
      where.textContent = 'Reveal';
      where.style.marginLeft = '8px';
      where.style.padding = '2px 6px';
      where.style.font = '11px system-ui, sans-serif';
      where.style.cursor = 'pointer';
      where.style.background = '#fff';
      where.style.color = '#900';
      where.style.border = 'none';
      where.style.borderRadius = '3px';
      where.addEventListener('click', (e) => {
        e.preventDefault();
        try {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          flashHighlight(targetEl);
        } catch {}
      });
      li.appendChild(where);
    }
    __nascErrorBox.list.appendChild(li);
  } catch (e) {
    console.error('[nasc] schema validation error:', message);
  }
}

// Determine if overlay is enabled (currently always enabled in demo).

function flashHighlight(el) {
  try {
    const prevOutline = el.style.outline;
    el.style.outline = '2px solid #ff4d4f';
    setTimeout(() => { try { el.style.outline = prevOutline || ''; } catch {} }, 2000);
  } catch {}
}

function getDomPath(el) {
  try {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 5) {
      const name = node.nodeName.toLowerCase();
      let sel = name;
      if (node.id) sel += `#${node.id}`;
      else {
        const bind = node.getAttribute('na-bind');
        const nm = node.getAttribute('name');
        if (bind) sel += `[na-bind="${bind}"]`;
        else if (nm) sel += `[name="${nm}"]`;
      }
      parts.unshift(sel);
      node = node.parentElement;
    }
    return parts.join(' > ');
  } catch { return ''; }
}

// Validate all declared DOM bindings under a given instance container against the schema
// Flags unknown properties as errors (overlay) since they won't be caught by patch-time checks.
function getContainerForInstance(instance) {
  try { return document.querySelector(`[na-scope="${instance}"]`); } catch { return null; }
}

function validateDeclaredBindings(instance, type) {
  const container = getContainerForInstance(instance);
  if (!container) return;
  const schema = (window.__NASC_SCHEMAS && window.__NASC_SCHEMAS[type]) || null;
  if (!schema || !schema.properties) return;
  const props = schema.properties || {};

  // na-bind attributes (support explicit typing via na-type, ancestor data-na-type-scope, or Type:prop)
  container.querySelectorAll('[na-bind]').forEach((el) => {
    const bindAttr = el.getAttribute('na-bind');
    if (!bindAttr) return;
    const explicitType = el.getAttribute('na-type');
    const colonIdx = bindAttr.indexOf(':');
    const typed = colonIdx >= 0 ? { t: bindAttr.slice(0, colonIdx), p: bindAttr.slice(colonIdx + 1) } : null;
    let propExpr = typed ? typed.p : bindAttr;
    if (propExpr.startsWith('$')) propExpr = propExpr.slice(1);
    const prop = (propExpr.split('.')[0] || '').trim();
    let targetType = explicitType || (typed && typed.t) || type;
    // If inside a template with na-type, prefer that as targetType
    const tmpl = el.closest('template[na-each]');
    if (!explicitType && !typed && tmpl && tmpl.hasAttribute('na-type')) {
      targetType = tmpl.getAttribute('na-type') || targetType;
    }
    // If cloned out of a template, a parent may carry data-na-type-scope
    if (!explicitType && !typed && (!tmpl || !tmpl.hasAttribute('na-type'))) {
      const scoped = el.closest('[data-na-type-scope]');
      if (scoped) {
        const t = scoped.getAttribute('data-na-type-scope');
        if (t) targetType = t;
      }
    }
    // If still inside a template and no explicit type, try schema $ref inference
    if (!explicitType && !typed && tmpl && !tmpl.hasAttribute('na-type')) {
      const parentProp = tmpl.getAttribute('na-each');
      const parentPropSchema = props[parentProp] || {};
      const ref = parentPropSchema && parentPropSchema.items && parentPropSchema.items.$ref;
      if (ref && ref.startsWith('#/$defs/')) targetType = ref.slice('#/$defs/'.length);
    }
    const targetSchema = (window.__NASC_SCHEMAS && window.__NASC_SCHEMAS[targetType]) || null;
    const targetProps = (targetSchema && targetSchema.properties) || {};
    if (!prop || !Object.prototype.hasOwnProperty.call(targetProps, prop)) {
      reportValidationError(`Unknown binding ${targetType}.${prop}`, el);
    }
  });

  // ng-bind on form controls
  container.querySelectorAll('input[ng-bind], textarea[ng-bind], select[ng-bind]').forEach((el) => {
    const expr = el.getAttribute('ng-bind');
    if (!expr) return;
    const explicitType = el.getAttribute('na-type');
    const raw = expr[0] === '$' ? expr.slice(1) : expr;
    const topProp = (raw.split('.')[0] || '').trim();
    let targetType = explicitType || type;
    const tmpl = el.closest('template[na-each]');
    if (!explicitType && tmpl && tmpl.hasAttribute('na-type')) {
      targetType = tmpl.getAttribute('na-type') || targetType;
    } else if (!explicitType && tmpl && !tmpl.hasAttribute('na-type')) {
      const parentProp = tmpl.getAttribute('na-each');
      const parentPropSchema = props[parentProp] || {};
      const ref = parentPropSchema && parentPropSchema.items && parentPropSchema.items.$ref;
      if (ref && ref.startsWith('#/$defs/')) targetType = ref.slice('#/$defs/'.length);
    }
    if (!explicitType && !tmpl) {
      const scoped = el.closest('[data-na-type-scope]');
      if (scoped) {
        const t = scoped.getAttribute('data-na-type-scope');
        if (t) targetType = t;
      }
    }
    const targetSchema = (window.__NASC_SCHEMAS && window.__NASC_SCHEMAS[targetType]) || null;
    const targetProps = (targetSchema && targetSchema.properties) || {};
    if (!topProp || !Object.prototype.hasOwnProperty.call(targetProps, topProp)) {
      // Heuristic: if this top-level control is not inside a template and
      // the prop exists on a child item type used by a template in this container,
      // treat it as an event-only field and do not flag an error.
      if (!tmpl && !explicitType) {
        const childTypes = [];
        container.querySelectorAll('template[na-each]').forEach((t) => {
          let cType = t.getAttribute('na-type');
          if (!cType) {
            const parentProp2 = t.getAttribute('na-each');
            const parentPropSchema2 = props[parentProp2] || {};
            const ref2 = parentPropSchema2 && parentPropSchema2.items && parentPropSchema2.items.$ref;
            if (ref2 && ref2.startsWith('#/$defs/')) cType = ref2.slice('#/$defs/'.length);
          }
          if (cType) childTypes.push(cType);
        });
        for (const ct of childTypes) {
          const cs = window.__NASC_SCHEMAS && window.__NASC_SCHEMAS[ct];
          const cp = (cs && cs.properties) || {};
          if (Object.prototype.hasOwnProperty.call(cp, topProp)) {
            return; // skip error; likely event-only control (e.g., add_todo.title)
          }
        }
      }
      reportValidationError(`Unknown field ${targetType}.${topProp}`, el);
    }
  });

  // Flag use of name without ng-bind
  container.querySelectorAll('input[name], textarea[name], select[name]').forEach((el) => {
    if (!el.hasAttribute('ng-bind')) {
      reportValidationError('Use ng-bind for form fields (name is not supported)', el);
    }
  });
}

const __scheduledTypeValidation = new Set();
function scheduleTypeValidation(type) {
  if (__scheduledTypeValidation.has(type)) return;
  __scheduledTypeValidation.add(type);
  const run = () => {
    try {
      const schema = (window.__NASC_SCHEMAS && window.__NASC_SCHEMAS[type]) || null;
      if (!schema || !schema.properties) return;
      const containers = document.querySelectorAll(`[na-scope][na-type="${type}"]`);
      containers.forEach((el) => {
        const inst = el.getAttribute('na-scope');
        if (inst) validateDeclaredBindings(inst, type);
      });
    } catch {}
  };
  // Run at multiple points to avoid timing issues with head scripts
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
    // Fallback after a short delay in case late DOM mutations happen
    setTimeout(run, 50);
  } else {
    // Try on next microtask and next frame
    Promise.resolve().then(run);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => run());
    setTimeout(run, 0);
  }
}

function createTransport(arg) {
  // Back-compat: string argument is treated as WS URL
  if (typeof arg === 'string') {
    return createWebSocketTransport(arg);
  }
  const opts = arg || {};
  let transport = opts.transport;
  // If not explicitly provided, allow query param override
  if (!transport) {
    const qp = getQueryTransport();
    if (qp === 'ws' || qp === 'sse') transport = qp;
  }
  // Default to SSE when unspecified
  transport = transport || 'sse';
  if (transport === 'sse') return createSseTransport(opts);
  return createWebSocketTransport(opts.wsUrl || inferWsUrl());
}

function inferWsUrl() {
  return (location.protocol === "https:" ? "wss://" : "ws://") + location.host;
}

function getQueryTransport() {
  try {
    const sp = new URLSearchParams(location.search);
    return (sp.get('transport') || '').toLowerCase();
  } catch {
    return '';
  }
}

function getClientId() {
  try {
    const key = 'nascClientId';
    let id = localStorage.getItem(key);
    if (!id) {
      id = Math.random().toString(36).slice(2);
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

// No explicit schema fetch; schema is pushed from the server via a `schema` patch on mount.

function createSseTransport({ baseUrl, autoFallback = true } = {}) {
  const origin = baseUrl || '';
  const clientId = getClientId();
  let onOpenCb = () => {};
  let onPatchesCb = () => {};
  let opened = false;
  let errorCount = 0;

  return {
    connect(onOpen, onPatches) {
      onOpenCb = onOpen; onPatchesCb = onPatches;
      // Prefer the namespaced path; server also exposes /events as a back-compat alias
      const es = new EventSource(`${origin}/nasc/stream?clientId=${encodeURIComponent(clientId)}`);
      es.onopen = () => { opened = true; errorCount = 0; onOpenCb && onOpenCb(); };
      es.onmessage = (ev) => {
        try {
          const patches = JSON.parse(ev.data);
          onPatchesCb && onPatchesCb(patches);
        } catch (e) {
          console.error('[nasc] bad SSE data', e);
        }
      };
      es.onerror = (e) => {
        // EventSource will auto-reconnect; just log for now
        console.warn('[nasc] SSE error', e);
        errorCount++;
        // If we haven't opened yet and errors persist, or if the stream closes hard, fallback to WS
        if (autoFallback) {
          const shouldFallbackEarly = !opened && errorCount >= 2; // two consecutive errors before open
          const closed = es.readyState === 2; // CLOSED
          if (shouldFallbackEarly || closed) {
            try { es.close(); } catch {}
            console.warn('[nasc] Falling back to WebSocket transport');
            const wsT = createWebSocketTransport(inferWsUrl());
            // Replace this transport’s methods to delegate to WS
            this.connect = (onOpen2, onPatches2) => wsT.connect(onOpen2, onPatches2);
            this.send = (msg) => wsT.send(msg);
            this.close = () => wsT.close();
            wsT.connect(onOpenCb, onPatchesCb);
          }
        }
      };
      this._es = es;
    },
    async send(message) {
      try {
        await fetch(`${origin}/nasc/event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...message, clientId })
        });
      } catch (e) {
        console.error('[nasc] send failed', e);
      }
    },
    close() { try { this._es && this._es.close(); } catch {} }
  };
}

function createWebSocketTransport(wsUrl) {
  let ws;
  let onOpenCb = () => {};
  let onPatchesCb = () => {};
  return {
    connect(onOpen, onPatches) {
      onOpenCb = onOpen; onPatchesCb = onPatches;
      ws = new WebSocket(wsUrl);
      ws.onopen = () => onOpenCb && onOpenCb();
      ws.onmessage = (ev) => {
        try {
          const patches = JSON.parse(ev.data);
          onPatchesCb && onPatchesCb(patches);
        } catch (e) {
          console.error('[nasc] bad WS data', e);
        }
      };
      ws.onerror = (e) => console.warn('[nasc] WS error', e);
      this._ws = ws;
    },
    send(message) {
      try {
        this._ws && this._ws.send(JSON.stringify(message));
      } catch (e) {
        console.error('[nasc] send failed', e);
      }
    },
    close() { try { this._ws && this._ws.close(); } catch {} }
  };
}
