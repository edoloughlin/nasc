// Demo-only transport tap: intercepts SSE and WebSocket traffic
// and renders a small card with recent messages.
(function () {
  const MAX_ROWS = 200;      // max rows kept in buffer
  const MAX_RENDER = 40;     // max rows rendered
  const STORAGE_KEY = 'nascDemo.trafficTap.v1'; // use localStorage for cross-reload persistence
  const RECONNECT_KEY = 'nascDemo.reconnecting';
  const tap = { rows: [], push }; // shared buffer
  let selectedIndex = -1;    // currently selected row (global index)
  let prevSelectedIndex = -1; // previous selection to detect changes
  function nowTs() {
    try {
      return new Date().toLocaleTimeString();
    } catch { return '' }
  }
  function toText(data) {
    if (data == null) return '';
    if (typeof data === 'string') return data;
    try { return JSON.stringify(data); } catch { return String(data); }
  }
  function pretty(data) {
    const s = toText(data);
    if (!s) return '';
    try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
  }
  function save() {
    try {
      // Persist only the last MAX_ROWS to sessionStorage
      const toSave = tap.rows.slice(-MAX_ROWS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch { /* ignore */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        tap.rows = arr.slice(-MAX_ROWS);
        selectedIndex = tap.rows.length - 1;
      }
    } catch { /* ignore */ }
  }
  function push(row) {
    tap.rows.push(row);
    if (tap.rows.length > MAX_ROWS) tap.rows.splice(0, tap.rows.length - MAX_ROWS);
    if (!pause) selectedIndex = tap.rows.length - 1; // auto-select latest when not paused
    save();
    if (row && row.dir === 'in') hideReconnectToast();
    schedule();
  }

  // Patch EventSource (SSE)
  try {
    const OrigES = window.EventSource;
    class TappedES extends OrigES {
      constructor(url, options) {
        super(url, options);
        this.addEventListener('message', (ev) => {
          push({ ts: nowTs(), transport: 'sse', dir: 'in', data: ev && ev.data });
        });
      }
    }
    // Copy static props
    for (const k in OrigES) try { TappedES[k] = OrigES[k]; } catch { }
    window.EventSource = TappedES;

    // Note: We load before the client initializes, so constructor hook is sufficient.
  } catch { }

  // Patch WebSocket
  try {
    const OrigWS = window.WebSocket;
    class TappedWS extends OrigWS {
      constructor(url, protocols) {
        super(url, protocols);
        const sendOrig = this.send;
        this.send = function (data) {
          try { push({ ts: nowTs(), transport: 'ws', dir: 'out', data }); } catch { }
          return sendOrig.apply(this, arguments);
        };
        this.addEventListener('message', (ev) => {
          push({ ts: nowTs(), transport: 'ws', dir: 'in', data: ev && ev.data });
        });
      }
    }
    // Copy static props
    for (const k in OrigWS) try { TappedWS[k] = OrigWS[k]; } catch { }
    window.WebSocket = TappedWS;

    // Note: We load before the client initializes, so constructor hook is sufficient.
  } catch { }

  // UI Card
  let listEl, detailEl, countEl, splitEl, pause = false, raf, dirty = false;
  function schedule() {
    if (!listEl) return;
    dirty = true;
    if (raf) return;
    raf = requestAnimationFrame(render);
  }
  function render() {
    raf = 0;
    if (!dirty || !listEl) return;
    dirty = false;
    const total = tap.rows.length;
    if (total === 0) {
      if (listEl) listEl.innerHTML = '';
      if (detailEl) detailEl.textContent = '';
      if (countEl) countEl.textContent = '0';
      return;
    }
    if (selectedIndex < 0 || selectedIndex >= total) selectedIndex = total - 1;
    const idealStart = Math.max(0, selectedIndex - Math.floor(MAX_RENDER / 2));
    const maxStart = Math.max(0, total - MAX_RENDER);
    const start = Math.min(idealStart, maxStart);
    const end = Math.min(total, start + MAX_RENDER);

    let listHtml = '';
    for (let i = start; i < end; i++) {
      const r = tap.rows[i];
      const tag = r.transport.toUpperCase() + ' ' + (r.dir === 'out' ? '→' : '←');
      const sel = (i === selectedIndex) ? ' selected' : '';
      listHtml += `<div class="traffic-item${sel}" data-index="${i}" role="button" tabindex="0" title="${escapeHtml(tag)}">${escapeHtml(r.ts)} · ${escapeHtml(tag)}</div>`;
    }
    listEl.innerHTML = listHtml;
    const selEl = listEl.querySelector('[data-index="' + selectedIndex + '"]');
    if (selEl && selEl.scrollIntoView) selEl.scrollIntoView({ block: 'nearest' });

    const cur = tap.rows[selectedIndex];
    const body = pretty(cur && cur.data ? cur.data : '');
    if (detailEl) {
      detailEl.textContent = body;
      if (selectedIndex !== prevSelectedIndex) {
        // Reset scroll position to top when selection changes
        detailEl.scrollTop = 0;
      }
    }
    prevSelectedIndex = selectedIndex;
    if (countEl) countEl.textContent = String(total);
  }
  function preview(s) {
    if (s.length > 800) return s.slice(0, 800) + '\n…';
    return s;
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.container');
    if (!container) return;
    // Load any persisted traffic rows so the list survives reloads/transport switches
    load();
    // Prepare reconnect toast
    ensureReconnectToast();
    try {
      if (localStorage.getItem(RECONNECT_KEY) === '1') {
        showReconnectToast('Reconnecting…');
        localStorage.removeItem(RECONNECT_KEY);
      }
    } catch {}
    const card = document.createElement('div');
    card.className = 'card traffic-card';
    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px;">
        <h2 style="margin:0; font-size:16px;">Transport Traffic</h2><p>(FYI only, you'll never need to worry about this.)</p>
        <div class="traffic-controls">
          <button class="icon-btn" id="tapPauseBtn" aria-pressed="false" title="Pause/Resume">⏸</button>
          <button class="icon-btn" id="tapClearBtn" title="Clear log">🗑</button>
          <span class="muted" title="Total events">(<span id="tapCount">0</span>)</span>
        </div>
      </div>
      <div class="traffic-split">
        <div class="traffic-list" id="tapList"></div>
        <div class="traffic-detail" id="tapDetail"><pre></pre></div>
      </div>
    `;
    container.appendChild(card);
    listEl = card.querySelector('#tapList');
    detailEl = card.querySelector('#tapDetail pre') || card.querySelector('#tapDetail');
    countEl = card.querySelector('#tapCount');
    splitEl = card.querySelector('.traffic-split');
    const pauseBtn = card.querySelector('#tapPauseBtn');
    const clearBtn = card.querySelector('#tapClearBtn');
    if (pauseBtn) pauseBtn.addEventListener('click', () => {
      pause = !pause;
      pauseBtn.setAttribute('aria-pressed', String(pause));
      pauseBtn.textContent = pause ? '▶' : '⏸';
      if (!pause) schedule();
    });
    if (clearBtn) clearBtn.addEventListener('click', () => {
      tap.rows = [];
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      save();
      schedule();
    });

    // Size log to extend to bottom of viewport
    function sizeLog() {
      if (!listEl || !detailEl) return;
      try {
        // Use the split container if available for a more stable top
        const anchor = splitEl || listEl;
        const top = anchor.getBoundingClientRect().top;
        const avail = window.innerHeight - top - 16; // 16px bottom padding
        if (avail > 80) {
          if (splitEl) {
            splitEl.style.maxHeight = avail + 'px';
            splitEl.style.overflow = 'hidden';
          }
          listEl.style.maxHeight = avail + 'px';
          detailEl.parentElement && (detailEl.parentElement.style.maxHeight = avail + 'px');
          detailEl.style.maxHeight = (avail - 20) + 'px';
        }
      } catch { }
    }
    sizeLog();
    window.addEventListener('resize', sizeLog);
    window.addEventListener('scroll', sizeLog, { passive: true });
    const ro = new ResizeObserver(() => sizeLog());
    try { ro.observe(document.body); } catch { }
    // Also re-size after render
    const _render = render;
    render = function () { _render(); sizeLog(); };

    // Selection events
    if (listEl) listEl.addEventListener('click', (e) => {
      const t = e.target;
      const el = t && (t.closest ? t.closest('.traffic-item') : null);
      if (!el || !el.getAttribute) return;
      const idx = parseInt(el.getAttribute('data-index') || '', 10);
      if (!Number.isFinite(idx)) return;
      selectedIndex = idx;
      schedule();
    });
    if (listEl) listEl.addEventListener('keydown', (e) => {
      const el = document.activeElement;
      const activeIdx = el && el.getAttribute ? parseInt(el.getAttribute('data-index') || '', 10) : NaN;
      if (e.key === 'Enter' || e.key === ' ') {
        if (Number.isFinite(activeIdx)) {
          selectedIndex = activeIdx;
          schedule();
          e.preventDefault();
        }
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const total = tap.rows.length;
        if (!Number.isFinite(selectedIndex) || selectedIndex < 0) selectedIndex = Math.max(0, total - 1);
        if (e.key === 'ArrowUp') selectedIndex = Math.max(0, selectedIndex - 1);
        else selectedIndex = Math.min(total - 1, selectedIndex + 1);
        schedule();
        // Focus the newly selected item after render
        setTimeout(() => {
          const selEl = listEl && listEl.querySelector('[data-index="' + selectedIndex + '"]');
          if (selEl && selEl.focus) selEl.focus();
        }, 0);
        e.preventDefault();
      }
    });
    // Initial render if we loaded existing rows
    schedule();
    // Ensure we flush latest buffer on navigation (e.g., when switching transport)
    window.addEventListener('beforeunload', () => { try { save(); } catch {} });
  });

  // Simple reconnect toast
  let reconnectToast;
  function ensureReconnectToast() {
    if (reconnectToast) return reconnectToast;
    reconnectToast = document.createElement('div');
    reconnectToast.style.position = 'fixed';
    reconnectToast.style.top = '12px';
    reconnectToast.style.right = '12px';
    reconnectToast.style.padding = '8px 10px';
    reconnectToast.style.background = 'rgba(0,0,0,0.75)';
    reconnectToast.style.color = '#fff';
    reconnectToast.style.font = '12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
    reconnectToast.style.borderRadius = '6px';
    reconnectToast.style.zIndex = '10000';
    reconnectToast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.35)';
    reconnectToast.style.display = 'none';
    reconnectToast.setAttribute('role', 'status');
    reconnectToast.setAttribute('aria-live', 'polite');
    reconnectToast.textContent = 'Reconnecting…';
    document.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(reconnectToast);
    });
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      try { document.body.appendChild(reconnectToast); } catch {}
    }
    return reconnectToast;
  }
  function showReconnectToast(text) {
    ensureReconnectToast();
    try { reconnectToast.textContent = text || 'Reconnecting…'; } catch {}
    reconnectToast && (reconnectToast.style.display = 'block');
  }
  function hideReconnectToast() {
    if (!reconnectToast) return;
    reconnectToast.style.display = 'none';
  }
})();
