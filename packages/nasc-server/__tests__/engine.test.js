const { test, describe } = require('node:test');
const assert = require('node:assert');
const { MemoryStore, applyEvent } = require('../engine');

describe('engine.applyEvent', () => {
  test('persists handler diff into store', async () => {
    const store = new MemoryStore();
    const handler = {
      async mount() { return { count: 0 }; },
      async increment(payload, state) {
        return { ...state, count: state.count + payload.delta };
      },
    };

    await store.persist('Counter', '1', {}, { count: 1 });

    const { diff, newState } = await applyEvent(
      handler,
      'increment',
      { delta: 2 },
      { count: 1 },
      store,
      'Counter',
      '1'
    );

    assert.deepStrictEqual(diff, { count: 3 });
    assert.deepStrictEqual(newState, { count: 3 });
    assert.deepStrictEqual(await store.load('Counter', '1'), { count: 3 });
  });

  test('dry run skips persistence', async () => {
    let persisted = false;
    const store = {
      load: async () => null,
      persist: async () => {
        persisted = true;
      },
    };
    const handler = {
      async update(payload, state) {
        return { ...state, flag: payload.flag };
      },
    };

    const initial = { flag: false };

    const result = await applyEvent(
      handler,
      'update',
      { flag: true },
      initial,
      store,
      'Thing',
      'a',
      true
    );

    assert.deepStrictEqual(result.diff, { flag: true });
    assert.strictEqual(persisted, false);
  });

  test('throws on unknown event', async () => {
    const handler = {};
    await assert.rejects(
      applyEvent(handler, 'missing', {}, {}, new MemoryStore(), 'X', '1'),
      /Unknown event 'missing' for X/
    );
  });
});
