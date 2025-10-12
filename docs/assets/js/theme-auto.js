(function () {
  var KEY = 'jtd-theme';
  var root = document.documentElement;

  function setAttr(t) { if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t); }

  function systemPrefersDark() { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; }
  function read() { var v = localStorage.getItem(KEY); return (v === 'light' || v === 'dark' || v === 'auto') ? v : 'auto'; }

  function apply() {
    var pref = read();
    var t = pref === 'auto' ? (systemPrefersDark() ? 'dark' : 'light') : pref;
    if (window.jtd && typeof window.jtd.setTheme === 'function') {
      window.jtd.setTheme(t);
    } else {
      setAttr(t);
    }
  }

  apply();

  var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  if (mq && mq.addEventListener) mq.addEventListener('change', function (e) { if (read() === 'auto') { apply(); } });

  window.addEventListener('storage', function (e) { if (e.key === 'jtd-theme') apply(); });

  window.__jtdTheme = { set: function (t) { localStorage.setItem(KEY, t); apply(); }, get: read };
})();
