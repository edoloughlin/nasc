const { MemoryStore, applyEvent } = require("./engine");
const path = require("path");
const fs = require("fs").promises;
// Optional WebSocket support: lazily require 'ws' if available
let WebSocketServer;
try {
  ({ WebSocketServer } = require("ws"));
} catch {
  WebSocketServer = undefined;
}

// Shared processor factory to be used by both WS and SSE paths
function createProcessor(handlers, store, options = {}) {
  const getSchema = options.schemaProvider ? normalizeSchemaProvider(options.schemaProvider) : async () => null;
  function referencedChildTypes(rootSchema) {
    try {
      const out = new Set();
      const props = (rootSchema && rootSchema.properties) || {};
      for (const [, prop] of Object.entries(props)) {
        if (prop && typeof prop === 'object' && prop.type === 'array' && prop.items && typeof prop.items === 'object') {
          const ref = prop.items.$ref;
          if (typeof ref === 'string' && ref.startsWith('#/$defs/')) {
            out.add(ref.slice('#/$defs/'.length));
          }
        }
      }
      return Array.from(out);
    } catch { return []; }
  }
  return async function processMessage(message) {
    try {
      const { event, instance, payload } = message;
      const [type, id] = (instance || "").split(":");
      const handler = handlers[type];
      if (!handler) {
        return [{ action: "error", message: `Unknown handler for type '${type}'` }];
      }

      let current = await store.load(type, id);
      if (event === "mount" && !current) {
        const mountParams = payload || {};
        mountParams[`${type.toLowerCase()}Id`] = id;
        current = await handler.mount(mountParams);
        await store.persist(type, id, current, current);

        const initialPatches = [];
        // Optionally include schema first
        try {
          const schema = await getSchema(type);
          if (schema) {
            initialPatches.push({ action: "schema", instance, type, schema });
            // Also push referenced child type schemas (e.g., array item $ref)
            for (const ct of referencedChildTypes(schema)) {
              try {
                const cs = await getSchema(ct);
                if (cs) initialPatches.push({ action: "schema", instance, type: ct, schema: cs });
              } catch {}
            }
          }
        } catch {}
        // Then include initial bind updates
        initialPatches.push(...Object.entries(current).map(([prop, value]) => ({
          action: "bindUpdate",
          instance,
          prop,
          value,
        })));
        return initialPatches; // Mount is a special case
      }
      if (event === "mount" && current) {
        // Already mounted; push schema(s) and current state as bindUpdate patches for hydration
        const initialPatches = [];
        try {
          const schema = await getSchema(type);
          if (schema) {
            initialPatches.push({ action: "schema", instance, type, schema });
            for (const ct of referencedChildTypes(schema)) {
              try {
                const cs = await getSchema(ct);
                if (cs) initialPatches.push({ action: "schema", instance, type: ct, schema: cs });
              } catch {}
            }
          }
        } catch {}
        // Also re-send current properties to hydrate the client (arrays trigger list render)
        initialPatches.push(
          ...Object.entries(current).map(([prop, value]) => ({
            action: "bindUpdate",
            instance,
            prop,
            value,
          }))
        );
        return initialPatches;
      }

      if (!current) {
        return [{ action: "error", message: `Instance ${instance} not mounted.` }];
      }

      const { diff } = await applyEvent(handler, event, payload, current, store, type, id, false);

      const patches = Object.entries(diff).map(([prop, value]) => ({
        action: "bindUpdate",
        instance,
        prop,
        value,
      }));

      return patches.length ? patches : [];
    } catch (e) {
      console.error(e);
      return [{ action: "error", message: e.message }];
    }
  };
}

