const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const {
  parseTsInterfaces,
  parseJsDocTypedefs,
  generateFromHandlers,
  compareSchemas,
  runCheck,
} = require('../tools/schema-types');

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

describe('schema-types extractor/checker', () => {
test('TS interfaces: parse basic props and required', () => {
  const src = `
    export interface UserState { id: string; name: string; email?: string }
  `;
  const defs = parseTsInterfaces(src);
  assert.ok(defs.UserState);
  assert.deepStrictEqual(new Set(defs.UserState.required), new Set(['id','name']));
  assert.strictEqual(defs.UserState.properties.id.type, 'string');
});

test('JSDoc typedefs: parse object shape', () => {
  const src = `
    /**
     * @typedef {Object} Foo
     * @property {string} id
     * @property {boolean} flag
     */
  `;
  const defs = parseJsDocTypedefs(src);
  assert.ok(defs.Foo);
  assert.strictEqual(defs.Foo.properties.flag.type, 'boolean');
});

test('generateFromHandlers aligns demo handlers to schema names', () => {
  const handlersDir = path.resolve(__dirname, '../../../demo/handlers');
  const generated = generateFromHandlers(handlersDir);
  // Demo returns UserState and TodoListState -> we normalize to User, TodoList
  assert.ok(generated.User);
  assert.ok(generated.TodoList);
  // TodoList.items should reference $defs/Todo (normalized from TodoItem)
  assert.strictEqual(generated.TodoList.properties.items.type, 'array');
  assert.strictEqual(generated.TodoList.properties.items.items.$ref, '#/$defs/Todo');
});

test('generateFromHandlers works with TS fixtures (no demo dependency)', () => {
  const handlersDir = path.resolve(__dirname, './fixtures/ts-handlers');
  const generated = generateFromHandlers(handlersDir);
  // Should produce top-level User and TodoList (from FooState -> Foo mapping not needed here)
  assert.ok(generated.User);
  assert.ok(generated.TodoList);
  assert.strictEqual(generated.TodoList.properties.items.type, 'array');
  assert.strictEqual(generated.TodoList.properties.items.items.$ref, '#/$defs/Todo');
});

test('compareSchemas: demo generated matches app.schema.json', () => {
  const handlersDir = path.resolve(__dirname, '../../../demo/handlers');
  const generated = generateFromHandlers(handlersDir);
  const declared = loadJson(path.resolve(__dirname, '../../../demo/schemas/app.schema.json')).$defs;
  const diffs = compareSchemas(generated, declared);
  assert.deepStrictEqual(diffs, []);
});

test('runCheck: mismatch returns nonzero in strict mode', () => {
  const handlersDir = path.resolve(__dirname, '../../../demo/handlers');
  const schemaPath = path.resolve(__dirname, './fixtures/app.schema.mismatch.json');
  const code = runCheck({ handlersDir, schemaPath, strict: true });
  assert.strictEqual(code, 1);
});

test('STRICT_SCHEMA_TYPES env fails on mismatch', () => {
  const handlersDir = path.resolve(__dirname, '../../../demo/handlers');
  const schemaPath = path.resolve(__dirname, './fixtures/app.schema.mismatch.json');
  const prev = process.env.STRICT_SCHEMA_TYPES;
  try {
    process.env.STRICT_SCHEMA_TYPES = 'true';
    const code = runCheck({ handlersDir, schemaPath, strict: false });
    assert.strictEqual(code, 1);
  } finally {
    process.env.STRICT_SCHEMA_TYPES = prev;
  }
});
});
