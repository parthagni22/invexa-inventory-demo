/* ==========================================================================
   Insights: Reports & Audit log
   ========================================================================== */
const REPORTS = [
  { id: 'stock', group: 'Inventory', ic: 'box', name: 'Stock summary', desc: 'Usable stock by item and warehouse' },
  { id: 'valuation', group: 'Inventory', ic: 'database', name: 'Inventory valuation', desc: 'Value by type and category' },
  { id: 'expiry', group: 'Inventory', ic: 'clock', name: 'Expiry & ageing', desc: 'Finished-goods batches by days to expiry' },
  { id: 'wastage', group: 'Inventory', ic: 'trash', name: 'Wastage & write-offs', desc: 'Adjustments, scrapped returns, QC rejects', period: true },
  { id: 'ledger', group: 'Inventory', ic: 'activity', name: 'Stock ledger', desc: 'Every stock movement with references', period: true },
  { id: 'salesProduct', group: 'Sales', ic: 'receipt', name: 'Sales by product', desc: 'Units, discounts and net revenue', period: true },
  { id: 'salesCustomer', group: 'Sales', ic: 'users', name: 'Sales by customer', desc: 'Revenue, collections and outstanding', period: true },
  { id: 'gst', group: 'Sales', ic: 'file', name: 'GST summary (GSTR-1)', desc: 'Outward supplies by HSN & rate', period: true },
  { id: 'yield', group: 'Manufacturing', ic: 'factory', name: 'Production yield', desc: 'Output, rejects and unit cost by product', period: true },
  { id: 'purchase', group: 'Purchases', ic: 'cart', name: 'Purchase register', desc: 'Vendor-wise ordering & delivery performance', period: true },
];

