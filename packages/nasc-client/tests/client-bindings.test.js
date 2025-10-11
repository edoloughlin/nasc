import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestWindow, Document, Element, Node as DomNode } from './minimal-dom.js';

let importCounter = 0;
let cleanupFns = [];

function setupDom(bodyHtml = '') {
  const { window, document } = createTestWindow(bodyHtml);
  globalThis.window = window;
  globalThis.document = document;
  globalThis.navigator = window.navigator;
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

test('bindUpdate patches update text nodes and input values', async () => {
  const { document, fetchCalls, MockEventSource } = setupDom(`
    <div na-instance="Todo:1">
      <span class="title" na-bind="title"></span>
      <input type="text" name="title" />
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
    instance: 'Todo:1',
    payload: { todoId: '1' },
    clientId: mountPayload.clientId,
  });
  assert.ok(mountPayload.clientId, 'client id is included in mount payload');

  stream.emitMessage([
    {
      action: 'bindUpdate',
      instance: 'Todo:1',
      prop: 'title',
      value: 'Pay bills',
    },
  ]);

  const titleSpan = document.querySelector('.title');
  assert.strictEqual(titleSpan.textContent, 'Pay bills');
  const titleInput = document.querySelector('input[name="title"]');
  assert.strictEqual(titleInput.value, 'Pay bills');
});

test('array bindUpdate hydrates keyed templates with na-each', async () => {
  const { document, MockEventSource } = setupDom(`
    <div na-instance="Todo:1">
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
      instance: 'Todo:1',
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

test('typed na-bind expressions receive updates alongside untyped binds', async () => {
  const { document, MockEventSource } = setupDom(`
    <div na-instance="Todo:1">
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
      instance: 'Todo:1',
      prop: 'title',
      value: 'Call mom',
    },
  ]);

  assert.strictEqual(document.querySelector('.plain').textContent, 'Call mom');
  assert.strictEqual(document.querySelector('.typed').textContent, 'Call mom');
});
