/* ==========================================================================
   Purchases: Purchase Orders, Goods Receipt, Vendors
   ========================================================================== */
Pages.purchases = {
  title: 'Purchase Orders',
  render(el, params) {
    const db = Store.db;
    const self = this;
    const t = Store.today();
    const open = db.purchaseOrders.filter(p => ['Issued', 'Partially Received'].includes(p.status));
    const overdue = open.filter(p => p.expected < t);
    const monthStart = t.slice(0, 8) + '01';
    const recvMonth = db.purchaseOrders.flatMap(p => p.grns.filter(g => g.date >= monthStart).map(g => g.lines.reduce((s, l) => s + l.qty * (p.lines.find(x => x.itemId === l.itemId)?.rate || 0), 0))).reduce((s, x) => s + x, 0);
    const payable = db.purchaseOrders.filter(p => ['Received', 'Partially Received'].includes(p.status) && p.billStatus !== 'Paid').reduce((s, p) => s + Store.poTotals(p).total, 0);
    const pct = p => { const o = p.lines.reduce((s, l) => s + l.qty, 0); return o ? p.lines.reduce((s, l) => s + Math.min(l.qty, l.received || 0), 0) / o * 100 : 0; };
    el.innerHTML = App.head({
      title: 'Purchase Orders', sub: 'Procure raw materials & packaging, receive goods with vendor lot and expiry capture',
      actions: `${App.sampleBtn('Generate sample POs')}<button class="btn" data-suggest>${icon('zap', 'sm')} Reorder suggestions</button><button class="btn btn-primary" data-new>${icon('plus', 'sm')} New purchase order</button>`,
    }) + `<div class="grid grid-4 mb-16">
        ${UI.kpi({ label: 'Open purchase orders', value: open.length, ic: 'cart', tone: 'blue', foot: `${fmt.compact(open.reduce((s, p) => s + Store.poTotals(p).total, 0))} on order` })}
        ${UI.kpi({ label: 'Overdue deliveries', value: overdue.length, ic: 'clock', tone: overdue.length ? 'red' : 'green', foot: overdue.length ? 'Follow up with vendors' : 'All on schedule' })}
        ${UI.kpi({ label: 'Received this month', value: fmt.compact(recvMonth), ic: 'download', tone: 'green', foot: 'Goods receipt value (ex-GST)' })}
        ${UI.kpi({ label: 'Vendor payables', value: fmt.compact(payable), ic: 'wallet', tone: 'amber', foot: 'Received, bill unpaid' })}
      </div><div id="tbl"></div>`;
    App.bindSample(el, () => Seed.Sample.purchaseOrders(2));
    $('[data-new]', el).addEventListener('click', () => self.create());
    $('[data-suggest]', el).addEventListener('click', () => self.suggest());
    new UI.DataTable($('#tbl', el), {
      id: 'purchases', exportName: 'purchase-orders', rows: () => db.purchaseOrders,
      searchText: p => `${p.no} ${Store.vendor(p.vendorId)?.name} ${p.status} ${p.lines.map(l => Store.item(l.itemId)?.name).join(' ')}`,
      filters: [
        { key: 'st', label: 'All statuses', value: params.f || '', options: ['Draft', 'Issued', 'Partially Received', 'Received', 'Cancelled'], test: (r, v) => r.status === v },
        { key: 've', label: 'All vendors', options: db.vendors, test: (r, v) => r.vendorId === v },
      ],
      onRow: p => self.open(p.id),
      columns: [
        { key: 'no', label: 'PO #', render: p => `<span class="mono fw-600">${p.no}</span>` },
        { key: 'date', label: 'Date', render: p => fmt.date(p.date) },
        { key: 'vendor', label: 'Vendor', sort: p => Store.vendor(p.vendorId)?.name, render: p => `<div class="cell-main">${esc(Store.vendor(p.vendorId)?.name)}</div><div class="cell-sub">${p.lines.length} item(s)</div>` },
        { key: 'expected', label: 'Expected', render: p => `<span class="${['Issued', 'Partially Received'].includes(p.status) && p.expected < t ? 'text-danger fw-600' : ''}">${fmt.date(p.expected)}</span>` },
        { key: 'amount', label: 'Amount', align: 'right', sort: p => Store.poTotals(p).total, render: p => `<b>${fmt.money(Store.poTotals(p).total)}</b>` },
        { key: 'recv', label: 'Received', sort: pct, render: p => `<div style="width:110px">${UI.progress(pct(p), pct(p) >= 100 ? 'green' : '')}<div class="small muted mt-8" style="margin-top:3px">${pct(p).toFixed(0)}%</div></div>`, csv: p => pct(p).toFixed(0) + '%' },
        { key: 'status', label: 'Status', render: p => UI.badge(p.status) },
        { key: 'bill', label: 'Bill', sort: p => p.billStatus || '', render: p => ['Received', 'Partially Received'].includes(p.status) ? UI.badge(p.billStatus === 'Paid' ? 'Paid' : 'Unpaid') : '<span class="muted">—</span>' },
      ],
    });
    if (params.id) self.open(params.id);
  },
  open(id) {
    const p = Store.byId('purchaseOrders', id); if (!p) return;
    const v = Store.vendor(p.vendorId);
    const tt = Store.poTotals(p);
    const self = this;
    UI.drawer({
      title: p.no, badge: UI.badge(p.status), sub: `${esc(v?.name)} · ordered ${fmt.date(p.date)} · expected ${fmt.date(p.expected)}`,
      body: `<div class="stat-strip">${UI.stat('Sub-total', fmt.money(tt.sub))}${UI.stat('GST', fmt.money(tt.tax))}${UI.stat('Total', fmt.money(tt.total))}${UI.stat('Bill', p.billStatus === 'Paid' ? '<span class="text-success">Paid</span>' : 'Unpaid')}</div>
        <dl class="dl mt-16"><dt>Vendor</dt><dd><a href="#/vendors?id=${v?.id}">${esc(v?.name)}</a> · ${esc(v?.city)} · ${esc(v?.paymentTerms || '')}</dd><dt>Deliver to</dt><dd>${esc(Calc.whName(p.whId))}</dd><dt>Created by</dt><dd>${esc(p.createdBy || '—')} · ${fmt.dt(p.createdAt)}</dd>${p.notes ? `<dt>Notes</dt><dd>${esc(p.notes)}</dd>` : ''}</dl>
        <div class="section-title">Lines</div><table class="tbl compact"><thead><tr><th>Item</th><th class="right">Ordered</th><th class="right">Received</th><th class="right">Rate</th><th class="right">Amount</th></tr></thead><tbody>
        ${p.lines.map(l => { const it = Store.item(l.itemId); return `<tr><td>${esc(it?.name)}<div class="cell-sub">GST ${l.gst}%</div></td><td class="right">${fmt.qty(l.qty, it?.uom)}</td><td class="right ${l.received >= l.qty ? 'text-success' : ''}">${fmt.qty(l.received || 0)}</td><td class="right">${fmt.money(l.rate, 2)}</td><td class="right fw-600">${fmt.money(l.qty * l.rate)}</td></tr>`; }).join('')}</tbody></table>
        ${p.grns.length ? `<div class="section-title">Goods receipts</div>${p.grns.map(g => `<div class="card" style="padding:12px 14px;margin-bottom:8px"><div class="flex-between"><b class="mono">${g.no}</b><span class="small muted">${fmt.date(g.date)} · ${esc(g.by || '')}</span></div>
          <div class="flex mt-8" style="flex-wrap:wrap;gap:6px">${g.lines.map(l => `<a class="chip" href="#/batches?id=${l.batchId}"><span class="mono">${esc(l.batchNo)}</span> · ${esc(Store.item(l.itemId)?.name.split(' ').slice(0, 3).join(' '))} × ${fmt.qty(l.qty)}</a>`).join('')}</div></div>`).join('')}` : ''}`,
      foot: `${['Draft', 'Issued'].includes(p.status) ? `<button class="btn btn-danger" data-cancel>${icon('x', 'sm')} Cancel</button>` : ''}<button class="btn" data-print>${icon('printer', 'sm')} Print</button><div class="grow"></div>
        ${p.status === 'Draft' ? `<button class="btn" data-edit>${icon('edit', 'sm')} Edit</button><button class="btn btn-primary" data-issue>${icon('check', 'sm')} Issue to vendor</button>` : ''}
        ${['Issued', 'Partially Received'].includes(p.status) ? `<button class="btn btn-success" data-recv>${icon('download', 'sm')} Receive goods</button>` : ''}
        ${['Received', 'Partially Received'].includes(p.status) && p.billStatus !== 'Paid' ? `<button class="btn btn-primary" data-paid>${icon('wallet', 'sm')} Mark bill paid</button>` : ''}`,
      onMount(dr, close) {
        $('[data-issue]', dr)?.addEventListener('click', () => { if (UI.act(() => { Store.issuePO(id); return true; }, 'PO issued to vendor')) self.open(id); });
        $('[data-edit]', dr)?.addEventListener('click', () => { close(); self.create(p); });
        $('[data-recv]', dr)?.addEventListener('click', () => self.receive(id));
        $('[data-paid]', dr)?.addEventListener('click', () => { if (UI.act(() => { Store.markPOBilled(id); return true; }, 'Vendor bill marked paid')) self.open(id); });
        $('[data-print]', dr).addEventListener('click', () => self.print(p));
        $('[data-cancel]', dr)?.addEventListener('click', async () => {
          if (!(await UI.confirm({ title: 'Cancel purchase order?', message: `${p.no} will be cancelled.`, okText: 'Cancel PO', danger: true }))) return;
          if (UI.act(() => { Store.cancelPO(id); return true; }, 'PO cancelled')) close();
        });
      },
    });
  },
  print(p) {
    const v = Store.vendor(p.vendorId), w = Store.wh(p.whId), t = Store.poTotals(p);
    printDocument({
      title: 'Purchase Order', no: p.no, date: p.date, meta: [`Expected: ${fmt.date(p.expected)}`, `Terms: ${esc(v.paymentTerms || '')}`],
      partyLabel: 'Vendor', party: `<b>${esc(v.name)}</b><div class="small">${esc(v.city)}, ${esc(v.state)}</div><div class="small">GSTIN ${esc(v.gstin)}</div><div class="small">${esc(v.contact)} · ${esc(v.phone)}</div>`,
      shipLabel: 'Deliver to', ship: `<b>${esc(w.name)}</b><div class="small">${esc(w.address || w.city)}</div>`,
      head: [{ l: '#' }, { l: 'Item' }, { l: 'Qty', r: 1 }, { l: 'Rate', r: 1 }, { l: 'GST', r: 1 }, { l: 'Amount', r: 1 }],
      rows: p.lines.map((l, i) => { const it = Store.item(l.itemId); return [i + 1, `${esc(it.name)}<div class="small muted">${esc(it.sku)}</div>`, fmt.qty(l.qty, it.uom), fmt.money(l.rate, 2), l.gst + '%', fmt.money(l.qty * l.rate, 2)]; }),
      totals: [['Sub-total', fmt.money(t.sub, 2)], ['GST', fmt.money(t.tax, 2)], ['Total', fmt.money(t.total, 2), 1]],
      notes: 'Please quote the PO number on all invoices and delivery challans. Food-grade materials must be accompanied by a Certificate of Analysis (CoA) and batch/lot number with manufacturing & expiry dates.',
    });
  },
  receive(id) {
    const p = Store.byId('purchaseOrders', id);
    const db = Store.db;
    const coldWh = db.warehouses.find(w => w.isPlant && w.type === 'Cold Storage');
    const rows = p.lines.map((l, idx) => ({ l, idx, open: Store.round(l.qty - (l.received || 0)) })).filter(x => x.open > 0);
    UI.formModal({
      title: `Receive goods · ${p.no}`, size: 'xl', submitText: 'Post goods receipt', submitIcon: 'download',
      body: `<div class="alert info">${icon('info', 'sm')}<div>Capture the vendor lot, manufacturing and expiry dates printed on the material — this is what makes recall tracing possible. Chilled items default to the cold room.</div></div>
        <div class="lines mt-16"><table><thead><tr><th>Item</th><th class="right" style="width:90px">Open</th><th style="width:110px">Receive qty</th><th style="width:140px">Vendor lot #</th><th style="width:140px">Mfg date</th><th style="width:140px">Expiry</th><th style="width:190px">Store in</th></tr></thead><tbody>
        ${rows.map(({ l, idx, open }) => { const it = Store.item(l.itemId); const wh = it.cold && coldWh ? coldWh.id : p.whId; return `<tr data-idx="${idx}"><td><b>${esc(it.name)}</b><div class="cell-sub">${esc(it.storage)} · ${it.shelfLife}d shelf life</div></td><td class="right">${fmt.qty(open, it.uom)}</td>
          <td><input class="input sm right" type="number" step="any" min="0" data-r="qty" value="${open}"></td><td><input class="input sm" data-r="lot" value="V${Store.today().slice(2).replace(/-/g, '')}${Math.floor(Math.random() * 90 + 10)}"></td>
          <td><input class="input sm" type="date" data-r="mfg" value="${Store.today()}"></td><td><input class="input sm" type="date" data-r="exp" value="${it.shelfLife ? Store.addDays(Store.today(), it.shelfLife) : ''}"></td>
          <td><select class="input sm" data-r="whId">${UI.options(db.warehouses, wh)}</select></td></tr>`; }).join('')}
        </tbody></table></div>`,
      onMount(m) {
        $$('[data-r=mfg]', m).forEach(inp => inp.addEventListener('change', () => { const tr = inp.closest('tr'); const it = Store.item(p.lines[+tr.dataset.idx].itemId); if (it.shelfLife) $('[data-r=exp]', tr).value = Store.addDays(inp.value, it.shelfLife); }));
      },
      onSubmit(form, close) {
        const receipts = $$('tr[data-idx]', form).map(tr => ({ idx: +tr.dataset.idx, qty: parseFloat($('[data-r=qty]', tr).value) || 0, lot: $('[data-r=lot]', tr).value.trim(), mfg: $('[data-r=mfg]', tr).value, exp: $('[data-r=exp]', tr).value || null, whId: $('[data-r=whId]', tr).value }));
        for (const r of receipts) if (r.qty > 0 && r.exp && r.exp <= Store.today()) throw new Error('Cannot receive material that is already expired');
        const g = Store.receivePO(id, receipts);
        close(); UI.toast(`${g.no} posted — ${g.lines.length} batch(es) created`); App.refresh(); Pages.purchases.open(id);
      },
    });
  },
  suggest() {
    const db = Store.db;
    const rows = db.items.filter(i => i.type !== 'finished' && i.active && i.reorderLevel && Store.stock(i.id) + Store.onOrder(i.id) < i.reorderLevel);
    const byV = {};
    rows.forEach(i => { (byV[i.vendorId || 'none'] = byV[i.vendorId || 'none'] || []).push(i); });
    UI.modal({
      title: 'Reorder suggestions', size: 'lg',
      body: rows.length ? `<p class="muted" style="margin-top:0">Items where <b>stock + on order</b> is below the reorder level, grouped by preferred vendor.</p>
        ${Object.entries(byV).map(([vid, list]) => `<div class="card" style="margin-bottom:12px"><div class="card-head" style="padding-bottom:10px"><div class="card-title">${esc(Store.vendor(vid)?.name || 'No preferred vendor')}</div>${vid !== 'none' ? `<button class="btn btn-sm btn-primary" data-mk="${vid}">${icon('cart', 'sm')} Create PO</button>` : ''}</div>
          <table class="tbl compact"><thead><tr><th>Item</th><th class="right">On hand</th><th class="right">On order</th><th class="right">Reorder at</th><th class="right">Suggest</th></tr></thead><tbody>${list.map(i => `<tr><td>${esc(i.name)}</td><td class="right">${fmt.qty(Store.stock(i.id), i.uom)}</td><td class="right">${fmt.qty(Store.onOrder(i.id))}</td><td class="right">${fmt.qty(i.reorderLevel)}</td><td class="right fw-600">${fmt.qty(i.orderQty || i.reorderLevel * 2, i.uom)}</td></tr>`).join('')}</tbody></table></div>`).join('')}`
        : UI.empty('checkCircle', 'Nothing to reorder', 'All raw materials and packaging are above reorder levels (including open POs).'),
      onMount(m, close) {
        $$('[data-mk]', m).forEach(b => b.addEventListener('click', () => {
          close();
          Pages.purchases.create({ vendorId: b.dataset.mk, lines: byV[b.dataset.mk].map(i => ({ itemId: i.id, qty: i.orderQty || i.reorderLevel * 2, rate: i.cost, gst: i.gst })) });
        }));
      },
    });
  },
  create(pre = null) {
    const db = Store.db;
    const editing = pre && pre.id;
    const dry = db.warehouses.find(w => w.type === 'Dry Store') || db.warehouses[0];
    const state = { lines: pre?.lines ? pre.lines.map(l => ({ ...l })) : [{ itemId: '', qty: 0, rate: 0, gst: 5 }] };
    const items = db.items.filter(i => i.type !== 'finished' && i.active);
    let form;
    const totals = () => {
      const t = Store.poTotals({ lines: state.lines.filter(l => l.itemId) });
      $('#po-tot').innerHTML = `<div class="totals"><div class="r"><span>Sub-total</span><span>${fmt.money(t.sub, 2)}</span></div><div class="r"><span>GST</span><span>${fmt.money(t.tax, 2)}</span></div><div class="r big"><span>Total</span><span>${fmt.money(t.total, 2)}</span></div></div>`;
    };
    let editor;
    UI.formModal({
      title: editing ? `Edit ${pre.no}` : 'New purchase order', size: 'xl', submitText: editing ? 'Save PO' : 'Create PO',
      body: `<div class="form-grid-3">
          ${UI.field('Vendor', UI.select('vendorId', UI.options(db.vendors.filter(v => v.active !== false), pre?.vendorId, { placeholder: 'Select vendor…' })), { req: true })}
          ${UI.field('Order date', UI.input('date', pre?.date || Store.today(), { type: 'date' }))}
          ${UI.field('Expected delivery', UI.input('expected', pre?.expected || Store.addDays(Store.today(), 3), { type: 'date' }))}
          ${UI.field('Deliver to', UI.select('whId', UI.options(db.warehouses, pre?.whId || dry.id)))}
          ${UI.field('Notes', UI.input('notes', pre?.notes || ''), {})}
          ${editing ? '<div></div>' : UI.field('&nbsp;', `<label class="flex" style="height:38px"><input type="checkbox" name="issue" checked> Issue to vendor now</label>`)}
        </div>
        <div class="flex-between"><div class="section-title">Items</div><button type="button" class="btn btn-sm btn-magic" data-fill>${icon('zap', 'sm')} Add this vendor's reorder items</button></div>
        <div id="lines"></div><div id="po-tot"></div>`,
      onMount(m, close, f) {
        form = f;
        editor = UI.lineEditor($('#lines', m), {
          lines: state.lines, blank: () => ({ itemId: '', qty: 0, rate: 0, gst: 5 }), addLabel: 'Add item', onChange: totals,
          columns: [
            { key: 'itemId', label: 'Item', type: 'select', options: l => UI.options(items, l.itemId, { placeholder: 'Select item…', label: i => `${i.name} (${i.uom})` }), rerender: true, onSet: (l, v) => { const it = Store.item(v); if (it) { l.rate = it.cost; l.gst = it.gst; l.qty = l.qty || it.orderQty || 0; } } },
            { key: 'stock', label: 'In stock', width: '100px', align: 'right', render: l => l.itemId ? fmt.qty(Store.stock(l.itemId)) : '—' },
            { key: 'qty', label: 'Qty', type: 'number', width: '110px', min: 0 },
            { key: 'rate', label: 'Rate (₹)', type: 'number', width: '110px', step: '0.01' },
            { key: 'gst', label: 'GST %', type: 'number', width: '80px' },
            { key: 'amt', label: 'Amount', width: '120px', align: 'right', render: l => fmt.money((l.qty || 0) * (l.rate || 0), 2) },
          ],
        });
        totals();
        f.vendorId.addEventListener('change', () => { const v = Store.vendor(f.vendorId.value); if (v) f.expected.value = Store.addDays(f.date.value, v.leadDays || 3); });
        $('[data-fill]', m).addEventListener('click', () => {
          const vid = f.vendorId.value; if (!vid) { UI.toast('Select a vendor first', 'warning'); return; }
          const add = db.items.filter(i => i.vendorId === vid && i.reorderLevel && Store.stock(i.id) + Store.onOrder(i.id) < i.reorderLevel && !state.lines.some(l => l.itemId === i.id));
          if (!add.length) { UI.toast('No items below reorder level for this vendor', 'info'); return; }
          const clean = state.lines.filter(l => l.itemId);
          state.lines.splice(0, state.lines.length, ...clean, ...add.map(i => ({ itemId: i.id, qty: i.orderQty || i.reorderLevel * 2, rate: i.cost, gst: i.gst })));
          editor.render(); totals();
        });
      },
      onSubmit(f, close) {
        const d = UI.formData(f);
        const issue = d.issue; delete d.issue;
        const po = Store.savePO({ ...(editing ? { id: pre.id } : {}), ...d, lines: state.lines });
        if (!editing && issue) Store.issuePO(po.id);
        close(); UI.toast(`${po.no} ${editing ? 'saved' : issue ? 'created & issued' : 'saved as draft'}`); App.refresh(); Pages.purchases.open(po.id);
      },
    });
  },
};

