/* ==========================================================================
   Settings: Organization, Users & Roles, Security, Preferences, Plan, Data
   ========================================================================== */
Pages.settings = {
  title: 'Settings',
  tab: 'org',
  render(el) {
    const self = this;
    const tabs = [['org', 'building', 'Organization'], ['users', 'users', 'Users & roles'], ['security', 'shield', 'Security & encryption'], ['prefs', 'settings', 'Preferences'], ['plan', 'zap', 'Subscription'], ['data', 'database', 'Data & backup']];
    el.innerHTML = App.head({ title: 'Settings', sub: 'Workspace configuration, access control and data security' }) +
      `<div class="tabs">${tabs.map(([k, ic, l]) => `<button class="tab ${self.tab === k ? 'active' : ''}" data-tab="${k}">${icon(ic, 'sm')} ${l}</button>`).join('')}</div><div id="pane"></div>`;
    $$('[data-tab]', el).forEach(b => b.addEventListener('click', () => { self.tab = b.dataset.tab; self.render(el); }));
    self[self.tab]($('#pane', el));
  },

  org(el) {
    const c = Store.db.company;
    el.innerHTML = `<div class="card"><div class="card-body"><form id="org" class="form-grid">
      ${UI.field('Legal name', UI.input('name', c.name), { req: true, span: true })}
      ${UI.field('Industry', UI.input('industry', c.industry))}
      ${UI.field('Plant capacity (kg/day)', UI.input('capacityKg', c.capacityKg, { type: 'number', min: 1 }))}
      ${UI.field('GSTIN', UI.input('gstin', c.gstin))}
      ${UI.field('FSSAI licence no.', UI.input('fssai', c.fssai))}
      ${UI.field('PAN', UI.input('pan', c.pan))}
      ${UI.field('Home state (for CGST/SGST vs IGST)', UI.input('state', c.state))}
      ${UI.field('Phone', UI.input('phone', c.phone))}
      ${UI.field('Email', UI.input('email', c.email))}
      ${UI.field('Registered address', UI.input('address', c.address), { span: true })}
      ${UI.field('Currency', UI.select('currency', UI.options(['INR'], c.currency)))}
      ${UI.field('Financial year starts', UI.select('fyStart', UI.options(['April', 'January'], c.fyStart)))}
      <div class="span-2 flex" style="justify-content:flex-end"><button class="btn btn-primary" type="submit">${icon('check', 'sm')} Save organization</button></div>
    </form></div></div>`;
    $('#org', el).addEventListener('submit', e => {
      e.preventDefault();
      const d = UI.formData(e.target);
      if (!d.name) { UI.toast('Legal name is required', 'error'); return; }
      Object.assign(Store.db.company, d);
      Store.log('Updated', 'Organization', d.name);
      Store.commit('company');
      UI.toast('Organization saved');
      $('.org-name').textContent = d.name;
    });
  },

  users(el) {
    const self = this;
    const auth = Store.authData();
    const me = App.user;
    const mods = NAV.filter(n => n.id);
    el.innerHTML = `<div class="flex-between mb-16"><div class="muted">${auth.users.length} users · passwords are never stored — only salted PBKDF2 verifiers</div><button class="btn btn-primary" data-add>${icon('plus', 'sm')} Invite user</button></div>
      <div class="card table-card"><div class="table-wrap"><table class="tbl"><thead><tr><th>User</th><th>Role</th><th>Title</th><th>Last sign-in</th><th>Status</th><th></th></tr></thead><tbody>
      ${auth.users.map(u => `<tr><td><div class="item-cell">${UI.avatar(u.name, 34)}<div><div class="cell-main">${esc(u.name)}${u.id === me.id ? ' <span class="chip">You</span>' : ''}</div><div class="cell-sub">${esc(u.email)}</div></div></div></td>
        <td>${UI.badge(ROLES[u.role].label)}</td><td>${esc(u.title || '')}</td><td>${u.lastLogin ? fmt.rel(u.lastLogin) : '<span class="muted">Never</span>'}</td><td>${UI.badge(u.active === false ? 'Disabled' : 'Active')}</td>
        <td class="right nowrap"><button class="btn btn-sm" data-reset="${u.id}">${icon('key', 'sm')} Reset password</button> ${u.id !== me.id ? `<button class="btn btn-sm ${u.active === false ? '' : 'btn-danger'}" data-toggle="${u.id}">${u.active === false ? 'Enable' : 'Disable'}</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div></div>
      <div class="section-title" style="margin-top:28px">Role permissions</div>
      <div class="card table-card"><div class="table-wrap"><table class="tbl compact"><thead><tr><th>Module</th>${Object.values(ROLES).map(r => `<th class="center">${r.label}</th>`).join('')}</tr></thead><tbody>
      ${mods.map(n => `<tr><td>${icon(n.ic, 'sm')} ${n.label}</td>${Object.values(ROLES).map(r => `<td class="center">${r.routes === '*' || r.routes.includes(n.id) ? `<span class="text-success">${icon('check', 'sm')}</span>` : '<span class="muted">—</span>'}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div></div>`;
    $('[data-add]', el).addEventListener('click', () => self.invite());
    $$('[data-reset]', el).forEach(b => b.addEventListener('click', () => App.changePassword(b.dataset.reset === me.id ? undefined : auth.users.find(u => u.id === b.dataset.reset))));
    $$('[data-toggle]', el).forEach(b => b.addEventListener('click', () => {
      const a = Store.authData(); const u = a.users.find(x => x.id === b.dataset.toggle);
      u.active = u.active === false; Store.saveAuth(a);
      Store.log(u.active ? 'Enabled' : 'Disabled', 'User', u.email); Store.commit('auth');
      UI.toast(`${u.name} ${u.active ? 'enabled' : 'disabled'}`); self.users(el);
    }));
  },
  invite() {
    const self = this;
    UI.formModal({
      title: 'Invite user', submitText: 'Create user', submitIcon: 'user',
      body: `<div class="form-grid">${UI.field('Full name', UI.input('name', ''), { req: true })}${UI.field('Email', UI.input('email', '', { type: 'email' }), { req: true })}
        ${UI.field('Role', UI.select('role', UI.options(Object.entries(ROLES).map(([id, r]) => ({ id, name: r.label })), 'inventory')))}${UI.field('Job title', UI.input('title', ''))}
        ${UI.field('Temporary password', UI.input('pw', '', { type: 'password', ph: '8+ chars, mixed case, number, symbol' }), { req: true, span: true, hint: 'The workspace data key is wrapped with a key derived from this password.' })}</div>`,
      async onSubmit(form, close) {
        const d = UI.formData(form);
        if (!d.name || !/^\S+@\S+\.\S+$/.test(d.email)) throw new Error('Enter a name and a valid email');
        if (Security.strength(d.pw) < 3 || d.pw.length < 8) throw new Error('Password too weak');
        const auth = Store.authData();
        if (auth.users.some(u => u.email.toLowerCase() === d.email.toLowerCase())) throw new Error('A user with this email already exists');
        const dek = Security.sessionDek(Security.getSession());
        auth.users.push({ id: Store.uid('us'), name: d.name, email: d.email.toLowerCase(), role: d.role, title: d.title, cred: await Security.enrol(d.pw, dek), active: true, createdAt: Date.now() });
        Store.saveAuth(auth);
        Store.log('Created', 'User', d.email, ROLES[d.role].label); Store.commit('auth');
        close(); UI.toast(`${d.name} can now sign in`); App.refresh();
      },
    });
  },

  security(el) {
    const v = Store.vaultInfo();
    const s = Security.getSession();
    const auth = Store.authData();
    el.innerHTML = `<div class="grid grid-2">
      <div class="card"><div class="card-body"><div class="flex"><div class="dot-ic ti-green">${icon('lock')}</div><div><div class="card-title">Encryption at rest</div><div class="card-sub">All business data in one encrypted vault</div></div></div>
        <dl class="dl mt-16"><dt>Cipher</dt><dd>${esc(v?.alg || 'AES-256-GCM')} (authenticated)</dd><dt>Data key</dt><dd>Random 256-bit DEK (Web Crypto CSPRNG)</dd><dt>Vault size</dt><dd>${fmt.num((v?.bytes || 0) / 1024, 1)} KB in browser storage</dd><dt>Last sealed</dt><dd>${v?.at ? fmt.dt(v.at) : '—'}</dd><dt>Nonce (IV)</dt><dd class="mono small">${esc(v?.iv || '')}</dd></dl>
        <button class="btn btn-sm mt-16" data-raw>${icon('eye', 'sm')} View raw stored data</button></div></div>
      <div class="card"><div class="card-body"><div class="flex"><div class="dot-ic ti-blue">${icon('key')}</div><div><div class="card-title">Credentials & key wrapping</div><div class="card-sub">Envelope encryption per user</div></div></div>
        <dl class="dl mt-16"><dt>Password KDF</dt><dd>PBKDF2-HMAC-SHA256 · ${fmt.num(Security.ITER)} iterations</dd><dt>Salt</dt><dd>128-bit random, unique per user</dd><dt>Stored</dt><dd>SHA-256 verifier + wrapped DEK only — never the password</dd><dt>Comparison</dt><dd>Constant-time</dd><dt>Users enrolled</dt><dd>${auth.users.length}</dd></dl></div></div>
      <div class="card"><div class="card-body"><div class="flex"><div class="dot-ic ti-violet">${icon('clock')}</div><div><div class="card-title">Session protection</div><div class="card-sub">Current session</div></div></div>
        <dl class="dl mt-16"><dt>Signed in as</dt><dd>${esc(App.user.email)}</dd><dt>Session started</dt><dd>${s?.iat ? fmt.dt(s.iat) : '—'}</dd><dt>Idle auto-lock</dt><dd>${Security.IDLE_MS / 3600000} hours</dd><dt>Scope</dt><dd>Tab-scoped (sessionStorage) — closing the tab signs out</dd><dt>Brute-force guard</dt><dd>5 failed attempts → 60-second lock</dd></dl>
        <div class="flex mt-16"><button class="btn btn-sm" data-pw>${icon('key', 'sm')} Change password</button><button class="btn btn-sm" data-lock>${icon('lock', 'sm')} Lock now</button></div></div></div>
      <div class="card"><div class="card-body"><div class="flex"><div class="dot-ic ti-amber">${icon('shield')}</div><div><div class="card-title">Compliance & audit</div><div class="card-sub">Food-safety & finance controls</div></div></div>
        <dl class="dl mt-16"><dt>Audit trail</dt><dd>${fmt.num(Store.db.activity.length)} events logged with user & timestamp</dd><dt>Stock ledger</dt><dd>${fmt.num(Store.db.movements.length)} immutable movements</dd><dt>Traceability</dt><dd>Raw lot → production batch → customer invoice</dd><dt>Cold-chain log</dt><dd>${fmt.num(Store.db.tempLogs.length)} readings retained</dd><dt>Role-based access</dt><dd>${Object.keys(ROLES).length} roles · route-level enforcement</dd></dl></div></div>
    </div>`;
    $('[data-raw]', el).addEventListener('click', () => {
      const raw = localStorage.getItem('invexa.vault') || '';
      const authRaw = JSON.stringify(Store.authData().users[0], null, 2);
      UI.modal({ title: 'What is actually stored in the browser', size: 'lg', body: `<p class="muted" style="margin-top:0">Business data (<span class="mono">localStorage["invexa.vault"]</span>) — only ciphertext is persisted:</p><pre class="mono" style="white-space:pre-wrap;word-break:break-all;background:#0f172a;color:#a5f3fc;padding:14px;border-radius:10px;max-height:200px;overflow:auto">${esc(raw.slice(0, 1400))}…</pre>
        <p class="muted">A user record (<span class="mono">localStorage["invexa.auth"]</span>) — no password, only salt, verifier and wrapped key:</p><pre class="mono" style="white-space:pre-wrap;word-break:break-all;background:#0f172a;color:#bbf7d0;padding:14px;border-radius:10px;max-height:240px;overflow:auto">${esc(authRaw)}</pre>` });
    });
    $('[data-pw]', el).addEventListener('click', () => App.changePassword());
    $('[data-lock]', el).addEventListener('click', () => App.logout('locked'));
  },

  prefs(el) {
    const st = Store.db.settings;
    const rows = [
      ['fefo', 'Enforce FEFO picking', 'Dispatch, transfers and production always consume the earliest-expiring usable batch first. Expired batches are never picked.', true],
      ['negativeStock', 'Allow negative stock', 'Disabled for food safety — every pack must be traceable to a batch.', true],
      ['autoBatch', 'Auto-generate batch numbers', 'Format: PRODUCT-YYMMDD (e.g. TPL2-261113) with suffix for multiple runs per day.', false],
      ['nearExpiryAlerts', 'Near-expiry alerts', 'Alert when a batch enters its final window (3 days for fresh items, 10–30 days for longer shelf life).', false],
      ['tempAlerts', 'Cold-chain excursion alerts', 'Raise an alert when a reading falls outside a warehouse’s allowed range.', false],
      ['lowStockAlerts', 'Low stock alerts', 'Alert when usable stock drops below an item’s reorder level.', false],
    ];
    el.innerHTML = `<div class="card"><div class="card-body">${rows.map(([k, l, d, locked]) => `<div class="list-row"><div class="meta"><div class="t">${l} ${locked ? '<span class="chip">Policy</span>' : ''}</div><div class="s" style="white-space:normal">${d}</div></div>
      <label class="flex" style="gap:8px"><input type="checkbox" data-k="${k}" ${st[k] ? 'checked' : ''} ${locked ? 'disabled' : ''} style="width:18px;height:18px"></label></div>`).join('')}</div></div>`;
    $$('[data-k]', el).forEach(c => c.addEventListener('change', () => { st[c.dataset.k] = c.checked; Store.log('Updated', 'Preference', c.dataset.k, c.checked ? 'On' : 'Off'); Store.commit('settings'); UI.toast('Preference saved'); }));
  },

  plan(el) {
    const db = Store.db;
    const monthStart = Store.today().slice(0, 8) + '01';
    const tx = db.salesOrders.filter(s => s.date >= monthStart).length + db.purchaseOrders.filter(p => p.date >= monthStart).length + db.productions.filter(m => m.date >= monthStart).length + db.adjustments.filter(a => a.date >= monthStart).length + db.transfers.filter(t => t.date >= monthStart).length;
    const v = Store.vaultInfo();
    const meters = [['Users', Store.authData().users.length, 10], ['Warehouses', db.warehouses.length, 10], ['Active SKUs', db.items.filter(i => i.active).length, 500], ['Transactions this month', tx, 10000], ['Storage (KB)', Math.round((v?.bytes || 0) / 1024), 5120]];
    el.innerHTML = `<div class="grid grid-main"><div class="hero" style="margin:0;align-items:flex-start;flex-direction:column">
        <div class="flex" style="gap:10px"><span class="badge plain" style="background:rgba(255,255,255,.2);color:#fff">Current plan</span></div>
        <h2 style="font-size:28px;margin-top:6px">Business · Annual</h2><p>Multi-warehouse, batch & expiry, manufacturing, GST invoicing, cold-chain logs, role-based access and full audit trail.</p>
        <div class="flex mt-16" style="flex-wrap:wrap;gap:8px">${['Unlimited batches', 'FEFO engine', 'Recall trace', 'Recipes & QC', 'GST reports', 'API access (Enterprise)'].map(f => `<span class="badge plain" style="background:rgba(255,255,255,.16);color:#fff">${f}</span>`).join('')}</div>
        <div class="flex mt-24"><button class="btn" style="background:#fff;color:var(--primary);border:none" data-up>${icon('zap', 'sm')} Upgrade to Enterprise</button><span style="opacity:.85;font-size:12.5px">Renews ${fmt.date(Store.addDays(Store.today(), 214))}</span></div></div>
      <div class="card"><div class="card-head"><div class="card-title">Usage</div></div><div class="card-body">${meters.map(([l, u, max]) => `<div style="margin-bottom:14px"><div class="flex-between small"><span>${l}</span><b>${fmt.num(u)} / ${fmt.num(max)}</b></div><div class="mt-8">${UI.progress(u / max * 100, u / max > 0.85 ? 'red' : u / max > 0.6 ? 'amber' : '')}</div></div>`).join('')}</div></div></div>`;
    $('[data-up]', el).addEventListener('click', () => UI.toast('Demo workspace — billing is disabled', 'info'));
  },

  data(el) {
    el.innerHTML = `<div class="grid grid-2">
      <div class="card"><div class="card-body"><div class="flex"><div class="dot-ic ti-blue">${icon('download')}</div><div><div class="card-title">Encrypted backup</div><div class="card-sub">Download the AES-256-GCM vault exactly as stored</div></div></div><p class="muted small">Only restorable by a user of this workspace. Safe to store anywhere.</p><button class="btn" data-enc>${icon('download', 'sm')} Download encrypted backup</button></div></div>
      <div class="card"><div class="card-body"><div class="flex"><div class="dot-ic ti-amber">${icon('file')}</div><div><div class="card-title">Plain JSON export</div><div class="card-sub">Decrypted data for migration / analysis</div></div></div><p class="muted small">Contains all business data in clear text — handle with care.</p><button class="btn" data-plain>${icon('download', 'sm')} Export decrypted JSON</button></div></div>
      <div class="card"><div class="card-body"><div class="flex"><div class="dot-ic ti-violet">${icon('refresh')}</div><div><div class="card-title">Reset demo data</div><div class="card-sub">Regenerate a fresh 60-day simulation</div></div></div><p class="muted small">Keeps user accounts. Replaces all items, orders, batches and logs.</p><button class="btn" data-reset>${icon('refresh', 'sm')} Reset demo data</button></div></div>
      <div class="card"><div class="card-body"><div class="flex"><div class="dot-ic ti-red">${icon('trash')}</div><div><div class="card-title">Factory reset</div><div class="card-sub">Wipe vault, users and keys from this browser</div></div></div><p class="muted small">The workspace returns to first-run state with the default demo accounts.</p><button class="btn btn-danger" data-wipe>${icon('trash', 'sm')} Factory reset</button></div></div>
    </div>`;
    $('[data-enc]', el).addEventListener('click', async () => { await Store.persist(); UI.download(`invexa-vault-${Store.today()}.json`, localStorage.getItem('invexa.vault')); UI.toast('Encrypted backup downloaded'); });
    $('[data-plain]', el).addEventListener('click', async () => {
      if (!(await UI.confirm({ title: 'Export decrypted data?', message: 'The file will contain all business data in clear text.', okText: 'Export' }))) return;
      UI.download(`invexa-data-${Store.today()}.json`, JSON.stringify(Store.db, null, 1));
      Store.log('Exported', 'Workspace', 'Plain JSON'); Store.commit('export');
    });
    $('[data-reset]', el).addEventListener('click', () => $('#ribbon-reset').click());
    $('[data-wipe]', el).addEventListener('click', async () => {
      if (!(await UI.confirm({ title: 'Factory reset?', message: 'All data, users and keys will be erased from this browser.', okText: 'Erase everything', danger: true }))) return;
      ['invexa.vault', 'invexa.auth', 'invexa.guard'].forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
      location.hash = '';
      location.reload();
    });
  },
};
