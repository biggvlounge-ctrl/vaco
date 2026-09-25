/* ==========================================================================
   VACO UI Runtime v1 — the behaviour half of the design system.

   `vaco-design.css` gives every app the same look. This gives them the
   same *behaviour*: one session contract, one wallet read, one error
   presentation, one way to render a table. Without it, twenty-six pages
   would each reinvent "how do I know who is signed in" and drift.

   Deliberately dependency-free and framework-free. It is a plain script
   tag, loads in any of these apps regardless of what they are built
   with, and can be copied into an app's own `public/` so the app stays
   self-contained if the shell is down.

   USAGE

       <link rel="stylesheet" href="/vaco-design.css">
       <script src="/vaco-ui.js"></script>
       <script>
         VACO.app({
           id: 'void',
           name: 'VOID',
           tagline: 'Real-world execution',
           accent: '#6f7bd6',
           tabs: [{ id:'jobs', label:'Jobs', render: renderJobs }],
         });
       </script>

   WHAT IT DOES NOT DO. It is not a framework: no reactivity, no virtual
   DOM, no router. Each app owns its own rendering. This exists so the
   parts that MUST agree across apps actually agree.
   ========================================================================== */

(function (global) {
  'use strict';

  // Shared across every app on purpose: signing in on one app and
  // opening another should not ask again. Same key the shell writes.
  var SESSION_KEY = 'shell.sessionToken';

  var VACO = {
    session: null,
    config: {},
    balances: { vcoin: null, vash: null },
  };

  // -- URLs -------------------------------------------------------------
  // Every app talks to the same two shared services. Read from a global
  // an app may override before calling VACO.app(), so a deployed app can
  // point at real hosts without editing this file.
  VACO.SHIELD_URL = global.VACO_SHIELD_URL || 'http://localhost:8812';
  VACO.V3_URL = global.VACO_V3_URL || 'http://localhost:8811';
  VACO.SHELL_URL = global.VACO_SHELL_URL || 'http://localhost:8789';

  // -- fetch ------------------------------------------------------------

  // One error shape for every call in every app. The important part is
  // that a server's own `error` message survives — an app that replaced
  // it with "Request failed" would throw away the only useful thing.
  //
  // **The session token rides along automatically.** Several apps guard
  // their mutating routes with `requireSession()`, which wants
  // `Authorization: Bearer <shieldToken>`. Leaving that to each page
  // would mean every write route silently 401s until someone remembers
  // — so it is attached here, once.
  //
  // Only on same-origin (relative) paths. An absolute URL might be any
  // host, and a session token is not something to hand out by default.
  VACO.api = function (path, options) {
    var opts = options || {};
    if (VACO.session && VACO.session.sessionToken && path.charAt(0) === '/') {
      var headers = {};
      Object.keys(opts.headers || {}).forEach(function (k) { headers[k] = opts.headers[k]; });
      if (!headers.Authorization) headers.Authorization = 'Bearer ' + VACO.session.sessionToken;
      opts = { method: opts.method, body: opts.body, headers: headers };
    }
    return fetch(path, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) {
          var err = new Error(body.error || path + ' failed (' + res.status + ')');
          err.status = res.status;
          err.body = body;
          throw err;
        }
        return body;
      });
    });
  };

  VACO.post = function (path, body) {
    return VACO.api(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
  };

  VACO.del = function (path) {
    return VACO.api(path, { method: 'DELETE' });
  };

  // -- DOM helpers ------------------------------------------------------

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  VACO.el = el;

  VACO.clear = function (node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  };

  VACO.mount = function (node, children) {
    VACO.clear(node);
    (Array.isArray(children) ? children : [children]).forEach(function (child) {
      if (child) node.appendChild(child);
    });
    return node;
  };

  // -- toast ------------------------------------------------------------

  VACO.toast = function (message, kind) {
    var host = document.getElementById('vaco-toast-host');
    if (!host) {
      host = el('div', 'vaco-toast-host');
      host.id = 'vaco-toast-host';
      document.body.appendChild(host);
    }
    var node = el('div', 'vaco-toast' + (kind ? ' vaco-toast-' + kind : ''), message);
    host.appendChild(node);
    setTimeout(function () { node.remove(); }, 4600);
    return node;
  };

  VACO.error = function (err) {
    VACO.toast(err && err.message ? err.message : String(err), 'danger');
  };

  // -- money ------------------------------------------------------------

  // Every VCoin figure in every app renders through here, so a price
  // looks the same in VOID as it does in VOKEN.
  VACO.price = function (amount, opts) {
    var options = opts || {};
    if (amount === 0 && options.freeLabel !== false) {
      return el('span', 'vaco-price-free', 'Free');
    }
    return el('span', 'vaco-price vaco-num', VACO.round(amount));
  };

  VACO.round = function (n) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    return String(Math.round(n * 100) / 100);
  };

  // -- badges -----------------------------------------------------------

  // Status words map to colour in ONE place. An app inventing its own
  // mapping is how "pending" ends up green in one surface and amber in
  // the next.
  var STATUS_KIND = {
    active: 'money', completed: 'money', delivered: 'money', paid: 'money',
    accepted: 'money', verified: 'money', approved: 'money', settled: 'money',
    live: 'money', open: 'money', available: 'money', won: 'money',

    pending: 'warn', requested: 'warn', placed: 'warn', held: 'warn',
    scheduled: 'warn', submitted: 'warn', matched: 'warn', queued: 'warn',
    'in-production': 'warn', 'in-progress': 'warn', draft: 'warn',

    cancelled: 'danger', canceled: 'danger', refunded: 'danger', failed: 'danger',
    rejected: 'danger', expired: 'danger', suspended: 'danger', lost: 'danger',
    closed: 'danger', refused: 'danger',
  };

  VACO.badge = function (text, kind) {
    var resolved = kind || STATUS_KIND[String(text).toLowerCase()] || null;
    return el('span', 'vaco-badge' + (resolved ? ' vaco-badge-' + resolved : ''), text);
  };

  // -- table ------------------------------------------------------------

  // columns: [{ key, label, num?, render?(row) }]
  VACO.table = function (columns, rows, options) {
    var opts = options || {};
    if (!rows || !rows.length) {
      return el('div', 'vaco-empty', opts.empty || 'Nothing here yet.');
    }
    var wrap = el('div', 'vaco-table-wrap');
    var table = el('table', 'vaco-table');

    var thead = el('thead');
    var headRow = el('tr');
    columns.forEach(function (col) {
      headRow.appendChild(el('th', col.num ? 'vaco-num' : null, col.label));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = el('tbody');
    rows.forEach(function (row) {
      var tr = el('tr');
      columns.forEach(function (col) {
        var td = el('td', col.num ? 'vaco-num' : null);
        var value = col.render ? col.render(row) : row[col.key];
        if (value instanceof Node) td.appendChild(value);
        else td.textContent = value === undefined || value === null ? '—' : String(value);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  };

  // -- cards ------------------------------------------------------------

  VACO.card = function (title, children, options) {
    var opts = options || {};
    var card = el('div', 'vaco-card vaco-stack-sm');
    if (title) {
      var head = el('div', 'vaco-row-tight');
      head.appendChild(el('h3', 'vaco-h3', title));
      if (opts.trailing) {
        head.appendChild(el('span', 'vaco-spacer'));
        head.appendChild(opts.trailing);
      }
      card.appendChild(head);
    }
    (Array.isArray(children) ? children : [children]).forEach(function (child) {
      if (typeof child === 'string') card.appendChild(el('p', 'vaco-small vaco-dim', child));
      else if (child) card.appendChild(child);
    });
    return card;
  };

  VACO.grid = function (cards, wide) {
    var grid = el('div', 'vaco-grid' + (wide ? ' vaco-grid-wide' : ''));
    cards.forEach(function (c) { if (c) grid.appendChild(c); });
    return grid;
  };

  VACO.notice = function (text, kind) {
    var node = el('div', 'vaco-notice' + (kind ? ' vaco-notice-' + kind : ''));
    var inner = el('div');
    inner.innerHTML = text;
    node.appendChild(inner);
    return node;
  };

  // -- forms ------------------------------------------------------------

  // fields: [{ name, label, type?, placeholder?, value?, options?, width? }]
  // Returns a form element with `.values()`.
  VACO.form = function (fields, onSubmit, submitLabel) {
    var form = el('form', 'vaco-row');
    var inputs = {};

    fields.forEach(function (field) {
      var wrap = el('label', 'vaco-stack-sm');
      wrap.style.gap = '4px';
      if (field.label) wrap.appendChild(el('span', 'vaco-label', field.label));

      var input;
      if (field.options) {
        input = el('select', 'vaco-select');
        field.options.forEach(function (opt) {
          var o = el('option', null, opt.label !== undefined ? opt.label : opt);
          o.value = opt.value !== undefined ? opt.value : opt;
          input.appendChild(o);
        });
      } else {
        input = el('input', 'vaco-input' + (field.type === 'number' ? ' vaco-num' : ''));
        input.type = field.type || 'text';
        if (field.placeholder) input.placeholder = field.placeholder;
        if (field.min !== undefined) input.min = field.min;
        if (field.step !== undefined) input.step = field.step;
      }
      if (field.value !== undefined) input.value = field.value;
      if (field.width) input.style.width = field.width;
      input.name = field.name;
      inputs[field.name] = input;
      wrap.appendChild(input);
      form.appendChild(wrap);
    });

    var submit = el('button', 'vaco-btn vaco-btn-primary', submitLabel || 'Submit');
    submit.type = 'submit';
    submit.style.alignSelf = 'flex-end';
    form.appendChild(submit);

    form.values = function () {
      var out = {};
      Object.keys(inputs).forEach(function (name) {
        var input = inputs[name];
        var raw = input.value;
        out[name] = input.type === 'number' && raw !== '' ? Number(raw) : raw;
      });
      return out;
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submit.disabled = true;
      Promise.resolve()
        .then(function () { return onSubmit(form.values(), form); })
        .catch(VACO.error)
        .then(function () { submit.disabled = false; });
    });

    return form;
  };

  VACO.button = function (label, onClick, variant) {
    var btn = el('button', 'vaco-btn' + (variant ? ' vaco-btn-' + variant : ''), label);
    btn.addEventListener('click', function () {
      btn.disabled = true;
      Promise.resolve()
        .then(function () { return onClick(btn); })
        .catch(VACO.error)
        .then(function () { btn.disabled = false; });
    });
    return btn;
  };

  // -- session ----------------------------------------------------------

  // Shield is the one session authority. An app inventing its own login
  // is the thing this whole layer exists to prevent — and several apps'
  // own docs already said "trust the shell's unified session".
  VACO.signIn = function (userId, password) {
    var path = password ? '/api/shield/login' : '/api/shield/session';
    var payload = password ? { userId: userId, password: password } : { userId: userId };
    return VACO.api(VACO.SHIELD_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (session) {
      VACO.session = session;
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) { /* private mode */ }
      return session;
    });
  };

  VACO.register = function (userId, password) {
    return VACO.api(VACO.SHIELD_URL + '/api/shield/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userId, password: password }),
    }).then(function (session) {
      VACO.session = session;
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) { /* private mode */ }
      return session;
    });
  };

  VACO.signOut = function () {
    VACO.session = null;
    VACO.balances = { vcoin: null, vash: null };
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
  };

  VACO.userId = function () {
    return VACO.session ? VACO.session.userId : null;
  };

  function restoreSession() {
    // Two sources, in order: a `?shieldToken=` handed over by the shell's
    // SSO link, then whatever this origin already had. The query param
    // wins because it is the more recent, deliberate act.
    var params = new URLSearchParams(global.location.search);
    var token = params.get('shieldToken');
    if (token) {
      return VACO.api(VACO.SHIELD_URL + '/api/shield/session/' + encodeURIComponent(token))
        .then(function (session) {
          VACO.session = { sessionToken: token, userId: session.userId };
          try { localStorage.setItem(SESSION_KEY, JSON.stringify(VACO.session)); } catch (e) { /* ignore */ }
        })
        .catch(function () { /* a stale token is not an error worth blocking on */ });
    }
    try {
      var saved = localStorage.getItem(SESSION_KEY);
      if (saved) VACO.session = JSON.parse(saved);
    } catch (e) { /* corrupt entry, ignore */ }
    return Promise.resolve();
  }

  // -- wallet -----------------------------------------------------------

  VACO.refreshBalances = function () {
    var userId = VACO.userId();
    if (!userId) {
      VACO.balances = { vcoin: null, vash: null };
      return Promise.resolve(VACO.balances);
    }
    return VACO.api(VACO.V3_URL + '/api/vcoin/balance/' + encodeURIComponent(userId))
      .then(function (body) {
        VACO.balances.vcoin = body.balance;
        return VACO.api(VACO.V3_URL + '/api/vash/balance/' + encodeURIComponent(userId))
          .catch(function () { return { balance: null }; });
      })
      .then(function (body) {
        VACO.balances.vash = body.balance;
        return VACO.balances;
      })
      .catch(function () {
        // A wallet the ledger cannot answer for is shown as unknown,
        // never as zero — zero is a real balance and a wrong one here.
        VACO.balances = { vcoin: null, vash: null };
        return VACO.balances;
      });
  };

  // -- chrome -----------------------------------------------------------

  function buildMasthead(config) {
    var header = el('header', 'vaco-masthead');
    var inner = el('div', 'vaco-container vaco-masthead-inner');

    var brand = el('a', 'vaco-brand');
    brand.href = VACO.SHELL_URL;
    brand.title = 'Back to the VACO app store';
    brand.appendChild(el('span', 'vaco-brand-mark', config.name));
    if (config.tagline) brand.appendChild(el('span', 'vaco-brand-tag', config.tagline));
    inner.appendChild(brand);

    var nav = el('nav', 'vaco-tabs');
    nav.id = 'vaco-tabs';
    nav.setAttribute('role', 'tablist');
    inner.appendChild(nav);

    inner.appendChild(el('span', 'vaco-spacer'));
    var identity = el('div', 'vaco-row-tight');
    identity.id = 'vaco-identity';
    inner.appendChild(identity);

    header.appendChild(inner);
    return header;
  }

  function renderIdentity() {
    var box = document.getElementById('vaco-identity');
    if (!box) return;
    VACO.clear(box);

    if (VACO.session) {
      if (VACO.balances.vcoin !== null) {
        var wallet = el('div', 'vaco-wallet');
        wallet.title = 'VCoin balance, live from V3';
        wallet.appendChild(el('span', 'vaco-price vaco-num', VACO.round(VACO.balances.vcoin)));
        box.appendChild(wallet);
      }
      box.appendChild(el('span', 'vaco-small vaco-dim', VACO.session.userId));
      box.appendChild(VACO.button('Sign out', function () {
        VACO.signOut();
        renderIdentity();
        VACO.render();
      }, 'ghost vaco-btn-sm'));
      return;
    }

    var form = el('form', 'vaco-row-tight');
    var user = el('input', 'vaco-input');
    user.placeholder = 'user id';
    user.style.width = '120px';
    user.setAttribute('aria-label', 'User id');
    var pass = el('input', 'vaco-input');
    pass.type = 'password';
    pass.placeholder = 'password';
    pass.style.width = '120px';
    pass.setAttribute('aria-label', 'Password (optional)');

    var go = el('button', 'vaco-btn vaco-btn-primary vaco-btn-sm', 'Sign in');
    go.type = 'submit';

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var id = user.value.trim();
      if (!id) return;
      go.disabled = true;
      VACO.signIn(id, pass.value || null)
        .then(VACO.refreshBalances)
        .then(function () {
          renderIdentity();
          VACO.render();
          VACO.toast('Signed in as ' + VACO.session.userId);
        })
        .catch(VACO.error)
        .then(function () { go.disabled = false; });
    });

    form.appendChild(user);
    form.appendChild(pass);
    form.appendChild(go);
    box.appendChild(form);
  }
  VACO.renderIdentity = renderIdentity;

  // -- tabs & render ----------------------------------------------------

  var activeTab = null;

  function renderTabs() {
    var nav = document.getElementById('vaco-tabs');
    if (!nav) return;
    VACO.clear(nav);
    VACO.config.tabs.forEach(function (tab) {
      var btn = el('button', 'vaco-tab', tab.label);
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(tab.id === activeTab));
      btn.addEventListener('click', function () {
        activeTab = tab.id;
        // The tab lives in the URL so a reload, a bookmark, or a link
        // shared with someone lands on the same screen.
        try {
          var url = new URL(global.location.href);
          url.hash = tab.id;
          history.replaceState(null, '', url.toString());
        } catch (e) { /* ignore */ }
        renderTabs();
        VACO.render();
      });
      nav.appendChild(btn);
    });
  }

  // Renders the active tab. An app calls this after any mutation.
  VACO.render = function () {
    var main = document.getElementById('vaco-main');
    if (!main) return;
    var tab = VACO.config.tabs.filter(function (t) { return t.id === activeTab; })[0];
    if (!tab) return;

    VACO.clear(main);
    var section = el('div', 'vaco-stack');

    var head = el('div', 'vaco-row');
    head.appendChild(el('h1', 'vaco-h1', tab.heading || tab.label));
    section.appendChild(head);
    if (tab.blurb) {
      var blurb = el('p', 'vaco-body vaco-dim');
      blurb.style.maxWidth = '64ch';
      blurb.textContent = tab.blurb;
      section.appendChild(blurb);
    }

    var body = el('div', 'vaco-stack');
    body.appendChild(el('div', 'vaco-empty', 'Loading…'));
    section.appendChild(body);
    main.appendChild(section);

    Promise.resolve()
      .then(function () { return tab.render(body); })
      .then(function (result) {
        // A tab may either render into `body` itself or return nodes to
        // be mounted. `VACO.mount` returns the node it filled, so a tab
        // that does `return VACO.mount(body, ...)` hands back `body`
        // itself — mounting that would append body to body and throw
        // "the new child element contains the parent". Both styles are
        // legitimate, so this accepts both rather than banning one.
        if (result === undefined || result === body) return;
        VACO.mount(body, result);
      })
      .catch(function (err) {
        VACO.mount(body, VACO.notice(
          'Could not load this view: <strong>' + escapeHtml(err.message) + '</strong>', 'danger'));
      });
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  VACO.escapeHtml = escapeHtml;

  // -- boot -------------------------------------------------------------

  VACO.app = function (config) {
    VACO.config = config;
    document.title = config.name + (config.tagline ? ' — ' + config.tagline : '');
    document.body.className = 'vaco';

    // The one thing an app is allowed to override: its own colour.
    if (config.accent) {
      var root = document.documentElement;
      root.style.setProperty('--vaco-accent', config.accent);
      root.style.setProperty('--vaco-accent-soft', config.accentSoft || (config.accent + '26'));
      root.style.setProperty('--vaco-accent-dim', config.accentDim || config.accent);
      if (config.accentInk) root.style.setProperty('--vaco-accent-ink', config.accentInk);
    }

    document.body.appendChild(buildMasthead(config));
    var main = el('main', 'vaco-container');
    main.id = 'vaco-main';
    document.body.appendChild(main);

    // Deep-link into a tab by hash, falling back to the first.
    var hash = (global.location.hash || '').replace('#', '');
    activeTab = config.tabs.some(function (t) { return t.id === hash; }) ? hash : config.tabs[0].id;

    restoreSession()
      .then(VACO.refreshBalances)
      .then(function () {
        renderTabs();
        renderIdentity();
        VACO.render();
      });
  };

  global.VACO = VACO;
}(window));
