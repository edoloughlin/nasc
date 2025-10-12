const fs = require('fs');
const path = require('path');

function readFile(filepath) {
  return fs.readFileSync(filepath, 'utf8');
}

function listFilesRecursive(dir, exts = ['.ts', '.js']) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(p, exts));
    else if (exts.includes(path.extname(entry.name))) out.push(p);
  }
  return out;
}

// Naive TS interface parser supporting primitives and arrays of named types
function parseTsInterfaces(src) {
  const interfaces = {};
  const ifaceRe = /export\s+interface\s+(\w+)\s*{([\s\S]*?)}/g;
  let m;
  while ((m = ifaceRe.exec(src))) {
    const name = m[1];
    const body = m[2];
    const props = {};
    const required = [];
    const propRe = /(\w+)(\?)?\s*:\s*([^;}\n]+);?/g;
    let pm;
    while ((pm = propRe.exec(body))) {
      const prop = pm[1];
      const optional = !!pm[2];
      const typeSrc = pm[3].trim();
      props[prop] = tsTypeToSchema(typeSrc);
      if (!optional) required.push(prop);
    }
    interfaces[name] = { type: 'object', properties: props, required };
  }
  return interfaces;
}

function tsTypeToSchema(typeSrc) {
  // Simple primitives and arrays of named or primitive types
  const t = typeSrc.replace(/\s+/g, '');
  if (t === 'string') return { type: 'string' };
  if (t === 'number') return { type: 'number' };
  if (t === 'boolean') return { type: 'boolean' };
  const arr = /^(.+)\[\]$/.exec(t);
  if (arr) {
    const inner = arr[1];
    const item = tsTypeToSchema(inner);
    if (item.$ref || item.type) return { type: 'array', items: item };
  }
  // Named type -> $ref
  if (/^[A-Z]\w*$/.test(t)) {
    // Common suffix normalizations: FooItem -> Foo
    const norm = t.endsWith('Item') ? t.slice(0, -4) : t;
    return { $ref: `#/$defs/${norm}` };
  }
  // Fallback to any
  return { };
}

// Very minimal JSDoc typedef parser: /** @typedef {Object} Name * @property {string} foo */
function parseJsDocTypedefs(src) {
  const typedefs = {};
  const blocks = src.match(/\/\*\*[\s\S]*?\*\//g) || [];
  for (const block of blocks) {
    const nameMatch = /@typedef\s+\{Object\}\s+(\w+)/.exec(block);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    const props = {};
    const required = [];
    const propRe = /@property\s+\{([^}]+)\}\s+(\w+)/g;
    let pm;
    while ((pm = propRe.exec(block))) {
      const typeSrc = pm[1].trim();
      const prop = pm[2];
      props[prop] = jsDocTypeToSchema(typeSrc);
      required.push(prop);
    }
    typedefs[name] = { type: 'object', properties: props, required };
  }
  return typedefs;
}

function jsDocTypeToSchema(typeSrc) {
  const t = typeSrc.replace(/\s+/g, '');
  if (t === 'string') return { type: 'string' };
  if (t === 'number') return { type: 'number' };
  if (t === 'boolean') return { type: 'boolean' };
  const arr = /^Array<(.+)>$/.exec(t);
  if (arr) {
    const inner = arr[1];
    const item = jsDocTypeToSchema(inner);
    return { type: 'array', items: item };
  }
  if (/^[A-Z]\w*$/.test(t)) return { $ref: `#/$defs/${t}` };
  return {};
}

function extractHandlers(src) {
  // Find exported const FooHandler = { ... } and mount return type Promise<Bar>
  const handlers = [];
  const re = /export\s+const\s+(\w+)Handler\s*=\s*{[\s\S]*?}\s*;/g;
  let m;
  while ((m = re.exec(src))) {
    const typeName = m[1];
    const block = m[0];
    const rtm = /mount\s*\([^)]*\)\s*:\s*Promise<([A-Za-z0-9_]+)>/.exec(block);
    const returnType = rtm ? rtm[1] : null;
    handlers.push({ name: typeName, returnType });
  }
  return handlers;
}

function mergeDefs(target, add) {
  for (const [k, v] of Object.entries(add)) target[k] = v;
  return target;
}

