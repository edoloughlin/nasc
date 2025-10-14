import { test as nodeTest, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestWindow, Document, Element, Node as DomNode } from './minimal-dom.js';

let importCounter = 0;
let cleanupFns = [];

function test(name, fn) {
  return nodeTest(name, async (t) => {
    try { console.log('TEST START:', name); } catch {}
    try {
      await fn(t);
      try { console.log('TEST END:', name); } catch {}
    } catch (e) {
      try { console.error('TEST FAIL:', name, e && e.message); } catch {}
      throw e;
    }
  });
}

function setupDom(bodyHtml = '') {
  const { window, document } = createTestWindow(bodyHtml);
  globalThis.window = window;
  globalThis.document = document;
  // Some environments expose a read-only global `navigator` (getter only).
  // Guard assignment to avoid TypeErrors while still providing a navigator when possible.
  try {
    const desc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    if (!desc || (('writable' in desc && desc.writable) || desc.set || desc.configurable)) {
      globalThis.navigator = window.navigator;
    }
  } catch {}
  globalThis.location = window.location;
  globalThis.CustomEvent = function CustomEvent(type, detail) { this.type = type; this.detail = detail?.detail; };
  globalThis.HTMLElement = Element;
  globalThis.Node = DomNode;
  globalThis.Document = Document;
  globalThis.requestAnimationFrame = window.requestAnimationFrame || ((cb) => setTimeout(cb, 0));
  globalThis.cancelAnimationFrame = window.cancelAnimationFrame || ((id) => clearTimeout(id));

  const storage = new Map();
  globalThis.localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); },
    clear() { storage.clear(); },
  };

  const fetchCalls = [];
  globalThis.fetch = async (url, opts = {}) => {
    fetchCalls.push({ url, opts });
    return { ok: true, json: async () => ({}) };
  };

  class MockEventSource {
    static instances = [];
    constructor(url) {
      this.url = url;
      this.readyState = 1;
      this.onopen = null;
      this.onmessage = null;
      this.onerror = null;
      MockEventSource.instances.push(this);
    }
    emitOpen() {
      if (typeof this.onopen === 'function') this.onopen();
    }
    emitMessage(patches) {
      if (typeof this.onmessage === 'function') {
        this.onmessage({ data: JSON.stringify(patches) });
      }
    }
    emitError(error = new Error('mock error')) {
      if (typeof this.onerror === 'function') {
        this.onerror(error);
      }
    }
    close() {
      this.readyState = 2;
    }
  }
  MockEventSource.instances.length = 0;
  globalThis.EventSource = MockEventSource;

  window.__NASC_AUTOCONNECTED = false;
  window.__NASC_SCHEMAS = undefined;
  globalThis.__NASC_AUTOCONNECTED = false;

  cleanupFns.push(() => {
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.navigator;
    delete globalThis.location;
    delete globalThis.CustomEvent;
    delete globalThis.HTMLElement;
    delete globalThis.Node;
    delete globalThis.Document;
    delete globalThis.requestAnimationFrame;
    delete globalThis.cancelAnimationFrame;
    delete globalThis.localStorage;
    delete globalThis.fetch;
    delete globalThis.EventSource;
    delete globalThis.__NASC_AUTOCONNECTED;
    if (globalThis.window) {
      delete globalThis.window.__NASC_AUTOCONNECTED;
      delete globalThis.window.__NASC_SCHEMAS;
    }
  });

  return { document, fetchCalls, MockEventSource };
}

async function loadClientModule() {
  const moduleUrl = new URL('../nasc.js', import.meta.url);
  return import(`${moduleUrl.href}?v=${importCounter++}`);
}

beforeEach(() => {
  cleanupFns = [];
});

afterEach(() => {
  for (const fn of cleanupFns.reverse()) {
    try { fn(); } catch {}
  }
  cleanupFns = [];
});

