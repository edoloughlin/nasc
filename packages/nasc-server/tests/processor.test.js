const { test, describe } = require('node:test');
const assert = require('node:assert');
const { createProcessor } = require('..');

describe('createProcessor', () => {
  function createStore(initial = {}) {
    const data = new Map(Object.entries(initial));
    const persistCalls = [];
    return {
      load: async (type, id) => data.get(`${type}:${id}`) || null,
      persist: async (type, id, diff, full) => {
        persistCalls.push({ type, id, diff, full });
        data.set(`${type}:${id}`, JSON.parse(JSON.stringify(full)));
      },
      getPersistCalls: () => persistCalls,
    };
  }

  const baseSchema = {
    type: 'object',
    properties: {
      count: { type: 'number' },
      todos: { type: 'array', items: { $ref: '#/$defs/Todo' } },
    },
  };
  const todoSchema = { type: 'object', properties: { title: { type: 'string' } } };

  test('mounts new instance with schema and bind updates', async () => {
    const mountCalls = [];
    const handlers = {
      Counter: {
        async mount(params) {
          mountCalls.push(params);
          return { count: 1, todos: [] };
        },
      },
    };
    const store = createStore();
    const processMessage = createProcessor(handlers, store, {
      schemaProvider: { Counter: baseSchema, Todo: todoSchema },
    });

    const patches = await processMessage({ event: 'mount', instance: 'abc', type: 'Counter' });

    assert.deepStrictEqual(mountCalls, [{ counterId: 'abc' }]);
    assert.deepStrictEqual(store.getPersistCalls(), [
      { type: 'Counter', id: 'abc', diff: { count: 1, todos: [] }, full: { count: 1, todos: [] } },
    ]);
    assert.deepStrictEqual(patches, [
      { action: 'schema', instance: 'abc', type: 'Counter', schema: baseSchema },
      { action: 'schema', instance: 'abc', type: 'Todo', schema: todoSchema },
      { action: 'bindUpdate', instance: 'abc', type: 'Counter', prop: 'count', value: 1 },
      { action: 'bindUpdate', instance: 'abc', type: 'Counter', prop: 'todos', value: [] },
    ]);
  });

  test('hydrates existing instance on mount without re-running mount handler', async () => {
    let mountInvoked = false;
    const handlers = {
      Counter: {
        async mount() {
          mountInvoked = true;
          return { count: 0 };
        },
      },
    };
    const existing = { count: 5 };
    const store = createStore({ 'Counter:abc': existing });
    const processMessage = createProcessor(handlers, store, {
      schemaProvider: { Counter: baseSchema },
    });

    const patches = await processMessage({ event: 'mount', instance: 'abc', type: 'Counter' });

    assert.strictEqual(mountInvoked, false);
    assert.deepStrictEqual(patches, [
      { action: 'schema', instance: 'abc', type: 'Counter', schema: baseSchema },
      { action: 'bindUpdate', instance: 'abc', type: 'Counter', prop: 'count', value: 5 },
    ]);
  });

  test('processes events and emits bind updates from diffs', async () => {
    const handlers = {
      Counter: {
        async increment(payload, state) {
          return { ...state, count: state.count + payload.delta };
        },
      },
    };
    const store = createStore({ 'Counter:abc': { count: 1 } });
    const processMessage = createProcessor(handlers, store);

    const patches = await processMessage({
      event: 'increment',
      instance: 'abc',
      type: 'Counter',
      payload: { delta: 2 },
    });

    assert.deepStrictEqual(store.getPersistCalls(), [
      { type: 'Counter', id: 'abc', diff: { count: 3 }, full: { count: 3 } },
    ]);
    assert.deepStrictEqual(patches, [
      { action: 'bindUpdate', instance: 'abc', type: 'Counter', prop: 'count', value: 3 },
    ]);
  });

  test('returns error when handler missing', async () => {
    const store = createStore();
    const processMessage = createProcessor({}, store);

    const patches = await processMessage({ event: 'mount', instance: '1', type: 'Missing' });

    assert.deepStrictEqual(patches, [
      { action: 'error', message: "Unknown handler for type 'Missing'" },
    ]);
  });

  test('returns error when handler throws', async () => {
    const handlers = {
      Counter: {
        async mount() {
          throw new Error('boom');
        },
      },
    };
    const store = createStore();
    const processMessage = createProcessor(handlers, store);

    const patches = await processMessage({ event: 'mount', instance: 'oops', type: 'Counter' });

    assert.deepStrictEqual(patches, [
      { action: 'error', message: 'boom' },
    ]);
  });
});