Pages.reports = {
  title: 'Reports',
  current: 'stock',
  days: 30,
  render(el) {
    const self = this;
    const allowed = REPORTS.filter(r => App.user.role !== 'sales' || ['stock', 'expiry', 'salesProduct', 'salesCustomer', 'gst'].includes(r.id));
    if (!allowed.find(r => r.id === self.current)) self.current = allowed[0].id;
    const groups = [...new Set(allowed.map(r => r.group))];
    const rep = REPORTS.find(r => r.id === self.current);
    el.innerHTML = App.head({ title: 'Reports', sub: 'Operational, financial and compliance reports — export any report to CSV' }) +
      `<div class="grid rep-grid" id="rep-grid">
        <div class="card" style="padding:8px">${groups.map(g => `<div class="nav-group" style="color:var(--muted);padding:12px 10px 6px">${g}</div>${allowed.filter(r => r.group === g).map(r => `<div class="cmdk-item ${r.id === self.current ? 'sel' : ''}" data-rep="${r.id}"><div class="dot-ic ti-blue" style="width:30px;height:30px">${icon(r.ic)}</div><div><div class="fw-600" style="font-size:13px">${r.name}</div><div class="small muted">${r.desc}</div></div></div>`).join('')}`).join('')}</div>
        <div><div class="card mb-16"><div class="card-body flex-between" style="flex-wrap:wrap"><div><div class="card-title" style="font-size:17px">${rep.name}</div><div class="card-sub">${rep.desc}${rep.period ? ` · last ${self.days} days` : ` · as of ${fmt.date(Store.today())}`}</div></div>
          ${rep.period ? `<div class="seg" id="per">${[7, 30, 60, 90].map(d => `<button data-d="${d}" class="${self.days === d ? 'active' : ''}">${d}D</button>`).join('')}</div>` : ''}</div>
          <div id="rep-chart"></div></div><div id="rep-tbl"></div></div></div>`;
    $$('[data-rep]', el).forEach(x => x.addEventListener('click', () => { self.current = x.dataset.rep; self.render(el); }));
    $$('#per button', el).forEach(b => b.addEventListener('click', () => { self.days = +b.dataset.d; self.render(el); }));
    const out = self.build(rep.id);
    if (out.chart) {
      $('#rep-chart', el).innerHTML = `<div class="card-body" style="padding-top:0"><div class="chart-box sm"><canvas></canvas></div></div>`;
      UI.chart($('#rep-chart canvas', el), out.chart);
    }
    new UI.DataTable($('#rep-tbl', el), {
      id: 'rep-' + rep.id, exportName: rep.id + '-report', pageSize: 15, rows: out.rows.map((r, i) => ({ id: i, ...r })),
      searchText: r => Object.values(r).join(' '), columns: out.cols,
      emptyTitle: 'No data for this period',
    });
  },
  build(id) {
    const db = Store.db;
    const t = Store.today(), from = Store.addDays(t, -(this.days - 1));
    const money = k => ({ key: k, align: 'right', render: r => fmt.money(r[k]), csv: r => Math.round(r[k] * 100) / 100 });
    const num = (k, label) => ({ key: k, label, align: 'right', render: r => fmt.num(r[k], 2), csv: r => r[k] });
    const palette = ['#2f6fed', '#6a5cff', '#12a46b', '#e98a07', '#0b9bd8', '#e5484d', '#b4235f', '#0f766e', '#94a3b8', '#a16207'];
    const barChart = (labels, data, label, isMoney = true) => ({ type: 'bar', data: { labels, datasets: [{ label, data, backgroundColor: palette.map(c => c + 'cc'), borderRadius: 6, maxBarThickness: 36 }] }, options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + (isMoney ? fmt.money(c.raw) : fmt.num(c.raw)) } } }, scales: { x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 40, font: { size: 10.5 } } }, y: { grid: UI.grid, border: { display: false }, ticks: { callback: v => isMoney ? fmt.compact(v) : fmt.num(v) } } } } });

    if (id === 'stock') {
      const whs = db.warehouses;
      const rows = db.items.map(it => {
        const r = { sku: it.sku, item: it.name, type: Calc.typeLabel(it.type), uom: it.uom, total: Store.stock(it.id), value: Store.stockValue(it.id), status: Calc.stockStatus(it) };
        whs.forEach(w => { r['w_' + w.id] = Store.stock(it.id, w.id); });
        return r;
      });
      return { rows, cols: [{ key: 'sku', label: 'SKU', render: r => `<span class="mono">${esc(r.sku)}</span>` }, { key: 'item', label: 'Item' }, { key: 'type', label: 'Type' }, ...whs.map(w => num('w_' + w.id, w.code)), { key: 'total', label: 'Total', align: 'right', render: r => `<b>${fmt.qty(r.total, r.uom)}</b>`, csv: r => r.total }, { ...money('value'), label: 'Value' }, { key: 'status', label: 'Status', render: r => UI.badge(r.status) }] };
    }
    if (id === 'valuation') {
      const m = {};
      for (const b of db.batches) if (b.qty > 0) { const it = Store.item(b.itemId); const k = it.type + '|' + it.category; const r = (m[k] = m[k] || { type: Calc.typeLabel(it.type), category: it.category, skus: new Set(), batches: 0, value: 0 }); r.skus.add(it.id); r.batches++; r.value += b.qty * b.cost; }
      const total = Object.values(m).reduce((s, r) => s + r.value, 0);
      const rows = Object.values(m).map(r => ({ ...r, skus: r.skus.size, share: r.value / total * 100 })).sort((a, b) => b.value - a.value);
      return { rows, chart: { type: 'doughnut', data: { labels: rows.map(r => r.category), datasets: [{ data: rows.map(r => Math.round(r.value)), backgroundColor: palette, borderColor: '#fff', borderWidth: 2 }] }, options: { cutout: '62%', plugins: { legend: { position: 'right' }, tooltip: { callbacks: { label: c => ` ${c.label}: ${fmt.money(c.raw)}` } } } } },
        cols: [{ key: 'type', label: 'Type' }, { key: 'category', label: 'Category' }, num('skus', 'SKUs'), num('batches', 'Batches'), { ...money('value'), label: 'Value' }, { key: 'share', label: '% of total', align: 'right', render: r => fmt.pct(r.share), csv: r => r.share.toFixed(2) }] };
    }
    if (id === 'expiry') {
      const bucket = d => d < 0 ? 'Expired' : d <= 3 ? '0–3 days' : d <= 7 ? '4–7 days' : d <= 15 ? '8–15 days' : d <= 30 ? '16–30 days' : '30+ days';
      const rows = db.batches.filter(b => b.qty > 0 && b.exp && Store.item(b.itemId).type === 'finished').map(b => { const d = Store.daysBetween(t, b.exp); return { batch: b.batchNo, item: Store.item(b.itemId).name, wh: Calc.whCode(b.whId), exp: b.exp, days: d, qty: b.qty, value: b.qty * b.cost, bucket: bucket(d) }; }).sort((a, b) => a.days - b.days);
      const order = ['Expired', '0–3 days', '4–7 days', '8–15 days', '16–30 days', '30+ days'];
      const agg = order.map(o => rows.filter(r => r.bucket === o).reduce((s, r) => s + r.value, 0));
      return { rows, chart: barChart(order, agg.map(Math.round), 'Value'), cols: [{ key: 'batch', label: 'Batch', render: r => `<span class="mono">${esc(r.batch)}</span>` }, { key: 'item', label: 'Item' }, { key: 'wh', label: 'WH' }, { key: 'exp', label: 'Expiry', render: r => fmt.date(r.exp) }, { key: 'days', label: 'Days left', align: 'right', render: r => `<b class="${r.days < 0 ? 'text-danger' : r.days <= 3 ? 'text-warning' : ''}">${r.days}</b>` }, num('qty', 'Qty'), { ...money('value'), label: 'Value' }, { key: 'bucket', label: 'Bucket', render: r => UI.badge(r.bucket, r.days < 0 ? 'red' : r.days <= 7 ? 'amber' : 'green') }] };
    }
    if (id === 'wastage') {
      const rows = [];
      db.adjustments.filter(a => a.date >= from).forEach(a => a.lines.filter(l => l.qty < 0).forEach(l => rows.push({ date: a.date, source: 'Adjustment', reason: a.type, ref: a.no, item: Store.item(l.itemId)?.name, qty: -l.qty, value: -l.qty * l.cost })));
      db.returns.filter(r => r.date >= from).forEach(r => r.lines.filter(l => l.action === 'Scrap').forEach(l => rows.push({ date: r.date, source: 'Return', reason: r.reason, ref: r.no, item: Store.item(l.itemId)?.name, qty: l.qty, value: l.qty * (Store.byId('batches', l.batchId)?.cost || 0) })));
      db.productions.filter(m => m.status === 'Completed' && m.rejected && Store.isoOf(m.completedAt) >= from).forEach(m => rows.push({ date: Store.isoOf(m.completedAt), source: 'Production', reason: 'QC rejection', ref: m.no, item: Store.item(m.itemId)?.name, qty: m.rejected, value: m.rejected * m.unitCost }));
      rows.sort((a, b) => b.date.localeCompare(a.date));
      const by = {};
      rows.forEach(r => { by[r.reason] = (by[r.reason] || 0) + r.value; });
      const ent = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 10);
      return { rows, chart: barChart(ent.map(e => e[0]), ent.map(e => Math.round(e[1])), 'Value'), cols: [{ key: 'date', label: 'Date', render: r => fmt.date(r.date) }, { key: 'source', label: 'Source', render: r => UI.badge(r.source, 'gray') }, { key: 'reason', label: 'Reason' }, { key: 'ref', label: 'Ref', render: r => `<span class="mono">${esc(r.ref)}</span>` }, { key: 'item', label: 'Item' }, num('qty', 'Qty'), { ...money('value'), label: 'Loss value' }] };
    }
    if (id === 'ledger') {
      const fromTs = new Date(from + 'T00:00:00').getTime();
      const rows = db.movements.filter(m => m.ts >= fromTs).slice().reverse().map(m => ({ ts: m.ts, type: Calc.moveLabel(m.type), item: Store.item(m.itemId)?.name, batch: m.batchNo, wh: Calc.whCode(m.whId), qty: m.qty, value: m.qty * m.cost, ref: m.ref || '' }));
      return { rows, cols: [{ key: 'ts', label: 'When', render: r => fmt.dt(r.ts), csv: r => new Date(r.ts).toISOString() }, { key: 'type', label: 'Movement' }, { key: 'item', label: 'Item' }, { key: 'batch', label: 'Batch', render: r => `<span class="mono">${esc(r.batch)}</span>` }, { key: 'wh', label: 'WH' }, { key: 'qty', label: 'Qty', align: 'right', render: r => `<b class="${r.qty < 0 ? 'text-danger' : 'text-success'}">${r.qty > 0 ? '+' : ''}${fmt.num(r.qty, 3)}</b>`, csv: r => r.qty }, { ...money('value'), label: 'Value' }, { key: 'ref', label: 'Reference', render: r => `<span class="mono">${esc(r.ref)}</span>` }] };
    }
    if (id === 'salesProduct') {
      const m = {};
      for (const s of Calc.salesInRange(from, t)) for (const l of s.lines) {
        const r = (m[l.itemId] = m[l.itemId] || { item: Store.item(l.itemId)?.name, cat: Store.item(l.itemId)?.category, units: 0, gross: 0, disc: 0, net: 0, gst: 0, orders: 0 });
        const g = l.qty * l.rate, d = g * (l.disc || 0) / 100;
        r.units += l.qty; r.gross += g; r.disc += d; r.net += g - d; r.gst += (g - d) * l.gst / 100; r.orders++;
      }
      const tot = Object.values(m).reduce((s, r) => s + r.net, 0);
      const rows = Object.values(m).map(r => ({ ...r, share: r.net / (tot || 1) * 100 })).sort((a, b) => b.net - a.net);
      return { rows, chart: barChart(rows.slice(0, 12).map(r => r.item.replace(/ \d+ ?g$| \d+ ?L$/, '')), rows.slice(0, 12).map(r => Math.round(r.net)), 'Net revenue'),
        cols: [{ key: 'item', label: 'Product' }, { key: 'cat', label: 'Category' }, num('orders', 'Order lines'), num('units', 'Units'), { ...money('gross'), label: 'Gross' }, { ...money('disc'), label: 'Discount' }, { ...money('net'), label: 'Net revenue' }, { ...money('gst'), label: 'GST' }, { key: 'share', label: 'Share', align: 'right', render: r => fmt.pct(r.share), csv: r => r.share.toFixed(2) }] };
    }
    if (id === 'salesCustomer') {
      const m = {};
      for (const s of Calc.salesInRange(from, t)) {
        const c = Store.customer(s.customerId); const tt = Store.soTotals(s);
        const r = (m[c.id] = m[c.id] || { cust: c.name, type: c.type, city: c.city, orders: 0, net: 0, total: 0, paid: 0, due: 0 });
        r.orders++; r.net += tt.sub - tt.disc; r.total += tt.total; r.paid += tt.paid; r.due += tt.due;
      }
      const rows = Object.values(m).sort((a, b) => b.net - a.net);
      return { rows, chart: barChart(rows.slice(0, 10).map(r => r.cust.split(' ').slice(0, 2).join(' ')), rows.slice(0, 10).map(r => Math.round(r.net)), 'Net revenue'),
        cols: [{ key: 'cust', label: 'Customer' }, { key: 'type', label: 'Channel', render: r => UI.badge(r.type) }, { key: 'city', label: 'City' }, num('orders', 'Invoices'), { ...money('net'), label: 'Net sales' }, { ...money('total'), label: 'Invoiced (incl. GST)' }, { ...money('paid'), label: 'Collected' }, { key: 'due', label: 'Outstanding', align: 'right', render: r => `<span class="${r.due > 0.5 ? 'text-danger fw-600' : 'muted'}">${fmt.money(r.due)}</span>`, csv: r => r.due.toFixed(2) }] };
    }
    if (id === 'gst') {
      const m = {};
      for (const s of Calc.salesInRange(from, t)) {
        const c = Store.customer(s.customerId); const intra = (c.state || 'Maharashtra') === db.company.state;
        for (const l of s.lines) {
          const it = Store.item(l.itemId); const k = `${it.hsn}|${l.gst}`;
          const tx = l.qty * l.rate * (1 - (l.disc || 0) / 100), tax = tx * l.gst / 100;
          const r = (m[k] = m[k] || { hsn: it.hsn, rate: l.gst, qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, b2b: 0, b2c: 0 });
          r.qty += l.qty; r.taxable += tx;
          if (intra) { r.cgst += tax / 2; r.sgst += tax / 2; } else r.igst += tax;
          if (c.gstin) r.b2b += tx; else r.b2c += tx;
        }
      }
      const rows = Object.values(m).map(r => ({ ...r, tax: r.cgst + r.sgst + r.igst }));
      return { rows, cols: [{ key: 'hsn', label: 'HSN', render: r => `<span class="mono">${esc(r.hsn)}</span>` }, { key: 'rate', label: 'GST rate', render: r => r.rate + '%' }, num('qty', 'Qty'), { ...money('b2b'), label: 'B2B taxable' }, { ...money('b2c'), label: 'B2C taxable' }, { ...money('taxable'), label: 'Total taxable' }, { ...money('cgst'), label: 'CGST' }, { ...money('sgst'), label: 'SGST' }, { ...money('igst'), label: 'IGST' }, { ...money('tax'), label: 'Total tax' }] };
    }
    if (id === 'yield') {
      const m = {};
      for (const mo of db.productions.filter(x => x.status === 'Completed' && Store.isoOf(x.completedAt) >= from)) {
        const it = Store.item(mo.itemId);
        const r = (m[it.id] = m[it.id] || { item: it.name, runs: 0, planned: 0, good: 0, rej: 0, cost: 0, kg: 0 });
        r.runs++; r.planned += mo.qty; r.good += mo.good; r.rej += mo.rejected; r.cost += mo.good * mo.unitCost; r.kg += mo.good * (it.weightKg || 0);
      }
      const rows = Object.values(m).map(r => ({ ...r, yield: r.good / Math.max(1, r.good + r.rej) * 100, unit: r.cost / Math.max(1, r.good) })).sort((a, b) => b.kg - a.kg);
      return { rows, chart: barChart(rows.map(r => r.item.replace(/ \d+ ?g$/, '')), rows.map(r => Math.round(r.kg)), 'Output kg', false),
        cols: [{ key: 'item', label: 'Product' }, num('runs', 'Batches'), num('planned', 'Planned'), num('good', 'Good'), num('rej', 'Rejected'), { key: 'yield', label: 'Yield', align: 'right', render: r => `<b class="${r.yield < 98 ? 'text-warning' : 'text-success'}">${fmt.pct(r.yield, 2)}</b>`, csv: r => r.yield.toFixed(2) }, num('kg', 'Output kg'), { key: 'unit', label: 'Avg unit cost', align: 'right', render: r => fmt.money(r.unit, 2), csv: r => r.unit.toFixed(2) }] };
    }
    if (id === 'purchase') {
      const m = {};
      for (const p of db.purchaseOrders.filter(x => x.date >= from && x.status !== 'Cancelled')) {
        const v = Store.vendor(p.vendorId); const tt = Store.poTotals(p);
        const r = (m[v.id] = m[v.id] || { vendor: v.name, cat: v.category, pos: 0, ordered: 0, received: 0, done: 0, ontime: 0 });
        r.pos++; r.ordered += tt.total;
        r.received += p.lines.reduce((s, l) => s + (l.received || 0) * l.rate * (1 + l.gst / 100), 0);
        if (p.receivedAt) { r.done++; if (Store.isoOf(p.receivedAt) <= p.expected) r.ontime++; }
      }
      const rows = Object.values(m).map(r => ({ ...r, otd: r.done ? r.ontime / r.done * 100 : null })).sort((a, b) => b.ordered - a.ordered);
      return { rows, chart: barChart(rows.map(r => r.vendor.split(' ').slice(0, 2).join(' ')), rows.map(r => Math.round(r.ordered)), 'Ordered'),
        cols: [{ key: 'vendor', label: 'Vendor' }, { key: 'cat', label: 'Category' }, num('pos', 'POs'), { ...money('ordered'), label: 'Ordered (incl. GST)' }, { ...money('received'), label: 'Received' }, { key: 'otd', label: 'On-time delivery', align: 'right', render: r => r.otd === null ? '—' : `<b class="${r.otd < 90 ? 'text-warning' : 'text-success'}">${fmt.pct(r.otd, 0)}</b>`, csv: r => r.otd === null ? '' : r.otd.toFixed(0) }] };
    }
    return { rows: [], cols: [] };
  },
};

