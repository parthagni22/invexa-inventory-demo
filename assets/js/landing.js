/* ==========================================================================
   Invexa — Public landing page
   ========================================================================== */
const Landing = (() => {
  const logo = (cls = '') => `<div class="brand-logo ${cls}"><svg class="ic" viewBox="0 0 24 24">${ICONS.logo}</svg></div>`;

  const FEATURES = [
    ['layers', 'Batch & expiry control', 'Every pack belongs to a batch with manufacture and expiry dates. FEFO picking always ships the earliest-expiring stock first — expired lots are never dispatched.', 'blue'],
    ['thermo', 'Cold-chain monitoring', 'Temperature logs for every cold room and hub, with instant excursion alerts and a compliance score you can show auditors.', 'cyan'],
    ['factory', 'Recipe-driven production', 'Plan runs from standard recipes, auto-issue raw materials, record QC (pH, core temperature, micro) and release finished batches with true unit cost.', 'green'],
    ['scan', 'One-click recall trace', 'Follow any lot backward to the raw materials used and forward to every customer invoice that received it — in seconds, not days.', 'violet'],
    ['cart', 'Smart purchasing', 'Reorder suggestions per supplier, purchase orders and goods receipts that capture vendor lot, manufacture and expiry dates.', 'amber'],
    ['receipt', 'Sales, GST & collections', 'Channel pricing, credit limits, automatic batch allocation, GST tax invoices (CGST/SGST/IGST), payments and receivables.', 'red'],
  ];
  const STEPS = [
    ['cart', 'Procure', 'Raise POs from reorder suggestions and receive materials with lot and expiry details.'],
    ['factory', 'Produce', 'Issue ingredients by recipe, run quality checks and release traceable batches.'],
    ['warehouse', 'Store & move', 'Keep stock in cold rooms and hubs, transfer by reefer, monitor temperatures.'],
    ['truck', 'Sell & trace', 'Dispatch earliest-expiry first, invoice with GST, collect payments and handle returns.'],
  ];
  const MODULES = [
    ['dashboard', 'Live dashboard'], ['box', 'Items & catalog'], ['layers', 'Batches & expiry'], ['warehouse', 'Warehouses & cold chain'],
    ['clipboard', 'Stock adjustments'], ['transfer', 'Stock transfers'], ['factory', 'Production orders'], ['flask', 'Recipes (BOM)'],
    ['cart', 'Purchase orders'], ['building', 'Vendors'], ['receipt', 'Sales orders & invoices'], ['users', 'Customers & credit'],
    ['undo', 'Returns & credit notes'], ['chart', '10+ reports & GST'], ['activity', 'Audit log'], ['shield', 'Roles & security'],
  ];
  const INDUSTRIES = ['Tofu & soy foods', 'Plant-based dairy', 'Fresh dairy', 'Bakery & confectionery', 'Ready-to-cook', 'Pickles & preserves', 'Sauces & spreads', 'Frozen foods'];
  const PLANS = [
    ['Starter', '₹4,999', 'For single-plant producers getting off spreadsheets', ['1 plant + 1 warehouse', 'Up to 3 users', 'Batch & expiry tracking', 'Sales & purchase orders', 'Standard reports'], false],
    ['Business', '₹12,999', 'For growing brands with distribution hubs', ['Up to 10 warehouses', 'Up to 10 users & roles', 'Production, recipes & QC', 'Cold-chain monitoring', 'GST invoicing & recall trace', 'Priority support'], true],
    ['Enterprise', 'Custom', 'For multi-plant manufacturers', ['Unlimited sites & users', 'IoT sensor & ERP integrations', 'API access & SSO', 'Dedicated success manager', 'On-premise / private cloud option'], false],
  ];
  const FAQ = [
    ['Is this a live product or a demo?', 'This is an interactive demo workspace. It is pre-loaded with 60 days of realistic operations and every module works end to end. Data you create stays only in your browser.'],
    ['Do I need to sign up?', 'No. Click "Get started" and sign in with one of the demo accounts shown on the sign-in page — Administrator, Inventory Manager or Sales Executive.'],
    ['How is the data secured?', 'Passwords are never stored — only salted PBKDF2 verifiers. All workspace data is compressed and encrypted with AES-256-GCM before it is saved, and each role only sees the modules it is allowed to use.'],
    ['Can it handle short shelf-life products?', 'Yes — it is built for perishables. Shelf life is set per product, expiry is tracked per batch, near-expiry alerts fire automatically and dispatch always follows FEFO.'],
    ['Can I reset the demo?', 'Yes. Inside the app use "Reset demo data" in the top banner to regenerate a fresh dataset at any time.'],
  ];

  function render(root) {
    document.title = 'Invexa · Inventory Cloud for Fresh-Food Manufacturers';
    root.innerHTML = `<div class="lp">
      <header class="lp-nav" id="lp-nav"><div class="lp-wrap lp-nav-in">
        <a class="lp-brand" href="#/">${logo()}<div><div class="brand-name">Invexa</div><div class="brand-sub">Inventory Cloud</div></div></a>
        <nav class="lp-links">${[['features', 'Features'], ['how', 'How it works'], ['modules', 'Modules'], ['security', 'Security'], ['pricing', 'Pricing'], ['faq', 'FAQ']].map(([id, l]) => `<button data-go="${id}">${l}</button>`).join('')}</nav>
        <div class="lp-cta"><a class="btn btn-ghost lp-signin" href="#/login">Sign in</a><a class="btn btn-primary" href="#/signup">Get started ${icon('chevRight', 'sm')}</a></div>
        <button class="lp-burger" id="lp-burger" aria-label="Menu">${icon('menu')}</button>
      </div></header>

      <section class="lp-hero"><div class="lp-wrap lp-hero-in">
        <div class="lp-hero-copy">
          <div class="lp-pill">${icon('sparkles', 'sm')} Inventory cloud for perishable food manufacturers</div>
          <h1>Every batch tracked.<br><span>Nothing wasted.</span><br>Nothing expired on the shelf.</h1>
          <p>Invexa connects procurement, production, cold storage and sales in one platform — with batch & expiry control, FEFO dispatch, cold-chain logs, GST invoicing and one-click recall traceability.</p>
          <div class="lp-hero-btns"><a class="btn btn-primary lp-btn-lg" href="#/signup">${icon('play', 'sm')} Try the live demo</a><a class="btn lp-btn-lg lp-btn-glass" href="#/login">${icon('lock', 'sm')} Sign in</a></div>
          <div class="lp-trust">${[['shield', 'AES-256 encrypted'], ['layers', 'FEFO by default'], ['receipt', 'GST-ready invoicing']].map(([i, t]) => `<span>${icon(i, 'sm')} ${t}</span>`).join('')}</div>
        </div>
        <div class="lp-hero-art">${mock()}</div>
      </div></section>

      <section class="lp-band"><div class="lp-wrap">
        <div class="lp-band-label">Built for fresh & short shelf-life categories</div>
        <div class="lp-chips">${INDUSTRIES.map(i => `<span>${icon('leaf', 'sm')} ${i}</span>`).join('')}</div>
      </div></section>

      <section class="lp-stats"><div class="lp-wrap lp-stats-in">
        ${[['100%', 'batch-level traceability'], ['< 5 sec', 'to trace a recall'], ['FEFO', 'enforced on every dispatch'], ['16', 'connected modules']].map(([v, l]) => `<div><div class="v">${v}</div><div class="l">${l}</div></div>`).join('')}
      </div></section>

      <section class="lp-sec" id="features"><div class="lp-wrap">
        <div class="lp-head"><div class="lp-eyebrow">Features</div><h2>Everything a fresh-food plant needs, in one place</h2><p>Stop juggling spreadsheets, registers and WhatsApp messages. Invexa keeps stock, production and sales in sync automatically.</p></div>
        <div class="lp-grid3">${FEATURES.map(([ic, t, d, tone]) => `<div class="lp-card"><div class="lp-ic ti-${tone}">${icon(ic)}</div><h3>${t}</h3><p>${d}</p></div>`).join('')}</div>
      </div></section>

      <section class="lp-sec lp-alt" id="how"><div class="lp-wrap">
        <div class="lp-head"><div class="lp-eyebrow">How it works</div><h2>From raw material to customer — one connected flow</h2><p>Each step updates the next. Receive soybeans, and production sees them. Release a batch, and sales can sell it. Ship it, and the recall trace is already recorded.</p></div>
        <div class="lp-steps">${STEPS.map(([ic, t, d], i) => `<div class="lp-step"><div class="lp-step-n">${i + 1}</div><div class="lp-ic ti-blue">${icon(ic)}</div><h3>${t}</h3><p>${d}</p></div>`).join('')}</div>
      </div></section>

      <section class="lp-sec" id="modules"><div class="lp-wrap lp-split">
        <div><div class="lp-eyebrow">Modules</div><h2>A complete operations suite</h2><p class="lp-p">Start with inventory and grow into production, purchasing and sales — all modules share the same live data, so numbers always match across teams.</p>
          <div class="lp-roles">${[['Administrator', 'Full control, users & settings', 'violet'], ['Inventory Manager', 'Stores, production & purchasing', 'cyan'], ['Sales Executive', 'Orders, customers & returns', 'blue']].map(([r, d, t]) => `<div class="lp-role"><span class="badge b-${t} plain">${r}</span><span class="muted small">${d}</span></div>`).join('')}</div>
          <a class="btn btn-primary mt-24" href="#/signup">Explore all modules ${icon('chevRight', 'sm')}</a></div>
        <div class="lp-mods">${MODULES.map(([ic, l]) => `<div class="lp-mod">${icon(ic)}<span>${l}</span></div>`).join('')}</div>
      </div></section>

      <section class="lp-sec lp-dark" id="security"><div class="lp-wrap lp-split">
        <div><div class="lp-eyebrow light">Security</div><h2>Your data, locked down by design</h2><p class="lp-p">Enterprise-grade protection from the very first login, with a full audit trail for food-safety and finance audits.</p>
          <a class="btn lp-btn-glass mt-24" href="#/login">${icon('lock', 'sm')} Sign in securely</a></div>
        <div class="lp-sec-grid">${[['key', 'No stored passwords', 'Salted PBKDF2-SHA256 (210,000 iterations) — only a verifier is kept.'], ['lock', 'Encrypted at rest', 'AES-256-GCM encryption of all business data with per-user key wrapping.'], ['users', 'Role-based access', 'Admins, inventory and sales teams each see only what they need.'], ['activity', 'Complete audit log', 'Every create, update and stock movement recorded with user and time.']].map(([ic, t, d]) => `<div class="lp-sec-item"><div class="lp-ic">${icon(ic)}</div><div><b>${t}</b><p>${d}</p></div></div>`).join('')}</div>
      </div></section>

      <section class="lp-sec" id="pricing"><div class="lp-wrap">
        <div class="lp-head"><div class="lp-eyebrow">Pricing</div><h2>Simple plans that grow with you</h2><p>Indicative pricing per workspace, billed annually. All plans include onboarding and data migration.</p></div>
        <div class="lp-grid3 lp-plans">${PLANS.map(([n, pr, d, feats, hot]) => `<div class="lp-plan ${hot ? 'hot' : ''}">${hot ? '<div class="lp-plan-tag">Most popular</div>' : ''}<h3>${n}</h3><div class="lp-price">${pr}${pr.startsWith('₹') ? '<span>/month</span>' : ''}</div><p>${d}</p>
          <ul>${feats.map(f => `<li>${icon('check', 'sm')} ${f}</li>`).join('')}</ul><a class="btn ${hot ? 'btn-primary' : ''} lp-plan-btn" href="#/signup">${pr === 'Custom' ? 'Talk to us' : 'Start free demo'}</a></div>`).join('')}</div>
      </div></section>

      <section class="lp-sec lp-alt" id="faq"><div class="lp-wrap lp-faq-wrap">
        <div class="lp-head"><div class="lp-eyebrow">FAQ</div><h2>Questions, answered</h2></div>
        <div class="lp-faq">${FAQ.map(([q, a], i) => `<details ${i === 0 ? 'open' : ''}><summary>${q}${icon('chevDown', 'sm')}</summary><p>${a}</p></details>`).join('')}</div>
      </div></section>

      <section class="lp-final"><div class="lp-wrap lp-final-in">
        <div><h2>See Invexa with your own eyes</h2><p>Sign in to the live demo — pre-loaded with 60 days of plant, cold-chain and sales activity.</p></div>
        <div class="lp-hero-btns"><a class="btn lp-btn-lg lp-btn-white" href="#/signup">Get started free ${icon('chevRight', 'sm')}</a><a class="btn lp-btn-lg lp-btn-glass" href="#/login">Sign in</a></div>
      </div></section>

      <footer class="lp-foot"><div class="lp-wrap lp-foot-in">
        <a class="lp-brand" href="#/">${logo()}<div><div class="brand-name" style="color:var(--text)">Invexa</div><div class="brand-sub">Inventory Cloud</div></div></a>
        <div class="muted small">© ${new Date().getFullYear()} Invexa · Demo workspace · Data stays encrypted in your browser</div>
        <div class="flex"><a class="small" href="#/login">Sign in</a><a class="small" href="#/signup">Get started</a></div>
      </div></footer>
    </div>`;

    const nav = $('#lp-nav', root);
    $$('[data-go]', root).forEach(b => b.addEventListener('click', () => { nav.classList.remove('open'); document.getElementById(b.dataset.go)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
    $('#lp-burger', root).addEventListener('click', () => nav.classList.toggle('open'));
    const onScroll = () => { if (!document.body.contains(nav)) { window.removeEventListener('scroll', onScroll); return; } nav.classList.toggle('scrolled', window.scrollY > 10); };
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* Product preview built in HTML (crisp at any size, no images) */
  function mock() {
    const bars = [42, 58, 50, 66, 61, 74, 70, 82, 77, 90, 86, 96];
    return `<div class="mk">
      <div class="mk-win">
        <div class="mk-top"><i></i><i></i><i></i><div class="mk-url">${icon('lock', 'sm')} app.invexa.cloud/dashboard</div></div>
        <div class="mk-body">
          <div class="mk-side">${logo('mk-logo')}${['dashboard', 'box', 'layers', 'warehouse', 'factory', 'cart', 'receipt', 'chart'].map((ic, i) => `<div class="mk-nav ${i === 0 ? 'on' : ''}">${icon(ic)}</div>`).join('')}</div>
          <div class="mk-main">
            <div class="mk-kpis">${[['Inventory value', '₹9.4 L', 'blue'], ['Revenue · 30d', '₹45.8 L', 'green'], ['Expiring soon', '3 batches', 'amber']].map(([l, v, t]) => `<div class="mk-kpi"><div class="mk-dot ti-${t}"></div><div class="l">${l}</div><div class="v">${v}</div></div>`).join('')}</div>
            <div class="mk-chart"><div class="mk-ct">Sales vs production</div><div class="mk-bars">${bars.map(h => `<span style="height:${h}%"></span>`).join('')}</div></div>
            <div class="mk-list">${[['TPL2-261113', 'Premium Tofu 200 g', 'Available', 'green'], ['YMG1-261110', 'Plant Yogurt – Mango', 'Expiring', 'amber'], ['CHP2-261112', 'Soya Chaap 250 g', 'Available', 'green']].map(([b, n, s, t]) => `<div class="mk-row"><span class="mono">${b}</span><span class="mk-n">${n}</span><span class="badge b-${t}">${s}</span></div>`).join('')}</div>
          </div>
        </div>
      </div>
      <div class="mk-float f1"><div class="lp-ic ti-green">${icon('thermo')}</div><div><b>Cold Room A · 2.8°C</b><span>Within 0–4°C range</span></div></div>
      <div class="mk-float f2"><div class="lp-ic ti-violet">${icon('scan')}</div><div><b>Recall trace ready</b><span>Lot → 14 customers · 0.4 s</span></div></div>
      <div class="mk-float f3"><div class="lp-ic ti-blue">${icon('truck')}</div><div><b>FEFO dispatch</b><span>Earliest expiry picked first</span></div></div>
    </div>`;
  }

  return { render };
})();
