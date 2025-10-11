// Demo-only status badge: shows detected transport and SSE connection status.
// Strict separation: this file is served from demo/ and does not modify core client.

(function () {
  const badge = document.createElement('div');
  badge.style.position = 'fixed';
  badge.style.right = '12px';
  badge.style.bottom = '12px';
  badge.style.padding = '6px 8px';
  badge.style.background = 'rgba(0,0,0,0.7)';
  badge.style.color = '#fff';
  badge.style.font = '12px/1.2 system-ui, sans-serif';
  badge.style.borderRadius = '6px';
  badge.style.zIndex = '9999';
  badge.style.pointerEvents = 'none';
  badge.setAttribute('aria-live', 'polite');

  document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(badge);
    updateBadge();
    setInterval(updateBadge, 10000);
  });

  function getClientId() {
    try {
      return localStorage.getItem('nascClientId') || '';
    } catch { return ''; }
  }

  function getQueryTransport() {
    try {
      const sp = new URLSearchParams(location.search);
      const t = (sp.get('transport') || '').toLowerCase();
      if (t === 'ws' || t === 'sse') return t;
      return '';
    } catch { return ''; }
  }

  async function updateBadge() {
    const forced = getQueryTransport();
    let transport = forced || 'sse';

    let sseConnected = false;
    try {
      // const r = await fetch('/nasc/health', { headers: { 'Accept': 'application/json' } });
      if (r.ok) {
        const data = await r.json();
        const clientId = getClientId();
        sseConnected = !!(clientId && data && data.sse && Array.isArray(data.sse.clientIds) && data.sse.clientIds.includes(clientId));
      }
    } catch { }

    if (!sseConnected && transport === 'sse') {
      // Likely fell back to WS
      transport = 'ws';
    }

    badge.textContent = `Nasc Demo · ${transport.toUpperCase()} ${sseConnected ? '(SSE connected)' : ''}`;
  }
})();