Pages.activity = {
  title: 'Audit Log',
  render(el) {
    const db = Store.db;
    el.innerHTML = App.head({ title: 'Audit Log', sub: 'Tamper-evident trail of every create, update and stock-affecting action (latest 600 events)' }) + '<div id="tbl"></div>';
    const tone = a => /Deleted|Cancelled|Excursion|Write|Signed out/.test(a) ? 'red' : /Created|Completed|Received|Delivered|Payment|Signed in/.test(a) ? 'green' : /Dispatched|Issued|Started/.test(a) ? 'violet' : 'blue';
    new UI.DataTable($('#tbl', el), {
      id: 'activity', exportName: 'audit-log', pageSize: 20, rows: () => db.activity,
      searchText: a => `${a.user} ${a.action} ${a.entity} ${a.ref} ${a.detail}`,
      filters: [
        { key: 'u', label: 'All users', options: [...new Set(db.activity.map(a => a.user))].sort(), test: (r, v) => r.user === v },
        { key: 'e', label: 'All entities', options: [...new Set(db.activity.map(a => a.entity))].sort(), test: (r, v) => r.entity === v },
      ],
      columns: [
        { key: 'ts', label: 'Timestamp', render: a => `${fmt.dt(a.ts)}<div class="cell-sub">${fmt.rel(a.ts)}</div>`, csv: a => new Date(a.ts).toISOString() },
        { key: 'user', label: 'User', render: a => `<div class="item-cell">${UI.avatar(a.user, 28)}<span>${esc(a.user)}</span></div>` },
        { key: 'action', label: 'Action', render: a => UI.badge(a.action, tone(a.action)) },
        { key: 'entity', label: 'Entity' },
        { key: 'ref', label: 'Reference', render: a => `<span class="mono">${esc(a.ref || '')}</span>` },
        { key: 'detail', label: 'Details', render: a => `<span class="muted">${esc(a.detail || '')}</span>` },
      ],
    });
  },
};