async function flushAsync(times = 1) {
  for (let i = 0; i < times; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

test('bindUpdate patches update text nodes and input values', async () => {
  const { document, fetchCalls, MockEventSource } = setupDom(`
    <div na-scope="1" na-type="Todo">
      <span class="title" na-bind="title"></span>
      <input type="text" ng-bind="title" />
    </div>
  `);

  const { connect } = await loadClientModule();
  connect({ baseUrl: 'http://demo.local' });

  assert.strictEqual(MockEventSource.instances.length, 1);
  const stream = MockEventSource.instances[0];

  stream.emitOpen();
  assert.strictEqual(fetchCalls.length, 1, 'mount event should be posted once');
  const mountPayload = JSON.parse(fetchCalls[0].opts.body);
  assert.deepEqual(mountPayload, {
    event: 'mount',
    instance: '1',
    type: 'Todo',
    payload: {},
    clientId: mountPayload.clientId,
  });
  assert.ok(mountPayload.clientId, 'client id is included in mount payload');

  stream.emitMessage([
    {
      action: 'bindUpdate',
      instance: '1',
      type: 'Todo',
      prop: 'title',
      value: 'Pay bills',
    },
  ]);

  const titleSpan = document.querySelector('.title');
  assert.strictEqual(titleSpan.textContent, 'Pay bills');
  const titleInput = document.querySelector('input[ng-bind="title"]');
  assert.strictEqual(titleInput.value, 'Pay bills');
});

test('array bindUpdate hydrates keyed templates with na-each', async () => {
  const { document, MockEventSource } = setupDom(`
    <div na-scope="1" na-type="Todo">
      <ul>
        <template na-each="items" na-key="id">
          <li>
            <span na-bind="label"></span>
          </li>
        </template>
      </ul>
    </div>
  `);

  const { connect } = await loadClientModule();
  connect({});

  assert.strictEqual(MockEventSource.instances.length, 1);
  const stream = MockEventSource.instances[0];
  stream.emitOpen();

  stream.emitMessage([
    {
      action: 'bindUpdate',
      instance: '1',
      type: 'Todo',
      prop: 'items',
      value: [
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' },
      ],
    },
  ]);

  const listItems = Array.from(document.querySelectorAll('ul > li'));
  assert.strictEqual(listItems.length, 2);
  assert.deepStrictEqual(
    listItems.map((item) => item.getAttribute('na-key-val')),
    ['a', 'b']
  );
  assert.deepStrictEqual(
    listItems.map((item) => item.querySelector('[na-bind="label"]').textContent),
    ['Alpha', 'Beta']
  );

  const template = document.querySelector('ul > template');
  assert.ok(template, 'template anchor should remain in the DOM');
  assert.strictEqual(template.previousElementSibling.getAttribute('na-key-val'), 'b');
});

test('array bindUpdate does not render [object Object] text in containers', async () => {
  const { document, MockEventSource } = setupDom(`
    <div na-scope="1" na-type="Todo">
      <ul class="list" na-bind="items">
        <template na-each="items" na-key="id">
          <li><span na-bind="label"></span></li>
        </template>
      </ul>
    </div>
  `);

  const { connect } = await loadClientModule();
  connect({});
  const stream = MockEventSource.instances[0];
  stream.emitOpen();

  stream.emitMessage([
    { action: 'bindUpdate', instance: '1', type: 'Todo', prop: 'items', value: [ { id: 'a', label: 'Alpha' } ] },
  ]);

  const list = document.querySelector('ul.list');
  const text = list.textContent || '';
  assert.ok(text.includes('Alpha'), 'list should render item label');
  assert.ok(!text.includes('[object Object]'), 'list container should not contain [object Object]');
});

test('typed na-bind expressions receive updates alongside untyped binds', async () => {
  const { document, MockEventSource } = setupDom(`
    <div na-scope="1" na-type="Todo">
      <span class="plain" na-bind="title"></span>
      <span class="typed" na-bind="Todo:title"></span>
    </div>
  `);

  const { connect } = await loadClientModule();
  connect({});

  const stream = MockEventSource.instances[0];
  stream.emitOpen();

  stream.emitMessage([
    {
      action: 'bindUpdate',
      instance: '1',
      type: 'Todo',
      prop: 'title',
      value: 'Call mom',
    },
  ]);

  assert.strictEqual(document.querySelector('.plain').textContent, 'Call mom');
  assert.strictEqual(document.querySelector('.typed').textContent, 'Call mom');
});

test('bindUpdate updates checkbox, textarea, and select bindings', async () => {
  const { document, MockEventSource } = setupDom(`
    <div na-scope="1" na-type="Todo">
      <input type="checkbox" na-bind="done" />
      <textarea na-bind="notes"></textarea>
      <select na-bind="priority">
        <option value="low">Low</option>
        <option value="high">High</option>
      </select>
    </div>
  `);

  const { connect } = await loadClientModule();
  connect({});

  const stream = MockEventSource.instances[0];

  stream.emitMessage([
    { action: 'bindUpdate', instance: '1', type: 'Todo', prop: 'done', value: true },
    { action: 'bindUpdate', instance: '1', type: 'Todo', prop: 'notes', value: 'Remember milk' },
    { action: 'bindUpdate', instance: '1', type: 'Todo', prop: 'priority', value: 'high' },
  ]);

  const checkbox = document.querySelector('input[type="checkbox"]');
  const textarea = document.querySelector('textarea');
  const select = document.querySelector('select');

  assert.strictEqual(checkbox.checked, true);
  assert.strictEqual(textarea.value, 'Remember milk');
  assert.strictEqual(select.value, 'high');

  stream.emitMessage([
    { action: 'bindUpdate', instance: '1', type: 'Todo', prop: 'done', value: false },
    { action: 'bindUpdate', instance: '1', type: 'Todo', prop: 'notes', value: null },
    { action: 'bindUpdate', instance: '1', type: 'Todo', prop: 'priority', value: null },
  ]);

  assert.strictEqual(checkbox.checked, false);
  assert.strictEqual(textarea.value, '');
  assert.strictEqual(select.value, '');
});

test('template bindUpdate keeps controls synchronized and preserves scope', async () => {
  const { document, MockEventSource } = setupDom(`
    <div na-scope="1" na-type="Todo">
      <ul>
        <template na-each="items" na-key="id" na-type="TodoItem">
          <li data-id="placeholder">
            <input type="checkbox" na-bind="done" />
            <select na-bind="status">
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
            <span na-bind="label"></span>
          </li>
        </template>
      </ul>
    </div>
  `);

  const { connect } = await loadClientModule();
  connect({});

  const stream = MockEventSource.instances[0];

  stream.emitMessage([
    {
      action: 'bindUpdate',
      instance: '1',
      type: 'Todo',
      prop: 'items',
      value: [
        { id: 'a', done: true, status: 'open', label: 'Alpha' },
        { id: 'b', done: false, status: 'closed', label: 'Beta' },
      ],
    },
  ]);

  const initialItems = Array.from(document.querySelectorAll('ul > li'));
  assert.strictEqual(initialItems.length, 2);
  assert.deepStrictEqual(
    initialItems.map((item) => item.getAttribute('na-key-val')),
    ['a', 'b'],
  );

  initialItems.forEach((item, index) => {
    assert.strictEqual(item.getAttribute('data-na-type-scope'), 'TodoItem');
    const checkboxEl = item.querySelector('input[type="checkbox"]');
    const selectEl = item.querySelector('select');
    const labelEl = item.querySelector('span[na-bind="label"]');
    assert.strictEqual(checkboxEl.checked, index === 0);
    assert.strictEqual(selectEl.value, index === 0 ? 'open' : 'closed');
    assert.strictEqual(labelEl.textContent, index === 0 ? 'Alpha' : 'Beta');
    assert.strictEqual(item.querySelector('[data-id]').getAttribute('data-id'), item.getAttribute('na-key-val'));
  });

  // Remove the scope marker to confirm it is restored on update.
  initialItems[0].removeAttribute('data-na-type-scope');

  stream.emitMessage([
    {
      action: 'bindUpdate',
      instance: '1',
      type: 'Todo',
      prop: 'items',
      value: [
        { id: 'b', done: true, status: 'open', label: 'Bravo' },
        { id: 'a', done: false, status: 'closed', label: 'Alpha' },
      ],
    },
  ]);

  const updatedItems = Array.from(document.querySelectorAll('ul > li'));
  assert.deepStrictEqual(
    updatedItems.map((item) => item.getAttribute('na-key-val')),
    ['b', 'a'],
  );
  const [firstItem, secondItem] = updatedItems;
  assert.strictEqual(firstItem.getAttribute('data-na-type-scope'), 'TodoItem');
  assert.strictEqual(secondItem.getAttribute('data-na-type-scope'), 'TodoItem');
  assert.strictEqual(firstItem.querySelector('input[type="checkbox"]').checked, true);
  assert.strictEqual(firstItem.querySelector('select').value, 'open');
  assert.strictEqual(firstItem.querySelector('span[na-bind="label"]').textContent, 'Bravo');
  assert.strictEqual(secondItem.querySelector('input[type="checkbox"]').checked, false);
  assert.strictEqual(secondItem.querySelector('select').value, 'closed');
  assert.strictEqual(secondItem.querySelector('span[na-bind="label"]').textContent, 'Alpha');
  assert.deepStrictEqual(
    updatedItems.map((item) => item.querySelector('[data-id]').getAttribute('data-id')),
    ['b', 'a'],
  );
});

test('schema patches validate bindings with scoped inference', async () => {
  const { document, MockEventSource } = setupDom(`
    <div na-scope="1" na-type="Todo">
      <input type="text" name="label" />
      <span na-bind="title"></span>
      <template na-each="items" na-key="id" na-type="TodoItem">
        <li>
          <span na-bind="label"></span>
          <input type="checkbox" na-bind="done" />
          <span class="bad" na-bind="bogus"></span>
        </li>
      </template>
    </div>
  `);

  const { connect } = await loadClientModule();
  connect({});

  const stream = MockEventSource.instances[0];

  const todoItemSchema = {
    type: 'object',
    properties: {
      label: { type: 'string' },
      done: { type: 'boolean' },
    },
  };

  stream.emitMessage([
    { action: 'schema', type: 'TodoItem', schema: todoItemSchema },
    {
      action: 'schema',
      type: 'Todo',
      schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          items: {
            type: 'array',
            items: { $ref: '#/$defs/TodoItem' },
          },
        },
        $defs: { TodoItem: todoItemSchema },
      },
    },
  ]);

  const originalError = console.error;
  const captured = [];
  console.error = (...args) => { captured.push(args.map((arg) => String(arg)).join(' ')); };
  cleanupFns.push(() => {
    console.error = originalError;
  });

  await flushAsync(4);

  assert.ok(
    captured.some((msg) => msg.includes('[nasc] schema validation error: Unknown binding TodoItem.bogus')),
    'schema validation should report unknown template binding'
  );
  assert.ok(
    !captured.some((msg) => msg.includes('Unknown field Todo.label')),
    'top-level name="label" heuristic should prevent false positive'
  );
});