function buildTypeGraph(handlersDir) {
  const files = listFilesRecursive(handlersDir);
  const defs = {};
  const handlerTypes = new Map(); // HandlerName -> return type
  for (const file of files) {
    const src = readFile(file);
    if (file.endsWith('.ts')) mergeDefs(defs, parseTsInterfaces(src));
    if (file.endsWith('.js')) mergeDefs(defs, parseJsDocTypedefs(src));
    const hs = extractHandlers(src);
    for (const h of hs) handlerTypes.set(h.name, h.returnType || `${h.name}State`);
  }
  return { defs, handlerTypes };
}

function loadAppSchema(schemaPath) {
  const raw = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const defs = (raw && raw.$defs) || {};
  return defs;
}

function compareSchemas(generated, declared) {
  const diffs = [];
  for (const [name, gen] of Object.entries(generated)) {
    const decl = declared[name];
    if (!decl) {
      diffs.push({ path: `#/$defs/${name}`, kind: 'missing', message: `Missing in app.schema.json` });
      continue;
    }
    compareObject(defsPath(name), gen, decl, diffs);
  }
  return diffs;
}

function defsPath(name) { return `#/$defs/${name}`; }

function compareObject(pathBase, a, b, diffs) {
  if (!a || !b || a.type !== 'object' || b.type !== 'object') return;
  const aProps = a.properties || {};
  const bProps = b.properties || {};
  for (const [k, av] of Object.entries(aProps)) {
    const p = `${pathBase}/properties/${k}`;
    const bv = bProps[k];
    if (!bv) return diffs.push({ path: p, kind: 'missing', message: `Property missing in schema` });
    else compareType(p, av, bv, diffs);
  }
  for (const k of Object.keys(bProps)) {
    if (!(k in aProps)) diffs.push({ path: `${pathBase}/properties/${k}`, kind: 'extra', message: `Property not present in types` });
  }
  const aReq = new Set(a.required || []);
  const bReq = new Set(b.required || []);
  for (const k of aReq) if (!bReq.has(k)) diffs.push({ path: `${pathBase}/required`, kind: 'required-missing', message: `Required '${k}' not marked required in schema` });
  for (const k of bReq) if (!aReq.has(k)) diffs.push({ path: `${pathBase}/required`, kind: 'required-extra', message: `Schema requires '${k}' which is optional in types` });
}

function compareType(pathBase, a, b, diffs) {
  if (a.$ref && b.$ref) {
    if (a.$ref !== b.$ref) diffPush(diffs, pathBase, 'ref-mismatch', `Ref mismatch: ${a.$ref} vs ${b.$ref}`);
    return;
  }
  if (a.type && b.type && a.type !== b.type) {
    diffPush(diffs, pathBase, 'type-mismatch', `Type mismatch: ${a.type} vs ${b.type}`);
    return;
  }
  if (a.type === 'array' && b.type === 'array') {
    compareType(`${pathBase}/items`, a.items || {}, b.items || {}, diffs);
  }
}

function generateFromHandlers(handlersDir) {
  const { defs, handlerTypes } = buildTypeGraph(handlersDir);
  // Include only defs that are referenced by handlerTypes (by return type name)
  const wanted = new Set(Array.from(handlerTypes.values()).filter(Boolean));
  const out = {};
  for (const name of wanted) {
    // Prefer mapping FooState -> Foo when applicable
    if (name.endsWith('State')) {
      const base = name.slice(0, -5);
      if (defs[base]) { out[base] = defs[base]; continue; }
      if (defs[name]) { out[base] = defs[name]; continue; }
    }
    if (defs[name]) { out[name] = defs[name]; continue; }
  }
  return out;
}

function runCheck({ handlersDir, schemaPath, strict = false }) {
  const generated = generateFromHandlers(handlersDir);
  const declared = loadAppSchema(schemaPath);
  const diffs = compareSchemas(generated, declared);
  if (diffs.length === 0) {
    console.log('[nasc] Schema types match handlers ✔');
    return 0;
  }
  const header = strict || process.env.STRICT_SCHEMA_TYPES === 'true'
    ? '[nasc] Schema type mismatches (STRICT mode):'
    : '[nasc] Schema type mismatches (warnings):';
  console.log(header);
  for (const d of diffs) console.log(` - ${d.path}: ${d.message}`);
  return (strict || process.env.STRICT_SCHEMA_TYPES === 'true') ? 1 : 0;
}

module.exports = {
  parseTsInterfaces,
  parseJsDocTypedefs,
  buildTypeGraph,
  generateFromHandlers,
  compareSchemas,
  runCheck,
};
