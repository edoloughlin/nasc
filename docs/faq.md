---
layout: default
title: FAQ
nav_order: 11
---

# Frequently Asked Questions

## How is Nasc different from htmx?

Nasc keeps the client extremely small and streams JSON-backed DOM patches instead of HTML fragments. The server owns state and returns plain objects that the framework diffs. This encourages centralizing business logic on the backend while still authoring declarative HTML with `na-*` attributes.

## Does Nasc require Node.js on the server?

The reference implementation targets Express, but the protocol is framework-agnostic. You can port the handler contract to any language as long as it can receive `{ event, instance, payload }` messages and respond with patch arrays.

## Can I ship WebSockets in production?

Nasc is not ready for production yet. It is still a proof of concept and has limitions. But you can ship websockets. Install the `ws` package and Nasc will upgrade connections automatically when the client requests it. If `ws` is missing, the server logs a notice and continues with SSE-only transport.

## What happens if I deploy without schemas?

Everything still works—patches apply and events run—but you lose the validation overlay and typed hints. Add schemas later without rewriting templates; the server will push them on the next mount.

## Is there a packaged release on npm?

Not yet. The README explicitly notes that Nasc is a proof of concept and is not currently published. You can still vendor the `nasc.js` file or copy the server package into your workspace while the project evolves.

## Can I mix SSE and WebSockets on the same page?

Yes. SSE is the default. You can force WebSockets for specific pages by calling `connect({ transport: 'ws' })` or appending `?transport=ws` to the URL. Each connection handles all instances on the page.

## Does Nasc support SSR?

The Express integration ships with middleware that parses your HTML, calls `mount()`, and injects values into `na-bind` and `input[name]` before sending the response. This yields meaningful first paint while the client hydrates.

## How do I persist data in production?

Implement the `Store` interface and wire it into `attachNasc({ store })`. The repo includes in-memory and SQLite examples. You can also wrap your existing ORM inside a store adapter.

## Can I integrate with an existing HTML build pipeline?

Yes. `attachNasc` serves the `nasc.js` bundle from `packages/nasc-client`, but you can copy or bundle it elsewhere. As long as the client code runs in the browser and the HTML includes `na-*` attributes, Nasc can connect and patch the DOM.