test('validation allows top-level ng-bind for child item field', async () => {
  const { document, MockEventSource } = setupDom(`
    <div na-scope="1" na-type="Todo">
      <!-- Top-level control bound to child item field name -->
      <input ng-bind="label" />
      <ul>
        <template na-each="items" na-key="id" na-type="TodoItem">
          <li><span na-bind="label"></span></li>
        </template>
      </ul>
    </div>
  `);

  const { connect } = await loadClientModule();
  connect({});
  const stream = MockEventSource.instances[0];

  const todoItemSchema = {
    type: 'object',
    properties: {
      label: { type: 'string' },
      done: { type: 'boolean' },
    },
  };

  stream.emitMessage([
    { action: 'schema', type: 'TodoItem', schema: todoItemSchema },
    {
      action: 'schema',
      type: 'Todo',
      schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          items: {
            type: 'array',
            items: { $ref: '#/$defs/TodoItem' },
          },
        },
        $defs: { TodoItem: todoItemSchema },
      },
    },
  ]);

  const originalError = console.error;
  const captured = [];
  console.error = (...args) => { captured.push(args.map((arg) => String(arg)).join(' ')); };
  cleanupFns.push(() => { console.error = originalError; });

  await flushAsync(4);

  assert.ok(
    !captured.some((msg) => msg.includes('Unknown field Todo.label')),
    'top-level ng-bind="label" should be treated as event-only and not error'
  );
});

