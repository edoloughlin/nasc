import express from "express";
import path from "path";
import { createServer } from "http";

// Import CommonJS core module via require (path relative to compiled dist/)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const core = require(require("path").resolve(__dirname, "../../packages/nasc-server"));
const { attachNasc, SqliteStore, SqliteMappedStore } = core as { attachNasc: (opts: any) => any, SqliteStore?: any, SqliteMappedStore?: any };

import { UserHandler } from "./handlers/user";
import { TodoListHandler } from "./handlers/todo";
import appSchema from "./schemas/app.schema.json";
import appMapping from "./schemas/app.mapping.json";

// Minimal server using attachNasc
const app = express();
const PORT = process.env.PORT || 3000;
const server = createServer(app);

// Handlers and schema provider
const handlers = { User: UserHandler, TodoList: TodoListHandler };
const schemaProvider: Record<string, unknown> = (appSchema && (appSchema as any)["$defs"]) || {};
const rootDir = path.resolve(__dirname, "..");

// Optional: SQLite store via DB_PATH env var
let store: any = undefined;
if (process.env.DB_PATH) {
  try {
    if (process.env.DB_MODE === 'mapped' && SqliteMappedStore) {
      store = new SqliteMappedStore(process.env.DB_PATH, { mapping: appMapping, schema: appSchema });
      console.log(`[Demo] Using SqliteMappedStore at ${process.env.DB_PATH}`);
    } else if (SqliteStore) {
      store = new SqliteStore(process.env.DB_PATH);
      console.log(`[Demo] Using SqliteStore at ${process.env.DB_PATH}`);
    }
  } catch (e: any) {
    console.warn('[Demo] Failed to initialize SQLite store; falling back to MemoryStore:', e && e.message);
  }
}

// Attach full Nasc stack (SSR + transports + static nasc.js)
attachNasc({ app, server, handlers, schemaProvider, ssr: { rootDir }, store });

server.listen(PORT, () => {
  console.log(`Nasc demo running at http://localhost:${PORT}`);
});