function NascServer(wss, handlers, options = {}) {
  const store = options.store || new MemoryStore();
  const processMessage = createProcessor(handlers, store, { schemaProvider: options.schemaProvider });

  wss.on("connection", (ws) => {
    ws.on("message", async (msg) => {
      const patches = await processMessage(JSON.parse(msg.toString()));
      if (patches && patches.length) {
        ws.send(JSON.stringify(patches));
      }
    });
  });

  // Optionally attach HTTP schema endpoints if an Express app is provided
  if (options.attachApp) {
    const app = options.attachApp;
    const provider = options.schemaProvider;
    const schemaHandler = createSchemaHandler(provider);
    if (app && typeof app.get === 'function') {
      app.get('/nasc/schema/:type', schemaHandler);
      app.get('/nasc/schema', schemaHandler);
    }
  }

  return { store, processMessage };
}

// Schema utilities
function normalizeSchemaProvider(provider) {
  if (typeof provider === 'function') {
    return async (type) => provider(type);
  }
  if (provider && typeof provider === 'object') {
    return async (type) => provider[type] || null;
  }
  return async () => null;
}

function createSchemaHandler(provider) {
  const getSchema = normalizeSchemaProvider(provider);
  return async function schemaHandler(req, res) {
    try {
      const type = (req.params && req.params.type) || (req.query && req.query.type);
      if (!type) {
        // No type: return 400 or list available if provider is a map
        if (provider && typeof provider === 'object') {
          res.json({ types: Object.keys(provider) });
          return;
        }
        res.status(400).json({ error: 'Missing type parameter' });
        return;
      }
      const schema = await getSchema(type);
      if (!schema) {
        res.status(404).json({ error: `Schema not found for type '${type}'` });
        return;
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.json(schema);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  };
}

module.exports = { NascServer, createProcessor, MemoryStore, createSchemaHandler, normalizeSchemaProvider };

// High-level convenience: attach full Nasc stack to an Express app + HTTP server
// Options: { app, server, handlers, schemaProvider, ssr: { rootDir } }
function attachNasc(options = {}) {
  const app = options.app;
  const server = options.server;
  const handlers = options.handlers || {};
  const schemaProvider = options.schemaProvider;
  if (!app || !server) throw new Error("attachNasc requires { app, server }");

  // Shared store + processor for both transports
  const store = options.store || new MemoryStore();
  const processMessage = createProcessor(handlers, store, { schemaProvider });

  // Helper: obtain express or report helpful error
  function getExpress() {
    try { return require('express'); }
    catch {
      throw new Error("[Nasc] 'express' not found. Install it at the repo root so packages/nasc-server can resolve it (e.g., run 'pnpm i' at the root).");
    }
  }

  // JSON body parser for event POSTs
  if (app.use) app.use(getExpress().json());

  // Serve client library
  const clientDir = path.resolve(__dirname, "../nasc-client");
  if (app.use) app.use(getExpress().static(clientDir));

  // Optionally serve demo/app static root
  const rootDir = options.ssr && options.ssr.rootDir ? options.ssr.rootDir : null;
  if (rootDir && app.use) app.use(getExpress().static(rootDir));

  // SSE endpoints
  const sseClients = new Map(); // clientId -> { res, keepalive }
  function sendSse(clientId, patches, eventId) {
    const entry = sseClients.get(clientId);
    if (!entry) return false;
    const res = entry.res;
    if (eventId) res.write(`id: ${eventId}\n`);
    res.write(`data: ${JSON.stringify(patches)}\n\n`);
    return true;
  }
  function sseHandler(req, res) {
    const clientId = (req.query && req.query.clientId) || Math.random().toString(36).slice(2);
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders && res.flushHeaders();
    res.write(`: connected ${clientId}\n\n`);
    const keepalive = setInterval(() => { res.write(`: ping ${Date.now()}\n\n`); }, 20000);
    sseClients.set(clientId, { res, keepalive });
    req.on("close", () => { clearInterval(keepalive); sseClients.delete(clientId); });
  }
  async function eventPostHandler(req, res) {
    try {
      const { clientId, event, instance, payload, eventId } = req.body || {};
      const patches = await processMessage({ event, instance, payload });
      if (clientId && patches && patches.length) sendSse(clientId, patches, eventId);
      res.status(202).json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  }
  if (app.get && app.post) {
    app.get("/nasc/stream", sseHandler);
    app.post("/nasc/event", eventPostHandler);
    // Back-compat aliases
    app.get("/events", sseHandler);
    app.post("/event", eventPostHandler);
    // Handler manifest for visibility
    const manifest = buildHandlerManifest(handlers);
    app.get('/nasc/manifest', (_req, res) => res.json(manifest));
    // Log mapping on startup
    try {
      const lines = Object.entries(manifest).map(([type, info]) => `${type}: events = [${info.events.join(', ')}]`);
      if (lines.length) console.log('[Nasc] Handler mapping:\n  ' + lines.join('\n  '));
    } catch {}
  }

  // WebSocket (optional)
  if (WebSocketServer) {
    try {
      const wss = new WebSocketServer({ server });
      NascServer(wss, handlers, { store, schemaProvider });
    } catch (e) {
      console.warn('[Nasc] WebSocket init failed; continuing with SSE only:', e && e.message);
    }
  } else {
    console.log('[Nasc] ws package not found; SSE-only mode enabled');
  }

  // SSR middleware
  if (options.ssr) {
    const ssr = createSsrMiddleware({ handlers, rootDir });
    app.get("/", ssr);
    app.get("/*.html", ssr);
  }

  return { store, processMessage };
}

// SSR middleware creator: fills [na-bind] and input[name] from handler.mount()
function createSsrMiddleware({ handlers, rootDir }) {
  return async function handleSSR(req, res, next) {
    const page = req.path === "/" ? "/app.html" : req.path;
    try {
      const htmlPath = rootDir ? path.join(rootDir, page) : path.join(process.cwd(), page);
      let html = await fs.readFile(htmlPath, "utf-8");
      const instanceMatches = html.matchAll(/na-instance=\"([^\"]+)\"/g);
      for (const match of instanceMatches) {
        const instance = match[1];
        const [type, id] = instance.split(":");
        const handler = handlers[type];
        if (!handler || typeof handler.mount !== "function") continue;
        const mountParams = { [`${type.toLowerCase()}Id`]: id };
        const initialState = await handler.mount(mountParams);
        for (const [prop, value] of Object.entries(initialState)) {
          const bindRegex = new RegExp(`(<[^>]+na-bind=\"${prop}\"[^>]*>)[^<]*(</[^>]+>)`, "g");
          html = html.replace(bindRegex, `$1${String(value)}$2`);
          const inputRegex = new RegExp(`(<input[^>]*name=\"${prop}\"[^>]*)(/?>)`, "gi");
          html = html.replace(inputRegex, (match, start, end) => {
            if (/\bvalue=/.test(start)) {
              return `${start.replace(/value=\"[^\"]*\"/i, `value=\"${String(value)}\"`)}${end}`;
            }
            return `${start} value=\"${String(value)}\"${end}`;
          });
        }
      }
      res.send(html);
    } catch (e) {
      if (e && e.code === 'ENOENT') return next();
      next(e);
    }
  };
}

module.exports.attachNasc = attachNasc;
module.exports.createSsrMiddleware = createSsrMiddleware;
module.exports.SqliteStore = (() => {
  try { return require('./store/sqlite').SqliteStore; } catch { return undefined; }
})();
module.exports.SqliteMappedStore = (() => {
  try { return require('./store/sqlite-mapped').SqliteMappedStore; } catch { return undefined; }
})();

// Helper to introspect handlers → { [type]: { events: string[], hasMount: boolean } }
function buildHandlerManifest(handlers = {}) {
  const out = {};
  for (const [type, handler] of Object.entries(handlers)) {
    const keys = Object.keys(handler || {});
    const hasMount = typeof handler.mount === 'function';
    const events = keys
      .filter((k) => typeof handler[k] === 'function' && k !== 'mount')
      .sort();
    out[type] = { events, hasMount };
  }
  return out;
}