test('SSE transport falls back to WebSocket after repeated errors', async () => {
  const { document, MockEventSource } = setupDom(`
    <div na-scope="1" na-type="Todo">
      <span na-bind="title"></span>
    </div>
  `);

  class MockWebSocket {
    static instances = [];
    constructor(url) {
      this.url = url;
      this.sent = [];
      this.readyState = 0;
      this.onopen = null;
      this.onmessage = null;
      this.onerror = null;
      MockWebSocket.instances.push(this);
    }
    send(data) {
      this.sent.push(data);
    }
    close() {
      this.readyState = 2;
    }
    emitOpen() {
      if (typeof this.onopen === 'function') this.onopen();
    }
    emitMessage(patches) {
      if (typeof this.onmessage === 'function') {
        this.onmessage({ data: JSON.stringify(patches) });
      }
    }
  }

  const originalWebSocket = globalThis.WebSocket;
  globalThis.WebSocket = MockWebSocket;
  cleanupFns.push(() => {
    globalThis.WebSocket = originalWebSocket;
    MockWebSocket.instances.length = 0;
  });

  const { connect } = await loadClientModule();
  connect({});

  const stream = MockEventSource.instances[0];
  stream.emitError();
  stream.emitError();

  assert.strictEqual(MockWebSocket.instances.length, 1, 'WebSocket fallback should be instantiated');
  const ws = MockWebSocket.instances[0];

  ws.emitOpen();
  assert.strictEqual(ws.sent.length, 1, 'mount event should be sent via fallback transport');
  const sentPayload = JSON.parse(ws.sent[0]);
  assert.strictEqual(sentPayload.event, 'mount');
  assert.strictEqual(sentPayload.instance, '1');
  assert.strictEqual(sentPayload.type, 'Todo');

  ws.emitMessage([
    { action: 'bindUpdate', instance: '1', type: 'Todo', prop: 'title', value: 'Fallback title' },
  ]);

  assert.strictEqual(document.querySelector('[na-bind="title"]').textContent, 'Fallback title');
});

