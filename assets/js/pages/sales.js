/* ==========================================================================
   Sales: Sales Orders, Customers, Returns & Credit Notes
   ========================================================================== */
Pages.sales = {
  title: 'Sales Orders',
  tab: '',
  render(el, params) {
    const db = Store.db;
    const self = this;
    if (params.f !== undefined) self.tab = params.f;
    const t = Store.today();
    const counts = {};
    db.salesOrders.forEach(s => { counts[s.status] = (counts[s.status] || 0) + 1; });
    const todays = db.salesOrders.filter(s => s.date === t && s.status !== 'Cancelled');
    const toShip = db.salesOrders.filter(s => s.status === 'Confirmed');
    const rec = Calc.receivables();
    const last30 = Calc.salesInRange(Store.addDays(t, -29), t);
    el.innerHTML = App.head({
      title: 'Sales Orders', sub: 'Book orders, dispatch with FEFO batch picking, invoice with GST and collect payments',
      actions: `${App.sampleBtn('Generate sample orders')}<button class="btn btn-primary" data-new>${icon('plus', 'sm')} New sales order</button>`,
    }) + `<div class="grid grid-4 mb-16">
        ${UI.kpi({ label: 'Booked today', value: fmt.compact(todays.reduce((s, x) => s + Calc.net(x), 0)), ic: 'receipt', tone: 'blue', foot: `${todays.length} orders` })}
        ${UI.kpi({ label: 'Awaiting dispatch', value: toShip.length, ic: 'truck', tone: 'violet', foot: `${fmt.compact(toShip.reduce((s, x) => s + Calc.net(x), 0))} confirmed value` })}
        ${UI.kpi({ label: 'Receivables', value: fmt.compact(rec.due), ic: 'wallet', tone: rec.overdue ? 'amber' : 'green', foot: `<span class="${rec.overdue ? 'text-danger' : ''}">${fmt.compact(rec.overdue)} overdue</span>` })}
        ${UI.kpi({ label: 'Avg order value · 30d', value: fmt.compact(last30.reduce((s, x) => s + Calc.net(x), 0) / Math.max(1, last30.length)), ic: 'trendUp', tone: 'green', foot: `${last30.length} invoiced orders` })}
      </div>
      <div class="tabs">${[['', 'All'], ['Draft', 'Draft'], ['Confirmed', 'Confirmed'], ['Dispatched', 'Dispatched'], ['Delivered', 'Delivered'], ['Cancelled', 'Cancelled']].map(([k, l]) => `<button class="tab ${self.tab === k ? 'active' : ''}" data-tab="${k}">${l}<span class="n">${k ? counts[k] || 0 : db.salesOrders.length}</span></button>`).join('')}</div>
      <div id="tbl"></div>`;
    App.bindSample(el, () => Seed.Sample.salesOrders(4));
    $('[data-new]', el).addEventListener('click', () => self.create());
    $$('[data-tab]', el).forEach(b => b.addEventListener('click', () => { self.tab = b.dataset.tab; self.render(el, {}); }));
    new UI.DataTable($('#tbl', el), {
      id: 'sales', exportName: 'sales-orders', searchPh: 'Search order, invoice, customer…',
      rows: () => db.salesOrders.filter(s => !self.tab || s.status === self.tab),
      searchText: s => `${s.no} ${s.invoiceNo || ''} ${Store.customer(s.customerId)?.name} ${s.ref || ''}`,
      filters: [
        { key: 'pay', label: 'Any payment', options: ['Paid', 'Partial', 'Unpaid', 'Overdue'], test: (r, v) => Store.payStatus(r) === v },
        { key: 'wh', label: 'All warehouses', options: db.warehouses.filter(w => w.type === 'Cold Storage'), test: (r, v) => r.whId === v },
        { key: 'ty', label: 'All channels', options: ['Distributor', 'Modern Trade', 'E-commerce', 'HoReCa', 'Retailer'], test: (r, v) => Store.customer(r.customerId)?.type === v },
      ],
      onRow: s => self.open(s.id),
      columns: [
        { key: 'no', label: 'Order #', render: s => `<span class="mono fw-600">${s.no}</span>${s.invoiceNo ? `<div class="cell-sub mono">${s.invoiceNo}</div>` : ''}` },
        { key: 'date', label: 'Date', render: s => fmt.date(s.date) },
        { key: 'customer', label: 'Customer', sort: s => Store.customer(s.customerId)?.name, render: s => { const c = Store.customer(s.customerId); return `<div class="cell-main">${esc(c?.name)}</div><div class="cell-sub">${esc(c?.type)} · ${esc(c?.city)}</div>`; } },
        { key: 'whId', label: 'From', render: s => `<span class="chip">${esc(Calc.whCode(s.whId))}</span>` },
        { key: 'amount', label: 'Amount', align: 'right', sort: s => Store.soTotals(s).total, render: s => `<b>${fmt.money(Store.soTotals(s).total)}</b><div class="cell-sub">${s.lines.length} item(s)</div>` },
        { key: 'status', label: 'Status', render: s => UI.badge(s.status) },
        { key: 'pay', label: 'Payment', sort: s => Store.payStatus(s), render: s => { const p = Store.payStatus(s); return p === '—' ? '<span class="muted">—</span>' : UI.badge(p); } },
        { key: 'act', label: '', sort: false, csv: false, render: s => s.status === 'Draft' ? `<button class="btn btn-sm btn-soft" data-conf="${s.id}">Confirm</button>` : s.status === 'Confirmed' ? `<button class="btn btn-sm btn-primary" data-ship="${s.id}">${icon('truck', 'sm')} Dispatch</button>` : s.status === 'Dispatched' ? `<button class="btn btn-sm btn-success" data-dlv="${s.id}">${icon('check', 'sm')} Delivered</button>` : '' },
      ],
      afterDraw: body => {
        $$('[data-conf]', body).forEach(b => b.addEventListener('click', () => UI.act(() => Store.confirmSO(b.dataset.conf), 'Order confirmed')));
        $$('[data-ship]', body).forEach(b => b.addEventListener('click', () => self.dispatch(b.dataset.ship)));
        $$('[data-dlv]', body).forEach(b => b.addEventListener('click', () => UI.act(() => Store.deliverSO(b.dataset.dlv), 'Marked as delivered')));
      },
    });
    if (params.id) self.open(params.id);
  },

  open(id) {
    const s = Store.byId('salesOrders', id); if (!s) return;
    const c = Store.customer(s.customerId);
    const t = Store.soTotals(s);
    const self = this;
    const pay = Store.payStatus(s);
    const rets = Store.db.returns.filter(r => r.soId === id);
    const pre = ['Draft', 'Confirmed'].includes(s.status);
    UI.drawer({
      title: s.no, badge: `${UI.badge(s.status)} ${pay !== '—' ? UI.badge(pay) : ''}`, sub: `${esc(c?.name)} · ${fmt.date(s.date)}${s.invoiceNo ? ` · Invoice <span class="mono">${s.invoiceNo}</span>` : ''}`, width: '720px',
      body: `<div class="stat-strip">${UI.stat('Order total', fmt.money(t.total))}${UI.stat('Paid', fmt.money(t.paid))}${UI.stat('Balance', `<span class="${t.due > 0 && pay === 'Overdue' ? 'text-danger' : ''}">${fmt.money(t.due)}</span>`)}${UI.stat('Due date', fmt.date(s.dueDate))}</div>
        <dl class="dl mt-16"><dt>Customer</dt><dd><a href="#/customers?id=${c?.id}">${esc(c?.name)}</a> · ${esc(c?.type)} · ${esc(c?.city)}</dd><dt>Dispatch from</dt><dd>${esc(Calc.whName(s.whId))}</dd>${s.ref ? `<dt>Customer PO</dt><dd class="mono">${esc(s.ref)}</dd>` : ''}<dt>Booked by</dt><dd>${esc(s.createdBy || '—')} · ${fmt.dt(s.createdAt)}</dd>
        ${s.dispatchedAt ? `<dt>Dispatched</dt><dd>${fmt.dt(s.dispatchedAt)}${s.vehicle ? ` · ${esc(s.vehicle)}` : ''}${s.driver ? ` · ${esc(s.driver)}` : ''}</dd>` : ''}${s.deliveredAt ? `<dt>Delivered</dt><dd>${fmt.dt(s.deliveredAt)}</dd>` : ''}</dl>
        <div class="section-title">Items</div><table class="tbl compact"><thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Disc</th><th class="right">GST</th><th class="right">Amount</th></tr></thead><tbody>
        ${s.lines.map(l => { const it = Store.item(l.itemId); const av = pre ? Store.stock(l.itemId, s.whId) : null; return `<tr><td>${esc(it?.name)}${pre ? `<div class="cell-sub ${av < l.qty ? 'text-danger' : ''}">${fmt.num(av)} available at ${esc(Calc.whCode(s.whId))}</div>` : ''}</td><td class="right">${fmt.num(l.qty)}</td><td class="right">${fmt.money(l.rate, 2)}</td><td class="right">${l.disc || 0}%</td><td class="right">${l.gst}%</td><td class="right fw-600">${fmt.money(l.qty * l.rate * (1 - (l.disc || 0) / 100), 2)}</td></tr>`; }).join('')}</tbody></table>
        <div class="totals"><div class="r"><span>Gross</span><span>${fmt.money(t.sub, 2)}</span></div><div class="r"><span>Trade discount</span><span>−${fmt.money(t.disc, 2)}</span></div>
          ${t.intra ? `<div class="r"><span>CGST</span><span>${fmt.money(t.cgst, 2)}</span></div><div class="r"><span>SGST</span><span>${fmt.money(t.sgst, 2)}</span></div>` : `<div class="r"><span>IGST</span><span>${fmt.money(t.igst, 2)}</span></div>`}
          <div class="r big"><span>Total</span><span>${fmt.money(t.total, 2)}</span></div></div>
        ${s.allocations?.length ? `<div class="section-title">FEFO batch allocation</div><table class="tbl compact"><thead><tr><th>Item</th><th>Batch</th><th>Expiry</th><th class="right">Qty</th></tr></thead><tbody>
          ${s.allocations.map(a => `<tr class="clickable" onclick="location.hash='#/batches?id=${a.batchId}'"><td>${esc(Store.item(a.itemId)?.name)}</td><td class="mono">${esc(a.batchNo)}</td><td>${fmt.date(a.exp)}</td><td class="right">${fmt.num(a.qty)}</td></tr>`).join('')}</tbody></table>` : ''}
        ${s.payments?.length ? `<div class="section-title">Payments</div><table class="tbl compact"><tbody>${s.payments.map(p => `<tr><td class="mono">${p.no}</td><td>${fmt.date(p.date)}</td><td>${esc(p.mode)}</td><td class="muted mono small">${esc(p.ref || '')}</td><td class="right fw-600 text-success">${fmt.money(p.amount, 2)}</td></tr>`).join('')}</tbody></table>` : ''}
        ${rets.length ? `<div class="section-title">Returns</div>${rets.map(r => `<a class="chip" href="#/returns?id=${r.id}">${r.no} · ${r.cn} · ${fmt.money(r.value)}</a>`).join(' ')}` : ''}`,
      foot: `${pre ? `<button class="btn btn-danger" data-cancel>${icon('x', 'sm')} Cancel</button>` : ''}
        ${s.invoiceNo ? `<button class="btn" data-inv>${icon('printer', 'sm')} Tax invoice</button>` : ''}
        ${['Dispatched', 'Delivered'].includes(s.status) && App.can('returns') ? `<button class="btn" data-ret>${icon('undo', 'sm')} Return</button>` : ''}
        <div class="grow"></div>
        ${pre ? `<button class="btn" data-edit>${icon('edit', 'sm')} Edit</button>` : ''}
        ${s.status === 'Draft' ? `<button class="btn btn-primary" data-conf>${icon('check', 'sm')} Confirm</button>` : ''}
        ${s.status === 'Confirmed' ? `<button class="btn btn-primary" data-ship>${icon('truck', 'sm')} Dispatch</button>` : ''}
        ${s.status === 'Dispatched' ? `<button class="btn btn-success" data-dlv>${icon('check', 'sm')} Mark delivered</button>` : ''}
        ${['Dispatched', 'Delivered'].includes(s.status) && t.due > 0.5 ? `<button class="btn btn-primary" data-pay>${icon('wallet', 'sm')} Record payment</button>` : ''}`,
      onMount(dr, close) {
        $('[data-conf]', dr)?.addEventListener('click', () => { if (UI.act(() => { Store.confirmSO(id); return true; }, 'Order confirmed')) self.open(id); });
        $('[data-ship]', dr)?.addEventListener('click', () => self.dispatch(id));
        $('[data-dlv]', dr)?.addEventListener('click', () => { if (UI.act(() => { Store.deliverSO(id); return true; }, 'Marked as delivered')) self.open(id); });
        $('[data-pay]', dr)?.addEventListener('click', () => self.payment(id));
        $('[data-inv]', dr)?.addEventListener('click', () => self.invoice(s));
        $('[data-edit]', dr)?.addEventListener('click', () => { close(); self.create(s); });
        $('[data-ret]', dr)?.addEventListener('click', () => { close(); App.go('#/returns', () => Pages.returns.create(id)); });
        $('[data-cancel]', dr)?.addEventListener('click', async () => {
          if (!(await UI.confirm({ title: 'Cancel order?', message: `${s.no} will be cancelled.`, okText: 'Cancel order', danger: true }))) return;
          if (UI.act(() => { Store.cancelSO(id); return true; }, 'Order cancelled')) close();
        });
      },
    });
  },

  dispatch(id) {
    const s = Store.byId('salesOrders', id);
    const need = {};
    s.lines.forEach(l => { need[l.itemId] = (need[l.itemId] || 0) + l.qty; });
    let ok = true;
    const preview = Object.entries(need).map(([itemId, q]) => {
      const it = Store.item(itemId);
      try { const picks = Store.allocate(itemId, s.whId, q); return `<tr><td>${esc(it.name)}</td><td class="right">${fmt.num(q)}</td><td>${picks.map(p => `<span class="chip mono" style="margin:1px">${esc(p.batch.batchNo)} · exp ${fmt.short(p.batch.exp)} × ${fmt.num(p.qty)}</span>`).join('')}</td></tr>`; }
      catch (e) { ok = false; return `<tr><td>${esc(it.name)}</td><td class="right">${fmt.num(q)}</td><td class="text-danger small">Short by ${fmt.num(q - Store.stock(itemId, s.whId))} — only ${fmt.num(Store.stock(itemId, s.whId))} usable at ${esc(Calc.whCode(s.whId))}</td></tr>`; }
    }).join('');
    UI.formModal({
      title: `Dispatch ${s.no}`, size: 'lg', submitText: ok ? 'Dispatch & generate invoice' : 'Cannot dispatch', submitIcon: 'truck',
      body: `<div class="alert ${ok ? 'info' : 'err'}">${icon(ok ? 'info' : 'alert', 'sm')}<div>${ok ? 'Batches below are picked by <b>FEFO</b> — earliest expiry leaves first. Expired lots are never picked.' : 'Insufficient usable stock. Plan production, transfer stock to this hub, or edit the order.'}</div></div>
        <table class="tbl compact mt-16"><thead><tr><th>Item</th><th class="right">Qty</th><th>Batches picked</th></tr></thead><tbody>${preview}</tbody></table>
        <div class="form-grid mt-16">${UI.field('Vehicle / reefer no.', UI.input('vehicle', '', { ph: 'MH12 RT 4471 (Reefer)' }))}${UI.field('Driver', UI.input('driver', ''))}</div>`,
      onSubmit(form, close) {
        const d = UI.formData(form);
        const r = Store.dispatchSO(id, d);
        close(); UI.toast(`Dispatched — invoice ${r.invoiceNo} generated`); App.refresh(); Pages.sales.open(id);
      },
    });
  },
  payment(id) {
    const s = Store.byId('salesOrders', id);
    const t = Store.soTotals(s);
    UI.formModal({
      title: `Record payment · ${s.no}`, size: 'sm', submitText: 'Record payment', submitIcon: 'wallet',
      body: `<div class="stat-strip">${UI.stat('Invoice total', fmt.money(t.total))}${UI.stat('Balance due', fmt.money(t.due))}</div>
        <div class="mt-16">${UI.field('Amount (₹)', UI.input('amount', t.due.toFixed(2), { type: 'number', step: '0.01', min: 0 }), { req: true })}</div>
        <div class="mt-16">${UI.field('Mode', UI.select('mode', UI.options(['NEFT', 'RTGS', 'UPI', 'Cheque', 'Cash'], 'NEFT')))}</div>
        <div class="mt-16">${UI.field('Reference / UTR', UI.input('ref', ''))}</div>`,
      onSubmit(form, close) {
        const d = UI.formData(form);
        Store.recordPayment(id, d);
        close(); UI.toast('Payment recorded'); App.refresh(); Pages.sales.open(id);
      },
    });
  },
  invoice(s) {
    const c = Store.customer(s.customerId), w = Store.wh(s.whId), t = Store.soTotals(s);
    printDocument({
      title: 'Tax Invoice', no: s.invoiceNo, date: s.dispatchDate || s.date,
      meta: [`Order: ${s.no}`, `Due: ${fmt.date(s.dueDate)}`, `Place of supply: ${esc(c.state)}`],
      partyLabel: 'Bill to', party: `<b>${esc(c.name)}</b><div class="small">${esc(c.city)}, ${esc(c.state)}</div><div class="small">GSTIN ${esc(c.gstin || 'Unregistered')}</div><div class="small">${esc(c.contact || '')} · ${esc(c.phone || '')}</div>`,
      shipLabel: 'Dispatched from', ship: `<b>${esc(w.name)}</b><div class="small">${esc(w.address || w.city)}</div><div class="small">${esc(s.vehicle || '')}</div>`,
      head: [{ l: '#' }, { l: 'Item / Batch' }, { l: 'HSN' }, { l: 'Qty', r: 1 }, { l: 'Rate', r: 1 }, { l: 'Disc', r: 1 }, { l: 'GST', r: 1 }, { l: 'Taxable', r: 1 }],
      rows: s.lines.map((l, i) => {
        const it = Store.item(l.itemId);
        const bs = (s.allocations || []).filter(a => a.itemId === l.itemId).map(a => `${a.batchNo} (exp ${fmt.short(a.exp)})`).join(', ');
        return [i + 1, `${esc(it.name)}<div class="small muted">Batch: ${esc(bs || '—')}</div>`, esc(it.hsn || ''), fmt.num(l.qty), fmt.money(l.rate, 2), (l.disc || 0) + '%', l.gst + '%', fmt.money(l.qty * l.rate * (1 - (l.disc || 0) / 100), 2)];
      }),
      totals: [['Taxable value', fmt.money(t.sub - t.disc, 2)], ...(t.intra ? [['CGST', fmt.money(t.cgst, 2)], ['SGST', fmt.money(t.sgst, 2)]] : [['IGST', fmt.money(t.igst, 2)]]), ['Invoice total', fmt.money(t.total, 2), 1], ['Received', fmt.money(t.paid, 2)], ['Balance due', fmt.money(t.due, 2)]],
      notes: 'Keep refrigerated at 0–4°C. Perishable goods — check seal and temperature on receipt. Bank: Demo Bank Ltd · A/c 0000 1234 5678 · IFSC DEMO0001234.',
    });
  },

  create(pre = null) {
    const db = Store.db;
    const editing = pre && pre.id;
    const fgs = db.items.filter(i => i.type === 'finished' && i.active);
    const state = { whId: pre?.whId || db.warehouses.find(w => w.type === 'Cold Storage')?.id, disc: 0, lines: pre?.lines ? pre.lines.map(l => ({ ...l })) : [{ itemId: '', qty: 0, rate: 0, disc: 0, gst: 5 }] };
    let form, editor;
    const totals = () => {
      const t = Store.soTotals({ lines: state.lines.filter(l => l.itemId), customerId: form?.customerId?.value, payments: [] });
      const c = Store.customer(form?.customerId?.value);
      let credit = '';
      if (c) {
        const out = db.salesOrders.filter(s => s.customerId === c.id && Calc.isSold(s)).reduce((a, s) => a + Store.soTotals(s).due, 0);
        const over = out + t.total > c.creditLimit;
        credit = `<div class="alert ${over ? 'warn' : 'info'}" style="margin:14px 0 0">${icon(over ? 'alert' : 'info', 'sm')}<div>${esc(c.name)} · outstanding ${fmt.money(out)} of ${fmt.money(c.creditLimit)} credit limit · ${c.creditDays}-day terms${over ? ' — <b>this order exceeds the credit limit</b>' : ''}</div></div>`;
      }
      $('#so-tot').innerHTML = `${credit}<div class="totals"><div class="r"><span>Gross</span><span>${fmt.money(t.sub, 2)}</span></div><div class="r"><span>Discount</span><span>−${fmt.money(t.disc, 2)}</span></div>${t.intra ? `<div class="r"><span>CGST + SGST</span><span>${fmt.money(t.tax, 2)}</span></div>` : `<div class="r"><span>IGST</span><span>${fmt.money(t.tax, 2)}</span></div>`}<div class="r big"><span>Total</span><span>${fmt.money(t.total, 2)}</span></div></div>`;
    };
    UI.formModal({
      title: editing ? `Edit ${pre.no}` : 'New sales order', size: 'xl', submitText: editing ? 'Save order' : 'Create order',
      body: `<div class="form-grid-3">
          ${UI.field('Customer', UI.select('customerId', UI.options(db.customers.filter(c => c.active !== false), pre?.customerId, { placeholder: 'Select customer…', label: c => `${c.name} · ${c.type}` })), { req: true })}
          ${UI.field('Dispatch from', UI.select('whId', UI.options(db.warehouses.filter(w => w.type === 'Cold Storage'), state.whId)), { req: true })}
          ${UI.field('Order date', UI.input('date', pre?.date || Store.today(), { type: 'date' }))}
          ${UI.field('Customer PO / ref', UI.input('ref', pre?.ref || ''))}
          ${UI.field('Notes', UI.input('notes', pre?.notes || ''))}
          ${editing ? '<div></div>' : UI.field('&nbsp;', `<label class="flex" style="height:38px"><input type="checkbox" name="confirm" checked> Confirm order now</label>`)}
        </div>
        <div class="section-title">Items</div><div id="lines"></div><div id="so-tot"></div>`,
      onMount(m, close, f) {
        form = f;
        editor = UI.lineEditor($('#lines', m), {
          lines: state.lines, blank: () => ({ itemId: '', qty: 0, rate: 0, disc: state.disc, gst: 5 }), addLabel: 'Add item', onChange: totals,
          columns: [
            { key: 'itemId', label: 'Product', type: 'select', options: l => UI.options(fgs, l.itemId, { placeholder: 'Select product…' }), rerender: true, onSet: (l, v) => { const it = Store.item(v); if (it) { l.rate = it.price; l.gst = it.gst; l.disc = state.disc; } } },
            { key: 'avail', label: 'Available', width: '95px', align: 'right', render: l => { if (!l.itemId) return '—'; const a = Store.stock(l.itemId, f.whId.value); return `<span class="${a < (l.qty || 0) ? 'text-danger fw-600' : ''}">${fmt.num(a)}</span>`; } },
            { key: 'qty', label: 'Qty', type: 'number', width: '95px', min: 0 },
            { key: 'rate', label: 'Rate (₹)', type: 'number', width: '105px', step: '0.01' },
            { key: 'disc', label: 'Disc %', type: 'number', width: '80px' },
            { key: 'gst', label: 'GST %', type: 'number', width: '75px' },
            { key: 'amt', label: 'Amount', width: '115px', align: 'right', render: l => fmt.money((l.qty || 0) * (l.rate || 0) * (1 - (l.disc || 0) / 100), 2) },
          ],
        });
        f.customerId.addEventListener('change', () => {
          const c = Store.customer(f.customerId.value);
          if (c) { state.disc = c.discount || 0; if (c.regionWh) f.whId.value = c.regionWh; state.lines.forEach(l => { if (l.itemId) l.disc = state.disc; }); editor.render(); }
          totals();
        });
        f.whId.addEventListener('change', () => editor.render());
        if (pre?.customerId) state.disc = Store.customer(pre.customerId)?.discount || 0;
        totals();
      },
      onSubmit(f, close) {
        const d = UI.formData(f);
        const conf = d.confirm; delete d.confirm;
        const so = Store.saveSO({ ...(editing ? { id: pre.id } : {}), ...d, lines: state.lines });
        if (!editing && conf) Store.confirmSO(so.id);
        close(); UI.toast(`${so.no} ${editing ? 'updated' : conf ? 'created & confirmed' : 'saved as draft'}`); App.refresh(); Pages.sales.open(so.id);
      },
    });
  },
};

