export class Node {
  constructor(ownerDocument, nodeType) {
    this.ownerDocument = ownerDocument;
    this.nodeType = nodeType;
    this.parentNode = null;
  }

  get parentElement() {
    const parent = this.parentNode;
    return parent && parent.nodeType === 1 ? parent : null;
  }

  remove() {
    if (!this.parentNode) return;
    if (typeof this.parentNode.removeChild === 'function') {
      this.parentNode.removeChild(this);
    }
  }

  get textContent() {
    return '';
  }

  set textContent(value) {}
}

class TextNode extends Node {
  constructor(ownerDocument, data) {
    super(ownerDocument, 3);
    this.data = data;
    this.nodeValue = data;
  }

  get textContent() {
    return this.data;
  }

  set textContent(value) {
    this.data = String(value ?? '');
    this.nodeValue = this.data;
  }
}

export class DocumentFragment extends Node {
  constructor(ownerDocument) {
    super(ownerDocument, 11);
    this._childNodes = [];
    this.host = null;
  }

  appendChild(node) {
    if (!node) return null;
    if (node.parentNode) node.parentNode.removeChild(node);
    this._childNodes.push(node);
    node.parentNode = this;
    return node;
  }

  insertBefore(node, reference) {
    if (!node) return null;
    if (node.parentNode) node.parentNode.removeChild(node);
    const idx = reference ? this._childNodes.indexOf(reference) : -1;
    if (idx >= 0) this._childNodes.splice(idx, 0, node);
    else this._childNodes.push(node);
    node.parentNode = this;
    return node;
  }

  removeChild(node) {
    const idx = this._childNodes.indexOf(node);
    if (idx >= 0) {
      this._childNodes.splice(idx, 1);
      node.parentNode = null;
    }
  }

  get firstElementChild() {
    return this.children[0] || null;
  }

  get children() {
    return this._childNodes.filter((n) => n.nodeType === 1);
  }

  get textContent() {
    return this._childNodes.map((n) => n.textContent).join('');
  }

  querySelectorAll(selector) {
    return queryAll(this, selector);
  }

  querySelector(selector) {
    const matches = this.querySelectorAll(selector);
    return matches[0] || null;
  }

  get childNodes() {
    return this._childNodes;
  }
}

export class Element extends Node {
  constructor(ownerDocument, tagName) {
    super(ownerDocument, 1);
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this._childNodes = [];
    this._attributes = new Map();
    this._classList = new Set();
    this._value = '';
    this._checked = false;
  }

  appendChild(node) {
    if (!node) return null;
    if (node.parentNode) node.parentNode.removeChild(node);
    this._childNodes.push(node);
    node.parentNode = this;
    return node;
  }

  insertBefore(node, reference) {
    if (!node) return null;
    if (node.parentNode) node.parentNode.removeChild(node);
    const idx = reference ? this._childNodes.indexOf(reference) : -1;
    if (idx >= 0) this._childNodes.splice(idx, 0, node);
    else this._childNodes.push(node);
    node.parentNode = this;
    return node;
  }

  removeChild(node) {
    const idx = this._childNodes.indexOf(node);
    if (idx >= 0) {
      this._childNodes.splice(idx, 1);
      node.parentNode = null;
    }
  }

  get children() {
    return this._childNodes.filter((n) => n.nodeType === 1);
  }

  get firstElementChild() {
    return this.children[0] || null;
  }

  get previousElementSibling() {
    if (!this.parentNode) return null;
    const siblings = this.parentNode.children;
    const idx = siblings.indexOf(this);
    return idx > 0 ? siblings[idx - 1] : null;
  }

  setAttribute(name, value) {
    const str = String(value ?? '');
    this._attributes.set(name, str);
    if (name === 'class') {
      this._classList = new Set(str.split(/\s+/).filter(Boolean));
    }
    if (name === 'value' && (this.tagName === 'INPUT' || this.tagName === 'TEXTAREA' || this.tagName === 'SELECT')) {
      this._value = str;
    }
  }

  getAttribute(name) {
    return this._attributes.has(name) ? this._attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this._attributes.has(name);
  }

  removeAttribute(name) {
    this._attributes.delete(name);
    if (name === 'class') this._classList.clear();
  }

