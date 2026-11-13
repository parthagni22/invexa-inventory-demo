/* ==========================================================================
   Invexa — App shell, authentication, routing
   ========================================================================== */
const Pages = {};

const ROLES = {
  admin: { label: 'Administrator', routes: '*' },
  inventory: { label: 'Inventory Manager', routes: ['dashboard', 'items', 'batches', 'warehouses', 'adjustments', 'transfers', 'production', 'recipes', 'purchases', 'vendors', 'reports', 'activity'] },
  sales: { label: 'Sales Executive', routes: ['dashboard', 'items', 'batches', 'customers', 'sales', 'returns', 'reports'] },
};
const DEMO_USERS = [
  { name: 'Rohan Kulkarni', email: 'admin@invexa.demo', pw: 'Admin@2026', role: 'admin', title: 'Head of Operations' },
  { name: 'Sneha Patil', email: 'stores@invexa.demo', pw: 'Store@2026', role: 'inventory', title: 'Plant & Stores Manager' },
  { name: 'Vikram Joshi', email: 'sales@invexa.demo', pw: 'Sales@2026', role: 'sales', title: 'Sales Executive' },
];
const NAV = [
  { group: 'Overview' },
  { id: 'dashboard', label: 'Dashboard', ic: 'dashboard' },
  { group: 'Inventory' },
  { id: 'items', label: 'Items & Catalog', ic: 'box' },
  { id: 'batches', label: 'Batches & Expiry', ic: 'layers', badge: () => Store.db.batches.filter(b => ['Expired', 'Expiring'].includes(Store.batchStatus(b))).length },
  { id: 'warehouses', label: 'Warehouses & Cold Chain', ic: 'warehouse' },
  { id: 'adjustments', label: 'Stock Adjustments', ic: 'clipboard' },
  { id: 'transfers', label: 'Stock Transfers', ic: 'transfer', badge: () => Store.db.transfers.filter(t => t.status === 'In Transit').length },
  { group: 'Manufacturing' },
  { id: 'production', label: 'Production Orders', ic: 'factory' },
  { id: 'recipes', label: 'Recipes (BOM)', ic: 'flask' },
  { group: 'Purchases' },
  { id: 'purchases', label: 'Purchase Orders', ic: 'cart' },
  { id: 'vendors', label: 'Vendors', ic: 'building' },
  { group: 'Sales' },
  { id: 'sales', label: 'Sales Orders', ic: 'receipt', badge: () => Store.db.salesOrders.filter(s => s.status === 'Confirmed').length },
  { id: 'customers', label: 'Customers', ic: 'users' },
  { id: 'returns', label: 'Returns & Credit Notes', ic: 'undo' },
  { group: 'Insights' },
  { id: 'reports', label: 'Reports', ic: 'chart' },
  { id: 'activity', label: 'Audit Log', ic: 'activity' },
  { group: 'Administration' },
  { id: 'settings', label: 'Settings', ic: 'settings' },
];