/* ---------------- Customers ---------------- */
Pages.customers = {
  title: 'Customers',
  render(el, params) {
    const db = Store.db;
    const self = this;
    const since = Store.addDays(Store.today(), -59);
    const stats = {};
    for (const s of db.salesOrders) {
      const r = (stats[s.customerId] = stats[s.customerId] || { rev: 0, due: 0, last: '', n: 0 });
      if (Calc.isSold(s)) { if (s.date >= since) r.rev += Calc.net(s); r.due += Store.soTotals(s).due; }
      if (s.status !== 'Cancelled') { r.n++; if (s.date > r.last) r.last = s.date; }
    }
    const st = id => stats[id] || { rev: 0, due: 0, last: '', n: 0 };
    const byType = {};
    db.customers.forEach(c => { byType[c.type] = (byType[c.type] || 0) + st(c.id).rev; });
    el.innerHTML = App.head({ title: 'Customers', sub: 'Distributors, modern trade, e-commerce, HoReCa and retail accounts', actions: `${App.sampleBtn('Add sample customers')}<button class="btn btn-primary" data-new>${icon('plus', 'sm')} New customer</button>` }) +
      `<div class="grid grid-4 mb-16">${['Distributor', 'Modern Trade', 'E-commerce', 'HoReCa'].map((t, i) => UI.kpi({ label: `${t} revenue · 60d`, value: fmt.compact(byType[t] || 0), ic: ['truck', 'store', 'globe', 'users'][i], tone: ['violet', 'cyan', 'blue', 'amber'][i], foot: `${db.customers.filter(c => c.type === t).length} accounts` })).join('')}</div><div id="tbl"></div>`;
    App.bindSample(el, () => Seed.Sample.customers(2));
    $('[data-new]', el).addEventListener('click', () => self.edit());
    new UI.DataTable($('#tbl', el), {
      id: 'customers', exportName: 'customers', rows: () => db.customers,
      searchText: c => `${c.name} ${c.city} ${c.type} ${c.contact} ${c.gstin}`,
      filters: [{ key: 'ty', label: 'All channels', options: ['Distributor', 'Modern Trade', 'E-commerce', 'HoReCa', 'Retailer'], test: (r, v) => r.type === v }, { key: 'city', label: 'All cities', options: [...new Set(db.customers.map(c => c.city))], test: (r, v) => r.city === v }],
      onRow: c => self.open(c.id),
      columns: [
        { key: 'name', label: 'Customer', render: c => `<div class="item-cell">${UI.avatar(c.name, 34)}<div><div class="cell-main">${esc(c.name)}</div><div class="cell-sub">${esc(c.contact || '')} · ${esc(c.phone || '')}</div></div></div>` },
        { key: 'type', label: 'Channel', render: c => UI.badge(c.type) },
        { key: 'city', label: 'City', render: c => `${esc(c.city)}<div class="cell-sub">${esc(c.route || '')}</div>` },
        { key: 'terms', label: 'Credit terms', sort: c => c.creditDays, render: c => `${c.creditDays} days<div class="cell-sub">Limit ${fmt.compact(c.creditLimit)}</div>` },
        { key: 'rev', label: 'Revenue · 60d', align: 'right', sort: c => st(c.id).rev, render: c => `<b>${fmt.compact(st(c.id).rev)}</b>` },
        { key: 'due', label: 'Outstanding', align: 'right', sort: c => st(c.id).due, render: c => { const d = st(c.id).due; return d > 0.5 ? `<span class="${d > c.creditLimit ? 'text-danger fw-600' : ''}">${fmt.money(d)}</span>` : '<span class="muted">—</span>'; } },
        { key: 'last', label: 'Last order', sort: c => st(c.id).last, render: c => st(c.id).last ? fmt.date(st(c.id).last) : '<span class="muted">—</span>' },
      ],
    });
    if (params.id) self.open(params.id);
  },
  open(id) {
    const c = Store.customer(id); if (!c) return;
    const db = Store.db;
    const orders = db.salesOrders.filter(s => s.customerId === id);
    const sold = orders.filter(Calc.isSold);
    const due = sold.reduce((s, x) => s + Store.soTotals(x).due, 0);
    const overdue = sold.filter(s => s.dueDate < Store.today()).reduce((a, x) => a + Store.soTotals(x).due, 0);
    const prod = {};
    sold.forEach(s => s.lines.forEach(l => { prod[l.itemId] = (prod[l.itemId] || 0) + l.qty; }));
    const top = Object.entries(prod).sort((a, b) => b[1] - a[1]).slice(0, 5);
    UI.drawer({
      title: esc(c.name), badge: UI.badge(c.type), sub: `${esc(c.city)}, ${esc(c.state)} · ${esc(c.route || '')}`,
      body: `<div class="stat-strip">${UI.stat('Orders', orders.length)}${UI.stat('Lifetime revenue', fmt.compact(sold.reduce((s, x) => s + Calc.net(x), 0)))}${UI.stat('Outstanding', fmt.money(due))}${UI.stat('Overdue', `<span class="${overdue > 0.5 ? 'text-danger' : ''}">${fmt.money(overdue)}</span>`)}</div>
        <div class="mt-16"><div class="flex-between small"><span class="muted">Credit utilisation</span><b>${fmt.pct(due / (c.creditLimit || 1) * 100, 0)} of ${fmt.compact(c.creditLimit)}</b></div><div class="mt-8">${UI.progress(due / (c.creditLimit || 1) * 100, due > c.creditLimit ? 'red' : due > c.creditLimit * 0.75 ? 'amber' : 'green')}</div></div>
        <dl class="dl mt-16"><dt>Contact</dt><dd>${esc(c.contact || '—')} · ${esc(c.phone || '')}</dd><dt>Email</dt><dd>${esc(c.email || '—')}</dd><dt>GSTIN</dt><dd class="mono">${esc(c.gstin || 'Unregistered')}</dd><dt>Credit terms</dt><dd>${c.creditDays} days · default trade discount ${c.discount || 0}%</dd><dt>Serviced from</dt><dd>${esc(Calc.whName(c.regionWh))}</dd></dl>
        <div class="section-title">Top products</div>${top.map(([iid, q]) => `<div class="list-row">${UI.thumb(Store.item(iid))}<div class="meta"><div class="t">${esc(Store.item(iid)?.name)}</div></div><b>${fmt.num(q)}</b></div>`).join('') || '<div class="muted">No purchases yet</div>'}
        <div class="section-title">Recent orders</div><table class="tbl compact"><thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Payment</th><th class="right">Amount</th></tr></thead><tbody>
        ${orders.slice(0, 12).map(s => `<tr class="clickable" onclick="location.hash='#/sales?id=${s.id}'"><td class="mono">${s.no}</td><td>${fmt.date(s.date)}</td><td>${UI.badge(s.status)}</td><td>${Store.payStatus(s) === '—' ? '—' : UI.badge(Store.payStatus(s))}</td><td class="right">${fmt.money(Store.soTotals(s).total)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No orders</td></tr>'}</tbody></table>`,
      foot: `${App.can('sales') ? `<button class="btn" data-so>${icon('receipt', 'sm')} New order</button>` : ''}<button class="btn btn-primary" data-edit>${icon('edit', 'sm')} Edit</button>`,
      onMount(dr, close) {
        $('[data-edit]', dr).addEventListener('click', () => { close(); Pages.customers.edit(c); });
        $('[data-so]', dr)?.addEventListener('click', () => { close(); App.go('#/sales', () => Pages.sales.create({ customerId: id, whId: c.regionWh })); });
      },
    });
  },
  edit(c) {
    const db = Store.db;
    const e = c || { type: 'Retailer', creditDays: 15, creditLimit: 200000, discount: 0, state: 'Maharashtra' };
    UI.formModal({
      title: c ? `Edit · ${esc(c.name)}` : 'New customer', size: 'lg',
      body: `<div class="form-grid">
        ${UI.field('Customer name', UI.input('name', e.name), { req: true, span: true })}
        ${UI.field('Channel', UI.select('type', UI.options(['Distributor', 'Modern Trade', 'E-commerce', 'HoReCa', 'Retailer'], e.type)))}
        ${UI.field('Serviced from', UI.select('regionWh', UI.options(db.warehouses.filter(w => w.type === 'Cold Storage'), e.regionWh)))}
        ${UI.field('Contact person', UI.input('contact', e.contact))}
        ${UI.field('Phone', UI.input('phone', e.phone))}
        ${UI.field('Email', UI.input('email', e.email, { type: 'email' }))}
        ${UI.field('GSTIN', UI.input('gstin', e.gstin))}
        ${UI.field('City', UI.input('city', e.city))}
        ${UI.field('State', UI.input('state', e.state), { hint: 'Different state from company → IGST' })}
        ${UI.field('Route / beat', UI.input('route', e.route))}
        ${UI.field('Credit days', UI.input('creditDays', e.creditDays, { type: 'number', min: 0 }))}
        ${UI.field('Credit limit (₹)', UI.input('creditLimit', e.creditLimit, { type: 'number', min: 0 }))}
        ${UI.field('Default trade discount %', UI.input('discount', e.discount, { type: 'number', min: 0, step: '0.5' }))}
      </div>`,
      onSubmit(form, close) {
        const d = UI.formData(form);
        if (c) d.id = c.id;
        const saved = Store.saveCustomer(d);
        close(); UI.toast(c ? 'Customer updated' : 'Customer added'); App.refresh(); Pages.customers.open(saved.id);
      },
    });
  },
};

/* ---------------- Returns & Credit Notes ---------------- */
Pages.returns = {
  title: 'Returns & Credit Notes',
  REASONS: ['Damaged in transit', 'Seal / leakage issue', 'Near expiry – customer rejected', 'Excess quantity supplied', 'Wrong SKU delivered', 'Temperature abuse at customer', 'Quality complaint'],
  render(el, params) {
    const db = Store.db;
    const self = this;
    const t = Store.today(), from = Store.addDays(t, -29);
    const recent = db.returns.filter(r => r.date >= from);
    const units = r => r.lines.reduce((s, l) => s + l.qty, 0);
    const retUnits = recent.reduce((s, r) => s + units(r), 0);
    const soldUnits = Calc.salesInRange(from, t).reduce((s, o) => s + o.lines.reduce((a, l) => a + l.qty, 0), 0);
    const restock = recent.flatMap(r => r.lines).filter(l => l.action === 'Restock').reduce((s, l) => s + l.qty, 0);
    el.innerHTML = App.head({ title: 'Returns & Credit Notes', sub: 'Customer returns with batch-level disposition — restock saleable goods, scrap the rest', actions: `${App.sampleBtn('Generate sample return')}<button class="btn btn-primary" data-new>${icon('plus', 'sm')} New return</button>` }) +
      `<div class="grid grid-4 mb-16">
        ${UI.kpi({ label: 'Returns · 30d', value: recent.length, ic: 'undo', tone: 'blue', foot: `${fmt.num(retUnits)} packs` })}
        ${UI.kpi({ label: 'Credit notes · 30d', value: fmt.compact(recent.reduce((s, r) => s + r.value, 0)), ic: 'file', tone: 'violet', foot: 'Issued to customers' })}
        ${UI.kpi({ label: 'Return rate', value: fmt.pct(retUnits / Math.max(1, soldUnits) * 100, 2), ic: 'pie', tone: retUnits / Math.max(1, soldUnits) > 0.02 ? 'amber' : 'green', foot: 'Of units sold (30d)' })}
        ${UI.kpi({ label: 'Restocked', value: fmt.pct(restock / Math.max(1, retUnits) * 100, 0), ic: 'refresh', tone: 'green', foot: `${fmt.num(retUnits - restock)} packs scrapped` })}
      </div><div id="tbl"></div>`;
    App.bindSample(el, () => Seed.Sample.returns(1));
    $('[data-new]', el).addEventListener('click', () => self.create());
    new UI.DataTable($('#tbl', el), {
      id: 'returns', exportName: 'returns', rows: () => db.returns,
      searchText: r => `${r.no} ${r.cn} ${Store.customer(r.customerId)?.name} ${r.reason} ${Store.byId('salesOrders', r.soId)?.no}`,
      filters: [{ key: 'rs', label: 'All reasons', options: self.REASONS, test: (r, v) => r.reason === v }],
      onRow: r => self.open(r.id),
      columns: [
        { key: 'no', label: 'Return #', render: r => `<span class="mono fw-600">${r.no}</span><div class="cell-sub mono">${r.cn}</div>` },
        { key: 'date', label: 'Date', render: r => fmt.date(r.date) },
        { key: 'cust', label: 'Customer', sort: r => Store.customer(r.customerId)?.name, render: r => `<div class="cell-main">${esc(Store.customer(r.customerId)?.name)}</div><div class="cell-sub mono">${esc(Store.byId('salesOrders', r.soId)?.no || '')}</div>` },
        { key: 'reason', label: 'Reason', render: r => `<span class="muted">${esc(r.reason)}</span>` },
        { key: 'units', label: 'Packs', align: 'right', sort: units, render: r => fmt.num(units(r)) },
        { key: 'action', label: 'Disposition', sort: false, render: r => [...new Set(r.lines.map(l => l.action))].map(a => UI.badge(a)).join(' ') },
        { key: 'value', label: 'Credit value', align: 'right', render: r => `<b>${fmt.money(r.value)}</b>` },
      ],
    });
    if (params.id) self.open(params.id);
  },
  open(id) {
    const r = Store.byId('returns', id); if (!r) return;
    const so = Store.byId('salesOrders', r.soId), c = Store.customer(r.customerId);
    UI.drawer({
      title: r.no, sub: `Credit note <span class="mono">${r.cn}</span> · ${esc(c?.name)} · ${fmt.date(r.date)}`,
      body: `<div class="stat-strip">${UI.stat('Credit value', fmt.money(r.value, 2))}${UI.stat('Packs', fmt.num(r.lines.reduce((s, l) => s + l.qty, 0)))}${UI.stat('Against', `<a class="mono" href="#/sales?id=${so?.id}">${so?.no}</a>`)}</div>
        <dl class="dl mt-16"><dt>Reason</dt><dd>${esc(r.reason)}</dd><dt>Recorded by</dt><dd>${esc(r.by || '—')} · ${fmt.dt(r.createdAt)}</dd>${r.notes ? `<dt>Notes</dt><dd>${esc(r.notes)}</dd>` : ''}</dl>
        <div class="section-title">Lines</div><table class="tbl compact"><thead><tr><th>Item</th><th>Batch</th><th class="right">Qty</th><th>Disposition</th><th class="right">Credit</th></tr></thead><tbody>
        ${r.lines.map(l => `<tr><td>${esc(Store.item(l.itemId)?.name)}</td><td class="mono"><a href="#/batches?id=${l.batchId}">${esc(l.batchNo)}</a></td><td class="right">${fmt.num(l.qty)}</td><td>${UI.badge(l.action)}</td><td class="right">${fmt.money(l.qty * l.rate, 2)}</td></tr>`).join('')}</tbody></table>`,
      foot: `<button class="btn btn-primary" data-print>${icon('printer', 'sm')} Credit note</button>`,
      onMount(dr) {
        $('[data-print]', dr).addEventListener('click', () => printDocument({
          title: 'Credit Note', no: r.cn, date: r.date, meta: [`Return: ${r.no}`, `Against invoice: ${so?.invoiceNo || so?.no}`],
          partyLabel: 'Customer', party: `<b>${esc(c.name)}</b><div class="small">${esc(c.city)}, ${esc(c.state)}</div><div class="small">GSTIN ${esc(c.gstin || 'Unregistered')}</div>`,
          head: [{ l: '#' }, { l: 'Item / Batch' }, { l: 'Qty', r: 1 }, { l: 'Rate (incl. GST)', r: 1 }, { l: 'Disposition' }, { l: 'Amount', r: 1 }],
          rows: r.lines.map((l, i) => [i + 1, `${esc(Store.item(l.itemId)?.name)}<div class="small muted">${esc(l.batchNo)}</div>`, fmt.num(l.qty), fmt.money(l.rate, 2), l.action, fmt.money(l.qty * l.rate, 2)]),
          totals: [['Credit total', fmt.money(r.value, 2), 1]], notes: `Reason: ${esc(r.reason)}`,
        }));
      },
    });
  },
  create(soId) {
    const db = Store.db;
    const self = this;
    const eligible = db.salesOrders.filter(s => ['Dispatched', 'Delivered'].includes(s.status) && s.allocations?.length).slice(0, 150);
    UI.formModal({
      title: 'New sales return', size: 'lg', submitText: 'Post return & credit note', submitIcon: 'undo',
      body: `<div class="form-grid">
          ${UI.field('Sales order', UI.select('soId', UI.options(eligible, soId, { placeholder: 'Select dispatched order…', label: s => `${s.no} · ${s.invoiceNo} · ${Store.customer(s.customerId)?.name} · ${fmt.date(s.dispatchDate)}` })), { req: true, span: true })}
          ${UI.field('Reason', UI.select('reason', UI.options(self.REASONS, self.REASONS[0])), { req: true })}
          ${UI.field('Date', UI.input('date', Store.today(), { type: 'date' }))}
          ${UI.field('Notes', UI.input('notes', ''), { span: true })}
        </div><div id="rl" class="mt-16"></div>`,
      onMount(m, close, form) {
        const draw = () => {
          const so = Store.byId('salesOrders', form.soId.value);
          const box = $('#rl', m);
          if (!so) { box.innerHTML = `<div class="alert info">${icon('info', 'sm')}<div>Select an order to see the batches dispatched against it.</div></div>`; return; }
          box.innerHTML = `<div class="lines"><table><thead><tr><th>Item / batch</th><th class="right">Dispatched</th><th class="right">Returnable</th><th style="width:110px">Return qty</th><th style="width:140px">Disposition</th></tr></thead><tbody>
            ${so.allocations.map(a => { const max = a.qty - Store.returnedQty(so.id, a.batchId); const b = Store.byId('batches', a.batchId); const exp = b && !Store.isUsable({ ...b, qty: 1 }); return `<tr data-b="${a.batchId}"><td><b>${esc(Store.item(a.itemId)?.name)}</b><div class="cell-sub mono">${esc(a.batchNo)} · exp ${fmt.date(a.exp)}${exp ? ' <span class="text-danger">(expired)</span>' : ''}</div></td><td class="right">${fmt.num(a.qty)}</td><td class="right">${fmt.num(max)}</td>
              <td><input class="input sm right" type="number" min="0" max="${max}" value="0" data-q ${max <= 0 ? 'disabled' : ''}></td><td><select class="input sm" data-a>${UI.options(exp ? ['Scrap'] : ['Restock', 'Scrap'], form.reason.value.match(/Excess|Wrong/) && !exp ? 'Restock' : 'Scrap')}</select></td></tr>`; }).join('')}
            </tbody></table></div><div class="hint mt-8">Restocked goods return to their original batch & warehouse (same expiry). Scrapped goods are recorded as wastage.</div>`;
        };
        form.soId.addEventListener('change', draw); form.reason.addEventListener('change', draw); draw();
      },
      onSubmit(form, close) {
        const d = UI.formData(form);
        const lines = $$('tr[data-b]', form).map(tr => ({ batchId: tr.dataset.b, qty: parseFloat($('[data-q]', tr).value) || 0, action: $('[data-a]', tr).value }));
        const r = Store.createReturn({ ...d, lines });
        close(); UI.toast(`${r.no} posted · credit note ${r.cn} (${fmt.money(r.value)})`); App.refresh(); Pages.returns.open(r.id);
      },
    });
  },
};