  get attributes() {
    return Array.from(this._attributes.entries()).map(([name, value]) => ({ name, value }));
  }

  get className() {
    return this.getAttribute('class') || '';
  }

  set className(value) {
    this.setAttribute('class', value);
  }

  get classList() {
    const self = this;
    return {
      add(...names) {
        for (const name of names) self._classList.add(name);
        self.setAttribute('class', Array.from(self._classList).join(' '));
      },
      remove(...names) {
        for (const name of names) self._classList.delete(name);
        self.setAttribute('class', Array.from(self._classList).join(' '));
      },
      contains(name) {
        return self._classList.has(name);
      },
      toggle(name, force) {
        if (force === true) {
          this.add(name);
          return true;
        }
        if (force === false) {
          this.remove(name);
          return false;
        }
        if (self._classList.has(name)) {
          self._classList.delete(name);
          self.setAttribute('class', Array.from(self._classList).join(' '));
          return false;
        }
        self._classList.add(name);
        self.setAttribute('class', Array.from(self._classList).join(' '));
        return true;
      },
    };
  }

  get textContent() {
    return this._childNodes.map((n) => n.textContent).join('');
  }

  set textContent(value) {
    this._childNodes = [];
    if (value == null || value === '') return;
    const text = this.ownerDocument.createTextNode(String(value));
    this.appendChild(text);
  }

  get value() {
    if (this.tagName === 'INPUT' || this.tagName === 'TEXTAREA' || this.tagName === 'SELECT') {
      return this._value;
    }
    return this.textContent;
  }

  set value(val) {
    const str = val == null ? '' : String(val);
    if (this.tagName === 'INPUT' || this.tagName === 'TEXTAREA' || this.tagName === 'SELECT') {
      this._value = str;
    } else {
      this.textContent = str;
    }
  }

  get checked() {
    return this._checked;
  }

  set checked(val) {
    this._checked = !!val;
  }

  querySelectorAll(selector) {
    return queryAll(this, selector);
  }

  querySelector(selector) {
    const matches = this.querySelectorAll(selector);
    return matches[0] || null;
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (current.nodeType === 1 && matches(current, selector)) return current;
      if (current.parentElement) {
        current = current.parentElement;
      } else if (current.parentNode && current.parentNode.nodeType === 11 && current.parentNode.host) {
        current = current.parentNode.host;
      } else {
        current = null;
      }
    }
    return null;
  }

  get childNodes() {
    return this._childNodes;
  }
}

export class TemplateElement extends Element {
  constructor(ownerDocument) {
    super(ownerDocument, 'template');
    this.content = new DocumentFragment(ownerDocument);
    this.content.host = this;
  }

  appendChild(node) {
    return this.content.appendChild(node);
  }

  insertBefore(node, reference) {
    return this.content.insertBefore(node, reference);
  }

  removeChild(node) {
    return this.content.removeChild(node);
  }

  get childNodes() {
    return this.content.childNodes;
  }

  get children() {
    return this.content.children;
  }
}

export class Document extends Node {
  constructor() {
    super(null, 9);
    this.ownerDocument = this;
    this._childNodes = [];
    this._eventListeners = new Map();
    this.readyState = 'complete';
    this.defaultView = null;
    this.documentElement = this.createElement('html');
    this.appendChild(this.documentElement);
    this.body = this.createElement('body');
    this.documentElement.appendChild(this.body);
  }

  appendChild(node) {
    if (!node) return null;
    if (node.parentNode) node.parentNode.removeChild(node);
    this._childNodes.push(node);
    node.parentNode = this;
    return node;
  }

  removeChild(node) {
    const idx = this._childNodes.indexOf(node);
    if (idx >= 0) {
      this._childNodes.splice(idx, 1);
      node.parentNode = null;
    }
  }

  createElement(tagName) {
    if (String(tagName).toLowerCase() === 'template') {
      const tmpl = new TemplateElement(this);
      return tmpl;
    }
    return new Element(this, String(tagName));
  }

  createTextNode(text) {
    return new TextNode(this, String(text ?? ''));
  }

  createDocumentFragment() {
    return new DocumentFragment(this);
  }

