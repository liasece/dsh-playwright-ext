(() => {
  if (window.__dshOverlayInstalled)
    return;
  window.__dshOverlayInstalled = true;

  let host, badge, cursor, label, pressedTimer;

  function ensureUi() {
    if (host && document.documentElement.contains(host))
      return;
    host = document.createElement('div');
    host.id = 'dsh-overlay-host';
    host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .badge {
          position: fixed; top: 14px; right: 14px;
          display: flex; align-items: center; gap: 8px;
          padding: 7px 11px; border-radius: 999px;
          background: rgba(17, 24, 39, .88); color: #fff;
          font: 500 12px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: .01em;
          box-shadow: 0 4px 16px rgba(0,0,0,.22);
          border: 1px solid rgba(255,255,255,.18);
          transform: translateY(-6px); opacity: 0;
          transition: opacity .18s ease, transform .18s ease;
        }
        .badge.visible { opacity: 1; transform: translateY(0); }
        .dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #22c55e; box-shadow: 0 0 0 0 rgba(34,197,94,.55);
          animation: pulse 1.8s infinite;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(34,197,94,.5); }
          70% { box-shadow: 0 0 0 7px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
        .cursor {
          position: fixed; width: 20px; height: 20px;
          margin: -10px 0 0 -10px; border-radius: 50%;
          border: 2px solid #0169cc; background: rgba(1,105,204,.16);
          box-shadow: 0 0 0 5px rgba(1,105,204,.12), 0 2px 8px rgba(0,0,0,.2);
          opacity: 0; transform: scale(.7);
          transition: opacity .1s ease, transform .1s ease, left .08s linear, top .08s linear;
        }
        .cursor.visible { opacity: 1; transform: scale(1); }
        .cursor.pressed { transform: scale(.72); background: rgba(1,105,204,.35); }
      </style>
      <div class="badge" part="badge"><span class="dot"></span><span class="label">DSH is using this tab</span></div>
      <div class="cursor"></div>
    `;
    document.documentElement.appendChild(host);
    badge = shadow.querySelector('.badge');
    label = shadow.querySelector('.label');
    cursor = shadow.querySelector('.cursor');
  }

  function setVisible(visible) {
    ensureUi();
    badge.classList.toggle('visible', !!visible);
    if (!visible)
      cursor.classList.remove('visible');
  }

  function move(x, y, pressed) {
    ensureUi();
    if (typeof x !== 'number' || typeof y !== 'number')
      return;
    cursor.style.left = x + 'px';
    cursor.style.top = y + 'px';
    cursor.classList.add('visible');
    cursor.classList.toggle('pressed', !!pressed);
    if (pressed) {
      clearTimeout(pressedTimer);
      pressedTimer = setTimeout(() => cursor.classList.remove('pressed'), 180);
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== 'dsh-overlay')
      return;
    if (message.visible === false) {
      setVisible(false);
      return;
    }
    setVisible(true);
    if (typeof message.x === 'number' && typeof message.y === 'number')
      move(message.x, message.y, !!message.pressed);
  });

  chrome.runtime.sendMessage({ type: 'dsh-overlay-query' }).then((response) => {
    if (response && response.visible)
      setVisible(true);
  }).catch(() => {});
})();
