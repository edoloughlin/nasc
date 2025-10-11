const { test, describe } = require('node:test');
const assert = require('node:assert');
const { normalizeSchemaProvider, createSchemaHandler } = require('..');

describe('normalizeSchemaProvider', () => {
  test('wraps function provider', async () => {
    const provider = normalizeSchemaProvider(async (type) => ({ type }));
    assert.deepStrictEqual(await provider('Example'), { type: 'Example' });
  });

  test('wraps object map provider', async () => {
    const provider = normalizeSchemaProvider({ Foo: { type: 'object' } });
    assert.deepStrictEqual(await provider('Foo'), { type: 'object' });
    assert.strictEqual(await provider('Missing'), null);
  });

  test('handles missing provider', async () => {
    const provider = normalizeSchemaProvider();
    assert.strictEqual(await provider('Anything'), null);
  });
});

describe('createSchemaHandler', () => {
  function createRes() {
    return {
      statusCode: undefined,
      headers: {},
      body: undefined,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
      setHeader(key, value) {
        this.headers[key] = value;
      },
      send(payload) {
        this.body = payload;
        return this;
      },
    };
  }

  test('returns schema for valid type', async () => {
    const handler = createSchemaHandler({ Foo: { type: 'object' } });
    const res = createRes();
    await handler({ params: { type: 'Foo' } }, res);
    assert.strictEqual(res.headers['Content-Type'], 'application/json; charset=utf-8');
    assert.deepStrictEqual(res.body, { type: 'object' });
  });

  test('lists available types when missing type parameter and provider is map', async () => {
    const handler = createSchemaHandler({ Foo: {}, Bar: {} });
    const res = createRes();
    await handler({ params: {} }, res);
    assert.deepStrictEqual(res.body, { types: ['Foo', 'Bar'] });
  });

  test('returns 400 when type missing and provider is not map', async () => {
    const handler = createSchemaHandler(async () => null);
    const res = createRes();
    await handler({ params: {} }, res);
    assert.strictEqual(res.statusCode, 400);
    assert.deepStrictEqual(res.body, { error: 'Missing type parameter' });
  });

  test('returns 404 when schema missing', async () => {
    const handler = createSchemaHandler({ Foo: {} });
    const res = createRes();
    await handler({ params: { type: 'Missing' } }, res);
    assert.strictEqual(res.statusCode, 404);
    assert.deepStrictEqual(res.body, { error: "Schema not found for type 'Missing'" });
  });

  test('handles provider errors', async () => {
    const handler = createSchemaHandler(async () => {
      throw new Error('kaboom');
    });
    const res = createRes();
    await handler({ params: { type: 'Foo' } }, res);
    assert.strictEqual(res.statusCode, 500);
    assert.deepStrictEqual(res.body, { error: 'kaboom' });
  });
});