  importNode(node, deep = false) {
    return cloneNode(this, node, deep);
  }

  addEventListener(type, handler) {
    if (!type || typeof handler !== 'function') return;
    if (!this._eventListeners.has(type)) this._eventListeners.set(type, new Set());
    this._eventListeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    if (!type || typeof handler !== 'function') return;
    const handlers = this._eventListeners.get(type);
    if (!handlers) return;
    handlers.delete(handler);
  }

  dispatchEvent(event) {
    const handlers = this._eventListeners.get(event?.type);
    if (handlers) {
      for (const fn of handlers) {
        try { fn.call(this, event); } catch {}
      }
    }
    return true;
  }

  querySelectorAll(selector) {
    return queryAll(this, selector);
  }

  querySelector(selector) {
    const matches = this.querySelectorAll(selector);
    return matches[0] || null;
  }

  get childNodes() {
    return this._childNodes;
  }
}

function cloneNode(ownerDocument, node, deep) {
  if (!node) return null;
  switch (node.nodeType) {
    case 1: {
      const tagName = node.tagName.toLowerCase();
      const clone = ownerDocument.createElement(tagName);
      for (const { name, value } of node.attributes || []) {
        clone.setAttribute(name, value);
      }
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        clone.value = node.value;
      }
      if (tagName === 'input' && node.type && node.type.toLowerCase() === 'checkbox') {
        clone.checked = node.checked;
      }
      if (deep) {
        const sourceChildren = tagName === 'template' ? node.content.childNodes : node.childNodes;
        for (const child of sourceChildren) {
          const cloned = cloneNode(ownerDocument, child, true);
          clone.appendChild(cloned);
        }
      }
      return clone;
    }
    case 3:
      return ownerDocument.createTextNode(node.textContent);
    case 11: {
      const frag = ownerDocument.createDocumentFragment();
      if (deep) {
        for (const child of node.childNodes) {
          frag.appendChild(cloneNode(ownerDocument, child, true));
        }
      }
      return frag;
    }
    default:
      return null;
  }
}

function queryAll(root, selector) {
  if (!selector) return [];
  const selectors = selector.split(',').map((s) => s.trim()).filter(Boolean);
  const results = [];
  const seen = new Set();

  function visit(node) {
    if (node.nodeType === 1) {
      for (const sel of selectors) {
        if (matches(node, sel)) {
          if (!seen.has(node)) {
            seen.add(node);
            results.push(node);
          }
          break;
        }
      }
    }
    for (const child of getChildNodesForTraversal(node)) {
      visit(child);
    }
  }

  visit(root);
  return results;
}

function getChildNodesForTraversal(node) {
  if (!node) return [];
  if (node.nodeType === 1 && node.tagName === 'TEMPLATE') {
    return node.content.childNodes;
  }
  return node.childNodes || [];
}

function matches(element, selector) {
  if (!selector) return false;
  const chain = parseSelector(selector);
  if (!chain.length) return false;
  return matchChain(element, chain, chain.length - 1);
}

function matchChain(element, chain, index) {
  if (index < 0) return true;
  const part = chain[index];
  if (!matchSimpleSelector(element, part.selector)) return false;
  if (index === 0) return true;
  const relation = part.combinator;
  if (relation === '>') {
    const parent = element.parentElement || (element.parentNode && element.parentNode.nodeType === 11 ? element.parentNode.host : null);
    if (!parent) return false;
    return matchChain(parent, chain, index - 1);
  }
  let ancestor = element.parentElement || (element.parentNode && element.parentNode.nodeType === 11 ? element.parentNode.host : null);
  while (ancestor) {
    if (matchChain(ancestor, chain, index - 1)) return true;
    ancestor = ancestor.parentElement || (ancestor.parentNode && ancestor.parentNode.nodeType === 11 ? ancestor.parentNode.host : null);
  }
  return false;
}

function parseSelector(selector) {
  const parts = [];
  let buffer = '';
  let combinator = ' ';
  const push = () => {
    const trimmed = buffer.trim();
    if (trimmed) {
      parts.push({ selector: trimmed, combinator });
    }
    buffer = '';
    combinator = ' ';
  };
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];
    if (ch === ' ') {
      push();
      while (selector[i + 1] === ' ') i++;
      combinator = ' ';
    } else if (ch === '>') {
      push();
      while (selector[i + 1] === ' ') i++;
      combinator = '>';
    } else {
      buffer += ch;
    }
  }
  push();
  if (parts.length) parts[0].combinator = null;
  return parts;
}