test('transports log parse errors consistently', async () => {
  const { MockEventSource } = setupDom();

  const originalWebSocket = globalThis.WebSocket;
  class MockWebSocket {
    static lastInstance = null;
    constructor() {
      this.onmessage = null;
      this.onopen = null;
      this.onerror = null;
      MockWebSocket.lastInstance = this;
    }
    send() {}
    close() {}
  }
  globalThis.WebSocket = MockWebSocket;
  cleanupFns.push(() => {
    globalThis.WebSocket = originalWebSocket;
    MockWebSocket.lastInstance = null;
  });

  const originalError = console.error;
  const captured = [];
  console.error = (...args) => { captured.push(args); };
  cleanupFns.push(() => {
    console.error = originalError;
  });

  const { connect } = await loadClientModule();
  connect({});

  const stream = MockEventSource.instances[0];
  stream.onmessage({ data: 'not json' });

  const { connect: connectWs } = await loadClientModule();
  connectWs({ transport: 'ws', wsUrl: 'ws://example.test' });
  const wsInstance = MockWebSocket.lastInstance;
  const wsHandler = wsInstance?.onmessage;
  if (wsHandler) wsHandler({ data: 'still not json' });

  assert.ok(captured.some((args) => String(args[0]).includes('[nasc] bad SSE data')));
  assert.ok(captured.some((args) => String(args[0]).includes('[nasc] bad WS data')));
});

test('absolute $ scope resolves relative binds and lists', async () => {
  try {
  const { document, fetchCalls, MockEventSource } = setupDom(`
    <div na-scope="$user" na-type="App">
      <span class="username" na-bind="name"></span>
      <ul>
        <template na-each="todos" na-key="id">
          <li><span na-bind="label"></span></li>
        </template>
      </ul>
    </div>
  `);

  const { connect } = await loadClientModule();
  connect({});
  const stream = MockEventSource.instances[0];
  stream.emitOpen();

  // Mount should post with mapped instance 'root'
  console.log('DBG: fetchCalls length', fetchCalls.length);
  assert.ok(fetchCalls.length >= 1, 'mount event should be posted');
  const sent = JSON.parse(fetchCalls[0].opts.body);
  console.log('DBG: mount payload', sent);
  assert.equal(sent.event, 'mount');
  assert.equal(sent.type, 'App');
  assert.equal(sent.instance, 'root');

  // Send patch for top-level prop 'user'
  console.log('DBG: sending bindUpdate for user');
  stream.emitMessage([
    { action: 'bindUpdate', instance: 'root', type: 'App', prop: 'user', value: { name: 'Alice', todos: [{ id: '1', label: 'First' }] } },
  ]);
  const nameEl = document.querySelector('.username');
  console.log('DBG: username el', !!nameEl, nameEl && nameEl.textContent);
  assert.equal(nameEl.textContent, 'Alice');
  const items = document.querySelectorAll('ul > li');
  console.log('DBG: items length', items.length);
  assert.equal(items.length, 1);
  assert.equal(items[0].querySelector('span').textContent, 'First');
  } catch (e) {
    console.error('DBG test error:', e && e.stack || e);
    throw e;
  }
});

test('events from $ scope map to concrete instance', async () => {
  const { document, fetchCalls, MockEventSource } = setupDom(`
    <div na-scope="$user" na-type="App">
      <form na-submit="ping">
        <input ng-bind="$user.name" value="Alice" />
        <button type="submit">Send</button>
      </form>
    </div>
  `);
  const { connect } = await loadClientModule();
  connect({});
  const stream = MockEventSource.instances[0];
  stream.emitOpen();
  // First call is mount
  assert.ok(fetchCalls.length >= 1);
  // Trigger form submit
  const form = document.querySelector('form[na-submit]');
  document.dispatchEvent({ type: 'submit', target: form, preventDefault() {} });
  // Next call should be submit event to instance 'root'
  const last = JSON.parse(fetchCalls[fetchCalls.length - 1].opts.body);
  assert.equal(last.event, 'ping');
  assert.equal(last.type, 'App');
  assert.equal(last.instance, 'root');
  assert.equal(last.payload['$user.name'], 'Alice');
});