const App = (() => {
  let user = null;
  let route = null;
  let routed = false;
  let idleTimer = null;
  const root = () => $('#root');

  /* ---------- Boot ---------- */
  function showBoot(msg, pct) {
    let b = $('.boot');
    if (!b) { b = document.createElement('div'); b.className = 'boot'; document.body.appendChild(b); }
    b.innerHTML = `<div class="boot-inner"><div class="brand-logo" style="width:54px;height:54px;margin:0 auto 18px;border-radius:14px"><svg class="ic" viewBox="0 0 24 24" style="width:30px;height:30px">${ICONS.logo}</svg></div>
      <div class="spinner"></div><div style="font-weight:600">${esc(msg)}</div>
      ${pct !== undefined ? `<div style="width:260px;margin:14px auto 0">${UI.progress(pct * 100)}</div>` : ''}
      <div class="muted small mt-8">${icon('lock', 'sm')} Encrypted locally with AES-256-GCM</div></div>`;
  }
  const hideBoot = () => $('.boot')?.remove();

  async function boot() {
    if (!window.crypto?.subtle) { root().innerHTML = '<div class="empty"><h4>Secure context required</h4><div>Please open this app over HTTPS.</div></div>'; return; }
    showBoot('Preparing secure workspace…');
    let auth = Store.authData();
    if (!auth?.users?.length) auth = await provision();
    const s = Security.getSession();
    if (s && !s.expired) {
      const u = auth.users.find(x => x.id === s.uid && x.active !== false);
      if (u) { await enter(u, Security.sessionDek(s), false); return; }
    }
    hideBoot();
    renderLogin(s?.expired ? 'Your session was locked after 30 minutes of inactivity. Please sign in again.' : '');
  }

  async function provision() {
    const dek = Security.newDek();
    const users = [];
    for (const d of DEMO_USERS) {
      users.push({ id: Store.uid('us'), name: d.name, email: d.email, role: d.role, title: d.title, cred: await Security.enrol(d.pw, dek), active: true, createdAt: Date.now() });
    }
    dek.fill(0);
    const auth = { version: 1, users };
    Store.saveAuth(auth);
    localStorage.removeItem('invexa.vault');
    return auth;
  }

  async function enter(u, dekRaw, fresh) {
    const ok = await Store.attach(dekRaw);
    if (!ok) {
      showBoot('Generating 60 days of demo operations…', 0);
      const db = await Seed.build(p => showBoot('Generating 60 days of demo operations…', p));
      Store.setDb(db);
      await Store.persist();
    }
    user = u;
    Store.setUser(u);
    if (fresh) { Store.log('Signed in', 'Session', u.email, ROLES[u.role].label); Store.commit('login'); }
    hideBoot();
    renderShell();
    if (!routed) { window.addEventListener('hashchange', onRoute); routed = true; }
    if (!location.hash || location.hash === '#/' || location.hash === '#/login') location.hash = '#/dashboard';
    else onRoute();
    startIdleWatch();
  }

  /* ---------- Login ---------- */
  function renderLogin(notice = '') {
    document.title = 'Sign in · Invexa Inventory Cloud';
    root().innerHTML = `<div class="auth">
      <div class="auth-art">
        <div class="brand"><div class="brand-logo"><svg class="ic" viewBox="0 0 24 24">${ICONS.logo}</svg></div><div><div class="brand-name">Invexa</div><div class="brand-sub">Inventory Cloud</div></div></div>
        <h1>Fresh-food inventory, <span>batch-perfect</span> from plant to shelf.</h1>
        <p class="lead">One platform for perishable manufacturers — recipes, production, cold-chain warehouses, FEFO dispatch, GST invoicing and recall-ready traceability.</p>
        <div class="feat-list">
          <div class="feat"><div class="fi">${icon('layers')}</div><div><b>Batch & expiry (FEFO)</b><span>Auto-pick oldest-expiry first</span></div></div>
          <div class="feat"><div class="fi">${icon('thermo')}</div><div><b>Cold-chain monitoring</b><span>Temperature logs & excursions</span></div></div>
          <div class="feat"><div class="fi">${icon('factory')}</div><div><b>Recipe-driven production</b><span>BOM, material issue & QC</span></div></div>
          <div class="feat"><div class="fi">${icon('scan')}</div><div><b>One-click recall trace</b><span>Batch → customer in seconds</span></div></div>
        </div>
        <div class="auth-foot">${icon('shield', 'sm')} Demo build · Runs 100% in your browser · Data encrypted at rest</div>
      </div>
      <div class="auth-form-wrap"><div class="auth-form">
        <h2>Welcome back</h2><div class="sub">Sign in to your Invexa workspace</div>
        <div id="login-alert">${notice ? `<div class="alert warn">${icon('lock', 'sm')}<div>${esc(notice)}</div></div>` : ''}</div>
        <form id="login" autocomplete="on" novalidate>
          ${UI.field('Work email', `<input class="input" name="email" type="email" autocomplete="username" placeholder="you@company.com" required>`)}
          ${UI.field('Password', `<div class="pw-wrap"><input class="input" name="pw" type="password" autocomplete="current-password" placeholder="••••••••" required><button type="button" data-eye title="Show password">${icon('eye', 'sm')}</button></div>`)}
          <div class="flex-between" style="margin:-4px 0 18px"><label class="flex small" style="gap:6px;cursor:pointer"><input type="checkbox" checked> Keep me signed in on this tab</label><a href="#" class="small" data-forgot>Forgot password?</a></div>
          <button class="btn btn-primary" type="submit">${icon('lock', 'sm')} Sign in securely</button>
        </form>
        <div class="demo-creds"><div class="h">${icon('sparkles', 'sm')} Demo accounts — click to fill</div>
          ${DEMO_USERS.map(d => `<div class="cred" data-e="${d.email}" data-p="${d.pw}">${UI.avatar(d.name, 32)}<div><div class="r">${ROLES[d.role].label}</div><div class="e">${d.email} · <span class="mono">${d.pw}</span></div></div><div class="go">Use →</div></div>`).join('')}
        </div>
        <div class="secure-note">${icon('shield')} PBKDF2-SHA256 (${(Security.ITER / 1000).toFixed(0)}k iterations) · AES-256-GCM vault</div>
      </div></div></div>`;
    const form = $('#login');
    $$('.cred').forEach(c => c.addEventListener('click', () => { form.email.value = c.dataset.e; form.pw.value = c.dataset.p; form.querySelector('button[type=submit]').focus(); }));
    $('[data-eye]').addEventListener('click', e => { const i = form.pw; i.type = i.type === 'password' ? 'text' : 'password'; e.currentTarget.innerHTML = icon(i.type === 'password' ? 'eye' : 'eyeOff', 'sm'); });
    $('[data-forgot]').addEventListener('click', e => { e.preventDefault(); $('#login-alert').innerHTML = `<div class="alert info">${icon('info', 'sm')}<div>This is a demo workspace — use one of the demo accounts below. In production, password resets are handled by your workspace administrator.</div></div>`; });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const alertBox = $('#login-alert');
      const btn = form.querySelector('button[type=submit]');
      const email = form.email.value.trim().toLowerCase(), pw = form.pw.value;
      if (!email || !pw) { alertBox.innerHTML = `<div class="alert err">${icon('alert', 'sm')}<div>Enter your email and password.</div></div>`; return; }
      const lock = Security.lockedFor();
      if (lock) { alertBox.innerHTML = `<div class="alert err">${icon('lock', 'sm')}<div>Too many failed attempts. Try again in ${Math.ceil(lock / 1000)}s.</div></div>`; return; }
      btn.disabled = true; btn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;margin:0"></span> Verifying…`;
      const auth = Store.authData();
      const u = auth.users.find(x => x.email.toLowerCase() === email);
      let dek = null;
      try { dek = await Security.unlock(pw, (u && u.active !== false ? u : auth.users[0]).cred); if (!u || u.active === false) dek = null; } catch { dek = null; }
      if (!dek) {
        const g = Security.recordFail();
        btn.disabled = false; btn.innerHTML = `${icon('lock', 'sm')} Sign in securely`;
        alertBox.innerHTML = `<div class="alert err">${icon('alert', 'sm')}<div>Invalid email or password.${g.until > Date.now() ? ' Account temporarily locked for 60s.' : ` ${5 - g.fails} attempt(s) left before a temporary lock.`}</div></div>`;
        return;
      }
      Security.recordSuccess();
      Security.startSession(u.id, dek);
      u.lastLogin = Date.now();
      Store.saveAuth(auth);
      await enter(u, dek, true);
    });
  }

  async function logout(reason) {
    clearInterval(idleTimer);
    if (Store.db && reason !== 'locked') { Store.log('Signed out', 'Session', user?.email); await Store.persist(); }
    else if (Store.db) await Store.persist();
    Security.endSession();
    Store.detach();
    user = null; route = null;
    UI.closeDrawer(); UI.destroyCharts();
    $$('.overlay').forEach(o => o.remove());
    history.replaceState(null, '', location.pathname);
    renderLogin(reason === 'locked' ? 'Your session was locked after 30 minutes of inactivity. Please sign in again.' : '');
  }

  function startIdleWatch() {
    let last = 0;
    const bump = () => { const n = Date.now(); if (n - last > 15000) { last = n; Security.touch(); } };
    ['mousemove', 'keydown', 'click', 'touchstart'].forEach(ev => window.addEventListener(ev, bump, { passive: true }));
    clearInterval(idleTimer);
    idleTimer = setInterval(() => { const s = Security.getSession(); if (user && (!s || s.expired)) logout('locked'); }, 20000);
  }

  /* ---------- Shell ---------- */
  const can = path => { const r = ROLES[user.role].routes; return r === '*' || r.includes(path); };

  function renderShell() {
    const c = Store.db.company;
    root().innerHTML = `<div class="app">
      <aside class="sidebar" id="sidebar">
        <div class="brand"><div class="brand-logo"><svg class="ic" viewBox="0 0 24 24">${ICONS.logo}</svg></div><div><div class="brand-name">Invexa</div><div class="brand-sub">Inventory Cloud</div></div></div>
        <div class="org-card"><div class="org-avatar">${esc(UI.initials(c.name))}</div><div style="min-width:0"><div class="org-name">${esc(c.name)}</div><div class="org-plan">${esc(c.plan)}</div></div></div>
        <nav class="nav" id="nav"></nav>
        <div class="sidebar-foot">${icon('shield', 'sm')} Vault encrypted · AES-256-GCM</div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="icon-btn menu-btn" id="menu-btn">${icon('menu')}</button>
          <div class="search-input global-search" id="gsearch">${icon('search', 'sm')}<input class="input" placeholder="Search items, batches, orders, customers…" readonly><span class="kbd">Ctrl K</span></div>
          <div class="top-actions">
            <div id="quick"><button class="btn btn-primary btn-sm" id="quick-btn">${icon('plus', 'sm')} New</button></div>
            <div id="bell-wrap"><button class="icon-btn" id="bell" title="Alerts">${icon('bell')}<span class="dot hidden" id="bell-dot"></span></button></div>
            <div id="user-wrap"><div class="user-chip" id="user-chip">${UI.avatar(user.name)}<div><div class="nm">${esc(user.name)}</div><div class="rl">${esc(ROLES[user.role].label)}</div></div>${icon('chevDown', 'sm')}</div></div>
          </div>
        </header>
        <div class="demo-ribbon">${icon('sparkles', 'sm')}<b>Live demo workspace</b><span class="sep">|</span><span>Data is simulated & stored encrypted in this browser only — every module is fully interactive.</span><button id="ribbon-reset">Reset demo data</button></div>
        <main class="content" id="page"></main>
      </div></div>`;
    renderNav();
    $('#menu-btn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
    $('#gsearch').addEventListener('click', openSearch);
    $('#quick-btn').addEventListener('click', e => { e.stopPropagation(); openQuick(); });
    $('#bell').addEventListener('click', e => { e.stopPropagation(); openAlerts(); });
    $('#user-chip').addEventListener('click', e => { e.stopPropagation(); openUserMenu(); });
    $('#ribbon-reset').addEventListener('click', resetDemo);
    document.onkeydown = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); } };
    Store.onChange(scheduleBadges);
    updateBadges();
  }
  function renderNav() {
    let html = '', pendingGroup = null;
    for (const n of NAV) {
      if (n.group) { pendingGroup = n.group; continue; }
      if (!can(n.id)) continue;
      if (pendingGroup) { html += `<div class="nav-group">${pendingGroup}</div>`; pendingGroup = null; }
      html += `<a href="#/${n.id}" data-nav="${n.id}">${icon(n.ic)}<span>${n.label}</span>${n.badge ? `<span class="count hidden" data-badge="${n.id}"></span>` : ''}</a>`;
    }
    $('#nav').innerHTML = html;
  }
  let badgeQueued = false;
  function scheduleBadges() { if (badgeQueued) return; badgeQueued = true; requestAnimationFrame(() => { badgeQueued = false; if (user && Store.db) updateBadges(); }); }
  function updateBadges() {
    for (const n of NAV) {
      if (!n.badge) continue;
      const el = $(`[data-badge="${n.id}"]`); if (!el) continue;
      const v = n.badge();
      el.textContent = v; el.classList.toggle('hidden', !v);
    }
    const a = Store.alerts().length;
    const dot = $('#bell-dot');
    if (dot) { dot.textContent = a; dot.classList.toggle('hidden', !a); }
  }

  /* ---------- Router ---------- */
  function parseHash() {
    const h = location.hash.slice(1) || '/dashboard';
    const [p, qs] = h.split('?');
    return { path: p.replace(/^\//, '') || 'dashboard', params: Object.fromEntries(new URLSearchParams(qs || '')) };
  }
  function onRoute() {
    if (!user) return;
    const { path, params } = parseHash();
    const page = Pages[path];
    if (!page || !can(path)) { if (page) UI.toast(`Your role (${ROLES[user.role].label}) doesn't have access to that module`, 'warning'); location.hash = '#/dashboard'; return; }
    UI.destroyCharts(); UI.closeDrawer(); UI.closePopover();
    route = { path, params };
    $$('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === path));
    document.title = `${page.title} · Invexa`;
    const el = $('#page');
    el.innerHTML = '';
    page.render(el, params);
    window.scrollTo(0, 0);
    $('#sidebar')?.classList.remove('open');
  }
  function refresh() {
    if (!route || !user) return;
    UI.destroyCharts();
    const y = window.scrollY;
    const { id, ...rest } = route.params;
    Pages[route.path].render($('#page'), rest);
    window.scrollTo(0, y);
    updateBadges();
  }
  function go(hash, then) {
    if (location.hash === hash) { onRoute(); }
    else location.hash = hash;
    if (then) setTimeout(then, 60);
  }

  /* ---------- Helpers for pages ---------- */
  function head({ title, sub = '', actions = '', crumbs = '' }) {
    return `<div class="page-head"><div>${crumbs ? `<div class="crumbs">${crumbs}</div>` : ''}<h1 class="page-title">${title}</h1>${sub ? `<div class="page-sub">${sub}</div>` : ''}</div><div class="page-actions">${actions}</div></div>`;
  }
  const sampleBtn = (label = 'Generate sample data') => `<button class="btn btn-magic" data-sample>${icon('sparkles', 'sm')} ${label}</button>`;
  function bindSample(el, fn) {
    $('[data-sample]', el)?.addEventListener('click', () => {
      try { const n = fn(); UI.toast(`Generated ${n} sample record${n === 1 ? '' : 's'} — linked modules updated`); refresh(); }
      catch (e) { UI.toast(e.message, 'error'); }
    });
  }

  /* ---------- Quick create / alerts / user menu ---------- */
  function openQuick() {
    const opts = [
      ['sales', 'receipt', 'Sales Order'], ['purchases', 'cart', 'Purchase Order'], ['production', 'factory', 'Production Order'],
      ['transfers', 'transfer', 'Stock Transfer'], ['adjustments', 'clipboard', 'Stock Adjustment'], ['items', 'box', 'Item'], ['customers', 'users', 'Customer'],
    ].filter(o => can(o[0]));
    UI.popover($('#quick'), `<div style="padding:6px 0">${opts.map(o => `<div class="pi" data-q="${o[0]}">${icon(o[1], 'sm')} ${o[2]}</div>`).join('')}</div>`, p => {
      $$('[data-q]', p).forEach(x => x.addEventListener('click', () => { UI.closePopover(); const pg = x.dataset.q; go(`#/${pg}`, () => Pages[pg].create?.()); }));
    });
  }
  function openAlerts() {
    const list = Store.alerts();
    const tone = { red: 'ti-red', amber: 'ti-amber', blue: 'ti-blue' };
    const ic = { low: 'box', expiring: 'clock', expired: 'alert', po: 'cart', so: 'truck', temp: 'thermo', trf: 'transfer' };
    UI.popover($('#bell-wrap'), `<div class="notif-pop"><div class="ph flex-between"><b>Alerts</b><span class="badge b-red plain">${list.length}</span></div>
      ${list.length ? list.map((a, i) => `<div class="notif" data-i="${i}"><div class="dot-ic ${tone[a.sev]}">${icon(ic[a.kind] || 'info')}</div><div><div class="t">${esc(a.title)}</div><div class="s">${esc(a.sub)}</div></div></div>`).join('') : UI.empty('checkCircle', 'All clear', 'No alerts right now')}</div>`, p => {
      $$('[data-i]', p).forEach(n => n.addEventListener('click', () => { UI.closePopover(); location.hash = list[+n.dataset.i].route; }));
    });
  }
  function openUserMenu() {
    UI.popover($('#user-wrap'), `<div class="ph"><div class="flex">${UI.avatar(user.name, 38)}<div><div class="fw-600">${esc(user.name)}</div><div class="small muted">${esc(user.email)}</div><div class="mt-8">${UI.badge(ROLES[user.role].label)}</div></div></div></div>
      <div style="padding:6px 0"><div class="pi" data-u="pw">${icon('key', 'sm')} Change password</div>${can('settings') ? `<div class="pi" data-u="settings">${icon('settings', 'sm')} Workspace settings</div>` : ''}
      <div class="pi" data-u="lock">${icon('lock', 'sm')} Lock session</div><div class="pi" data-u="out" style="color:var(--danger)">${icon('logout', 'sm')} Sign out</div></div>`, p => {
      $$('[data-u]', p).forEach(x => x.addEventListener('click', () => {
        UI.closePopover();
        const a = x.dataset.u;
        if (a === 'pw') changePassword();
        if (a === 'settings') location.hash = '#/settings';
        if (a === 'lock') logout('locked');
        if (a === 'out') logout();
      }));
    });
  }
  function changePassword(target) {
    const self = !target;
    const u = target || user;
    UI.formModal({
      title: self ? 'Change password' : `Reset password · ${esc(u.name)}`, size: 'sm', submitText: 'Update password', submitIcon: 'key',
      body: `${self ? UI.field('Current password', UI.input('cur', '', { type: 'password' }), { req: true }) : `<div class="alert info">${icon('info', 'sm')}<div>The workspace data key will be re-wrapped with the new password. The old password stops working immediately.</div></div>`}
        <div class="mt-16">${UI.field('New password', UI.input('pw', '', { type: 'password', ph: 'Min 8 chars, mixed case, number, symbol' }), { req: true })}</div>
        <div class="mt-8" id="pw-meter"></div>
        <div class="mt-16">${UI.field('Confirm new password', UI.input('pw2', '', { type: 'password' }), { req: true })}</div>`,
      onMount(m, close, form) {
        form.pw.addEventListener('input', () => {
          const s = Security.strength(form.pw.value);
          const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'], tones = ['red', 'red', 'amber', '', 'green'];
          $('#pw-meter', m).innerHTML = `${UI.progress((s + 1) * 20, tones[s])}<div class="hint mt-8">Strength: ${labels[s]}</div>`;
        });
      },
      async onSubmit(form, close) {
        const f = UI.formData(form);
        if (Security.strength(f.pw) < 3 || f.pw.length < 8) throw new Error('Choose a stronger password (8+ chars with upper/lowercase, numbers and symbols)');
        if (f.pw !== f.pw2) throw new Error('Passwords do not match');
        const auth = Store.authData();
        const rec = auth.users.find(x => x.id === u.id);
        let dek;
        if (self) { dek = await Security.unlock(f.cur, rec.cred); if (!dek) throw new Error('Current password is incorrect'); }
        else dek = Security.sessionDek(Security.getSession());
        rec.cred = await Security.enrol(f.pw, dek);
        rec.pwChangedAt = Date.now();
        Store.saveAuth(auth);
        Store.log('Password changed', 'User', rec.email, self ? 'Self-service' : `Reset by ${user.name}`);
        Store.commit('auth');
        close(); UI.toast('Password updated — data key re-wrapped');
      },
    });
  }
  async function resetDemo() {
    if (!(await UI.confirm({ title: 'Reset demo data?', message: 'This regenerates a fresh 60-day demo dataset. Any records you created will be replaced. User accounts are kept.', okText: 'Reset data', danger: true }))) return;
    showBoot('Regenerating demo operations…', 0);
    const db = await Seed.build(p => showBoot('Regenerating demo operations…', p));
    Store.setDb(db);
    Store.setUser(user);
    Store.log('Reset', 'Workspace', 'Demo data', 'Regenerated 60-day dataset');
    await Store.persist();
    hideBoot();
    renderShell();
    onRoute();
    UI.toast('Demo data regenerated');
  }

  /* ---------- Command palette ---------- */
  function openSearch() {
    const db = Store.db;
    const pages = NAV.filter(n => n.id && can(n.id)).map(n => ({ g: 'Pages', t: n.label, s: 'Go to module', ic: n.ic, h: `#/${n.id}` }));
    const idx = [
      ...pages,
      ...(can('items') ? db.items.map(i => ({ g: 'Items', t: i.name, s: `${i.sku} · ${fmt.qty(Store.stock(i.id), i.uom)} on hand`, ic: 'box', h: `#/items?id=${i.id}` })) : []),
      ...(can('batches') ? db.batches.filter(b => b.qty > 0).map(b => ({ g: 'Batches', t: b.batchNo, s: `${Store.item(b.itemId)?.name} · ${Store.wh(b.whId)?.code} · exp ${fmt.date(b.exp)}`, ic: 'layers', h: `#/batches?id=${b.id}` })) : []),
      ...(can('sales') ? db.salesOrders.map(s => ({ g: 'Sales Orders', t: `${s.no}${s.invoiceNo ? ' · ' + s.invoiceNo : ''}`, s: `${Store.customer(s.customerId)?.name} · ${s.status}`, ic: 'receipt', h: `#/sales?id=${s.id}` })) : []),
      ...(can('purchases') ? db.purchaseOrders.map(p => ({ g: 'Purchase Orders', t: p.no, s: `${Store.vendor(p.vendorId)?.name} · ${p.status}`, ic: 'cart', h: `#/purchases?id=${p.id}` })) : []),
      ...(can('production') ? db.productions.map(m => ({ g: 'Production', t: m.no, s: `${Store.item(m.itemId)?.name} · ${m.status}`, ic: 'factory', h: `#/production?id=${m.id}` })) : []),
      ...(can('customers') ? db.customers.map(c => ({ g: 'Customers', t: c.name, s: `${c.type} · ${c.city}`, ic: 'users', h: `#/customers?id=${c.id}` })) : []),
      ...(can('vendors') ? db.vendors.map(v => ({ g: 'Vendors', t: v.name, s: `${v.category} · ${v.city}`, ic: 'building', h: `#/vendors?id=${v.id}` })) : []),
    ];
    let sel = 0, results = [];
    const { el, close } = UI.modal({
      title: 'Search', size: 'cmdk',
      body: `<div class="search-input">${icon('search')}<input class="input" placeholder="Type to search everything…" id="cmdk-q"></div><div class="cmdk-results" id="cmdk-r"></div>`,
    });
    el.classList.add('cmdk');
    $('.modal-head', el).remove();
    $('.modal-body', el).style.padding = '0';
    const q = $('#cmdk-q', el), r = $('#cmdk-r', el);
    const draw = () => {
      const t = q.value.trim().toLowerCase();
      results = (t ? idx.filter(x => (x.t + ' ' + x.s).toLowerCase().includes(t)) : pages).slice(0, 40);
      sel = Math.min(sel, Math.max(0, results.length - 1));
      let g = '';
      r.innerHTML = results.length ? results.map((x, i) => { const head = x.g !== g ? `<div class="cmdk-group">${x.g}</div>` : ''; g = x.g; return `${head}<div class="cmdk-item ${i === sel ? 'sel' : ''}" data-i="${i}"><div class="dot-ic ti-blue">${icon(x.ic)}</div><div style="min-width:0"><div class="fw-600">${esc(x.t)}</div><div class="small muted">${esc(x.s)}</div></div></div>`; }).join('') : UI.empty('search', 'No matches', 'Try a SKU, batch number, order number or name');
      $$('[data-i]', r).forEach(n => n.addEventListener('click', () => pickRes(+n.dataset.i)));
    };
    const pickRes = i => { const x = results[i]; if (!x) return; close(); location.hash = x.h; };
    q.addEventListener('input', () => { sel = 0; draw(); });
    q.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { sel = Math.min(results.length - 1, sel + 1); draw(); e.preventDefault(); }
      if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
      if (e.key === 'Enter') pickRes(sel);
    });
    draw();
    setTimeout(() => q.focus(), 30);
  }

  return { boot, refresh, go, head, sampleBtn, bindSample, can, changePassword, logout, get user() { return user; }, get route() { return route; } };
})();