function matchSimpleSelector(element, selector) {
  if (selector === '*') return true;
  let remainder = selector;
  let tagName = null;
  const classes = [];
  const attrs = [];

  const tagMatch = remainder.match(/^[a-zA-Z0-9_-]+/);
  if (tagMatch) {
    tagName = tagMatch[0].toUpperCase();
    remainder = remainder.slice(tagMatch[0].length);
  }

  while (remainder.length) {
    if (remainder[0] === '.') {
      const classMatch = remainder.match(/^\.([a-zA-Z0-9_-]+)/);
      if (!classMatch) break;
      classes.push(classMatch[1]);
      remainder = remainder.slice(classMatch[0].length);
    } else if (remainder[0] === '[') {
      const attrMatch = remainder.match(/^\[([^\]=\^\~\$]+)([*\^\$]?=)?"?([^\]"]*)"?\]/);
      if (!attrMatch) break;
      attrs.push({ name: attrMatch[1], op: attrMatch[2] || null, value: attrMatch[3] });
      remainder = remainder.slice(attrMatch[0].length);
    } else {
      break;
    }
  }

  if (tagName && element.tagName !== tagName) return false;
  for (const cls of classes) {
    if (!element._classList.has(cls)) return false;
  }
  for (const attr of attrs) {
    const actual = element.getAttribute(attr.name);
    if (attr.op === null) {
      if (actual === null) return false;
    } else if (attr.op === '=') {
      if (actual !== attr.value) return false;
    } else if (attr.op === '^=') {
      if (typeof actual !== 'string' || !actual.startsWith(attr.value)) return false;
    } else if (attr.op === '*=') {
      if (typeof actual !== 'string' || !actual.includes(attr.value)) return false;
    } else if (attr.op === '$=') {
      if (typeof actual !== 'string' || !actual.endsWith(attr.value)) return false;
    }
  }

  return true;
}

const VOID_ELEMENTS = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);

export function appendHtml(parent, html) {
  const stack = [parent];
  const regex = /<!--[^]*?-->|<[^>]+>|[^<]+/g;
  let match;
  while ((match = regex.exec(html))) {
    const token = match[0];
    const current = stack[stack.length - 1];
    if (!current) continue;
    if (token.startsWith('<!--')) {
      continue;
    }
    if (token.startsWith('</')) {
      stack.pop();
      continue;
    }
    if (token.startsWith('<')) {
      const selfClosing = /\/>\s*$/.test(token);
      const tagMatch = token.match(/^<\/?([a-zA-Z0-9-]+)/);
      if (!tagMatch) continue;
      const tagName = tagMatch[1].toLowerCase();
      const element = current.ownerDocument.createElement(tagName);
      let attrSection = token.slice(tagMatch[0].length, token.length - (selfClosing ? 2 : 1));
      attrSection = attrSection.trim();
      const attrRegex = /([a-zA-Z0-9:-]+)(?:\s*=\s*"([^"]*)")?/g;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(attrSection))) {
        const name = attrMatch[1];
        const value = attrMatch[2] ?? '';
        if (name) element.setAttribute(name, value);
      }
      current.appendChild(element);
      if (!selfClosing && !VOID_ELEMENTS.has(tagName)) {
        stack.push(element);
      }
    } else {
      const text = token.replace(/\s+/g, ' ');
      if (text.trim()) {
        current.appendChild(current.ownerDocument.createTextNode(text.trim()));
      }
    }
  }
}

export function createTestWindow(bodyHtml = '') {
  const document = new Document();
  const window = {
    document,
    navigator: { userAgent: 'test' },
    location: { protocol: 'http:', host: 'example.test', search: '' },
    console,
    addEventListener() {},
    removeEventListener() {},
  };
  document.defaultView = window;
  if (bodyHtml) {
    appendHtml(document.body, bodyHtml);
  }
  return { window, document };
}