/* ---------------- Vendors ---------------- */
Pages.vendors = {
  title: 'Vendors',
  render(el, params) {
    const db = Store.db;
    const self = this;
    const spend = {};
    const since = Store.addDays(Store.today(), -59);
    db.purchaseOrders.filter(p => p.date >= since && p.status !== 'Cancelled').forEach(p => { spend[p.vendorId] = (spend[p.vendorId] || 0) + Store.poTotals(p).total; });
    el.innerHTML = App.head({ title: 'Vendors', sub: 'Approved suppliers of ingredients, cultures and packaging', actions: `${App.sampleBtn('Add sample vendors')}<button class="btn btn-primary" data-new>${icon('plus', 'sm')} New vendor</button>` }) + '<div id="tbl"></div>';
    App.bindSample(el, () => Seed.Sample.vendors(2));
    $('[data-new]', el).addEventListener('click', () => self.edit());
    new UI.DataTable($('#tbl', el), {
      id: 'vendors', exportName: 'vendors', rows: () => db.vendors,
      searchText: v => `${v.name} ${v.city} ${v.category} ${v.contact} ${v.gstin}`,
      filters: [{ key: 'cat', label: 'All categories', options: [...new Set(db.vendors.map(v => v.category))], test: (r, v) => r.category === v }],
      onRow: v => self.open(v.id),
      columns: [
        { key: 'name', label: 'Vendor', render: v => `<div class="item-cell">${UI.avatar(v.name, 34)}<div><div class="cell-main">${esc(v.name)}</div><div class="cell-sub">${esc(v.contact || '')} · ${esc(v.phone || '')}</div></div></div>` },
        { key: 'category', label: 'Category' },
        { key: 'city', label: 'Location', render: v => `${esc(v.city)}<div class="cell-sub">${esc(v.state)}</div>` },
        { key: 'leadDays', label: 'Lead time', align: 'right', render: v => `${v.leadDays} d` },
        { key: 'rating', label: 'Rating', render: v => UI.stars(v.rating || 4) },
        { key: 'open', label: 'Open POs', align: 'right', sort: v => db.purchaseOrders.filter(p => p.vendorId === v.id && ['Issued', 'Partially Received'].includes(p.status)).length, render: v => db.purchaseOrders.filter(p => p.vendorId === v.id && ['Issued', 'Partially Received'].includes(p.status)).length },
        { key: 'spend', label: 'Spend · 60d', align: 'right', sort: v => spend[v.id] || 0, render: v => `<b>${fmt.compact(spend[v.id] || 0)}</b>` },
      ],
    });
    if (params.id) self.open(params.id);
  },
  open(id) {
    const v = Store.vendor(id); if (!v) return;
    const db = Store.db;
    const pos = db.purchaseOrders.filter(p => p.vendorId === id);
    const items = db.items.filter(i => i.vendorId === id);
    const recv = pos.filter(p => p.receivedAt);
    const onTime = recv.length ? recv.filter(p => Store.isoOf(p.receivedAt) <= p.expected).length / recv.length * 100 : 100;
    UI.drawer({
      title: esc(v.name), sub: `${esc(v.category)} · ${esc(v.city)}, ${esc(v.state)}`,
      body: `<div class="stat-strip">${UI.stat('Purchase orders', pos.length)}${UI.stat('Total spend', fmt.compact(pos.filter(p => p.status !== 'Cancelled').reduce((s, p) => s + Store.poTotals(p).total, 0)))}${UI.stat('On-time delivery', fmt.pct(onTime, 0))}${UI.stat('Rating', (v.rating || 4).toFixed(1) + ' ★')}</div>
        <dl class="dl mt-16"><dt>Contact</dt><dd>${esc(v.contact || '—')}</dd><dt>Phone</dt><dd>${esc(v.phone || '—')}</dd><dt>Email</dt><dd>${esc(v.email || '—')}</dd><dt>GSTIN</dt><dd class="mono">${esc(v.gstin || '—')}</dd><dt>Payment terms</dt><dd>${esc(v.paymentTerms || '—')}</dd><dt>Lead time</dt><dd>${v.leadDays} days</dd></dl>
        <div class="section-title">Supplied items</div><div class="flex" style="flex-wrap:wrap;gap:6px">${items.map(i => `<a class="chip" href="#/items?id=${i.id}">${esc(i.name)}</a>`).join('') || '<span class="muted">None mapped</span>'}</div>
        <div class="section-title">Recent purchase orders</div><table class="tbl compact"><thead><tr><th>PO</th><th>Date</th><th>Status</th><th class="right">Amount</th></tr></thead><tbody>
        ${pos.slice(0, 12).map(p => `<tr class="clickable" onclick="location.hash='#/purchases?id=${p.id}'"><td class="mono">${p.no}</td><td>${fmt.date(p.date)}</td><td>${UI.badge(p.status)}</td><td class="right">${fmt.money(Store.poTotals(p).total)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No orders yet</td></tr>'}</tbody></table>`,
      foot: `${App.can('purchases') ? `<button class="btn" data-po>${icon('cart', 'sm')} New PO</button>` : ''}<button class="btn btn-primary" data-edit>${icon('edit', 'sm')} Edit</button>`,
      onMount(dr, close) {
        $('[data-edit]', dr).addEventListener('click', () => { close(); Pages.vendors.edit(v); });
        $('[data-po]', dr)?.addEventListener('click', () => { close(); App.go('#/purchases', () => Pages.purchases.create({ vendorId: id })); });
      },
    });
  },
  edit(v) {
    const e = v || { leadDays: 3, rating: 4, paymentTerms: 'Net 30', state: 'Maharashtra' };
    UI.formModal({
      title: v ? `Edit · ${esc(v.name)}` : 'New vendor', size: 'lg',
      body: `<div class="form-grid">
        ${UI.field('Vendor name', UI.input('name', e.name), { req: true, span: true })}
        ${UI.field('Category', UI.input('category', e.category, { ph: 'Grains & Pulses, Packaging…' }))}
        ${UI.field('Contact person', UI.input('contact', e.contact))}
        ${UI.field('Phone', UI.input('phone', e.phone))}
        ${UI.field('Email', UI.input('email', e.email, { type: 'email' }))}
        ${UI.field('City', UI.input('city', e.city))}
        ${UI.field('State', UI.input('state', e.state))}
        ${UI.field('GSTIN', UI.input('gstin', e.gstin))}
        ${UI.field('Payment terms', UI.select('paymentTerms', UI.options(['Advance', 'Net 15', 'Net 30', 'Net 45', 'Net 60'], e.paymentTerms)))}
        ${UI.field('Lead time (days)', UI.input('leadDays', e.leadDays, { type: 'number', min: 0 }))}
        ${UI.field('Rating (1–5)', UI.input('rating', e.rating, { type: 'number', min: 1, step: '0.1' }))}
      </div>`,
      onSubmit(form, close) {
        const d = UI.formData(form);
        if (v) d.id = v.id;
        const saved = Store.saveVendor(d);
        close(); UI.toast(v ? 'Vendor updated' : 'Vendor added'); App.refresh(); Pages.vendors.open(saved.id);
      },
    });
  },
};
