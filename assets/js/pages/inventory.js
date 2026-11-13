/* ==========================================================================
   Inventory modules: Items, Batches, Warehouses, Adjustments, Transfers
   ========================================================================== */

/* ---------------- Items & Catalog ---------------- */
Pages.items = {
  title: 'Items & Catalog',
  tab: 'finished',
  render(el, params) {
    const db = Store.db;
    const self = this;
    const counts = { finished: 0, raw: 0, packaging: 0 };
    db.items.forEach(i => { counts[i.type]++; });
    const low = db.items.filter(i => i.active && Calc.stockStatus(i) !== 'In Stock').length;
    el.innerHTML = App.head({
      title: 'Items & Catalog', sub: 'Finished goods, raw materials and packaging — stock is computed live from batches',
      actions: `${App.sampleBtn('Add sample products')}<button class="btn btn-primary" data-new>${icon('plus', 'sm')} New item</button>`,
    }) + `<div class="grid grid-4 mb-16">
        ${UI.kpi({ label: 'Active SKUs', value: db.items.filter(i => i.active).length, ic: 'box', tone: 'blue', foot: `${counts.finished} finished · ${counts.raw} raw · ${counts.packaging} packaging` })}
        ${UI.kpi({ label: 'Finished goods value', value: fmt.compact(Calc.inventoryValue(b => Store.item(b.itemId)?.type === 'finished')), ic: 'tag', tone: 'violet', foot: 'At production cost' })}
        ${UI.kpi({ label: 'Raw & packaging value', value: fmt.compact(Calc.inventoryValue(b => Store.item(b.itemId)?.type !== 'finished')), ic: 'database', tone: 'cyan', foot: 'At purchase cost' })}
        ${UI.kpi({ label: 'Below reorder level', value: low, ic: 'alert', tone: low ? 'amber' : 'green', foot: low ? 'Replenish via production / PO' : 'All healthy' })}
      </div>
      <div class="tabs">${[['finished', 'Finished Goods'], ['raw', 'Raw Materials'], ['packaging', 'Packaging'], ['all', 'All Items']].map(([k, l]) => `<button class="tab ${self.tab === k ? 'active' : ''}" data-tab="${k}">${l}<span class="n">${k === 'all' ? db.items.length : counts[k]}</span></button>`).join('')}</div>
      <div id="tbl"></div>`;
    $$('[data-tab]', el).forEach(b => b.addEventListener('click', () => { self.tab = b.dataset.tab; self.render(el, {}); }));
    $('[data-new]', el).addEventListener('click', () => self.create());
    App.bindSample(el, () => Seed.Sample.items(2));
    const cats = [...new Set(db.items.filter(i => self.tab === 'all' || i.type === self.tab).map(i => i.category))].sort();
    new UI.DataTable($('#tbl', el), {
      id: 'items-' + self.tab, exportName: 'items', searchPh: 'Search name, SKU, category…',
      rows: () => db.items.filter(i => self.tab === 'all' || i.type === self.tab),
      searchText: i => `${i.name} ${i.sku} ${i.category} ${i.barcode || ''}`,
      filters: [
        { key: 'cat', label: 'All categories', options: cats, test: (r, v) => r.category === v },
        { key: 'st', label: 'Any stock status', options: ['In Stock', 'Low Stock', 'Out of Stock'], test: (r, v) => Calc.stockStatus(r) === v },
      ],
      onRow: r => self.open(r.id),
      columns: [
        { key: 'name', label: 'Item', render: r => UI.itemCell(r, `<span class="mono">${esc(r.sku)}</span>${r.active ? '' : ' · <span class="text-danger">Inactive</span>'}`), csv: r => r.name },
        { key: 'sku', label: 'SKU', render: r => esc(r.sku), csv: r => r.sku, sort: r => r.sku },
        { key: 'category', label: 'Category', render: r => `${esc(r.category)}${self.tab === 'all' ? `<div class="cell-sub">${Calc.typeLabel(r.type)}</div>` : ''}` },
        { key: 'storage', label: 'Storage', render: r => `<span class="chip">${icon(r.storage?.startsWith('Chilled') ? 'thermo' : 'box', 'sm')} ${esc(r.storage || '—')}</span>` },
        { key: 'stock', label: 'On hand', align: 'right', sort: r => Store.stock(r.id), render: r => { const ex = Store.expiredStock(r.id); return `<b>${fmt.qty(Store.stock(r.id), r.uom)}</b>${ex ? `<div class="small text-danger">${fmt.qty(ex)} expired</div>` : ''}`; }, csv: r => Store.stock(r.id) },
        { key: 'reorderLevel', label: 'Reorder at', align: 'right', render: r => `<span class="muted">${fmt.qty(r.reorderLevel || 0)}</span>` },
        { key: 'status', label: 'Status', sort: r => Calc.stockStatus(r), render: r => UI.badge(Calc.stockStatus(r)) },
        { key: 'value', label: 'Value', align: 'right', sort: r => Store.stockValue(r.id), render: r => fmt.money(Store.stockValue(r.id)) },
        { key: 'price', label: 'Price / Cost', align: 'right', sort: r => r.price || r.cost, render: r => r.type === 'finished' ? `${fmt.money(r.price)}<div class="cell-sub">MRP ${fmt.money(r.mrp)}</div>` : `${fmt.money(r.cost, 2)}<div class="cell-sub">per ${esc(r.uom)}</div>` },
      ].filter(c => c.key !== 'sku'),
    });
    if (params.id) self.open(params.id);
  },

  open(id) {
    const it = Store.item(id); if (!it) return;
    const db = Store.db;
    const self = this;
    const onHand = Store.stock(id), exp = Store.expiredStock(id);
    const sold = Calc.unitsSoldByItem(30)[id];
    const cover = sold?.qty ? onHand / (sold.qty / 30) : null;
    const batches = db.batches.filter(b => b.itemId === id && b.qty > 0).sort((a, b) => (a.exp || '').localeCompare(b.exp || ''));
    const moves = db.movements.filter(m => m.itemId === id).slice(-15).reverse();
    const bom = Store.bomFor(id);
    const usedIn = db.boms.filter(b => b.lines.some(l => l.itemId === id));
    const v = it.vendorId ? Store.vendor(it.vendorId) : null;
    UI.drawer({
      title: esc(it.name), badge: UI.badge(Calc.stockStatus(it)), sub: `<span class="mono">${esc(it.sku)}</span> · ${Calc.typeLabel(it.type)} · ${esc(it.category)}`,
      body: `<div class="stat-strip">
          ${UI.stat('On hand', fmt.qty(onHand, it.uom))}
          ${it.type === 'finished' ? UI.stat('Committed', fmt.qty(Store.committed(id))) : UI.stat('On order', fmt.qty(Store.onOrder(id), it.uom))}
          ${UI.stat('Stock value', fmt.compact(Store.stockValue(id)))}
          ${it.type === 'finished' ? UI.stat('Days of cover', cover === null ? '—' : cover.toFixed(1)) : UI.stat('Reorder at', fmt.qty(it.reorderLevel, it.uom))}
          ${exp ? UI.stat('<span class="text-danger">Expired</span>', `<span class="text-danger">${fmt.qty(exp)}</span>`) : ''}
        </div>
        <div class="section-title">Details</div>
        <dl class="dl">
          <dt>Unit / pack</dt><dd>${esc(it.uom)}${it.packSize ? ' · ' + esc(it.packSize) : ''}</dd>
          <dt>Storage condition</dt><dd>${esc(it.storage || '—')}</dd>
          <dt>Shelf life</dt><dd>${it.shelfLife ? it.shelfLife + ' days' : '—'}</dd>
          <dt>GST / HSN</dt><dd>${it.gst}%${it.hsn ? ' · ' + esc(it.hsn) : ''}</dd>
          ${it.type === 'finished' ? `<dt>MRP / Selling price</dt><dd>${fmt.money(it.mrp)} / ${fmt.money(it.price)}</dd><dt>Standard cost</dt><dd>${fmt.money(it.cost, 2)} <span class="muted small">(margin ${it.price ? fmt.pct((it.price - it.cost) / it.price * 100) : '—'})</span></dd>` : `<dt>Purchase cost</dt><dd>${fmt.money(it.cost, 2)} / ${esc(it.uom)}</dd><dt>Preferred vendor</dt><dd>${v ? `<a href="#/vendors?id=${v.id}">${esc(v.name)}</a> · lead ${v.leadDays}d` : '—'}</dd>`}
          ${it.barcode ? `<dt>Barcode (EAN-13)</dt><dd class="mono">${esc(it.barcode)}</dd>` : ''}
        </dl>
        <div class="section-title">Stock by warehouse</div>
        <table class="tbl compact"><thead><tr><th>Warehouse</th><th class="right">Usable</th><th class="right">Expired</th><th class="right">Value</th></tr></thead><tbody>
          ${db.warehouses.map(w => ({ w, s: Store.stock(id, w.id), e: Store.expiredStock(id, w.id) })).filter(x => x.s || x.e).map(x => `<tr><td>${esc(x.w.name)}</td><td class="right fw-600">${fmt.qty(x.s, it.uom)}</td><td class="right ${x.e ? 'text-danger' : 'muted'}">${fmt.qty(x.e)}</td><td class="right">${fmt.money(Store.stockValue(id, x.w.id))}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No stock</td></tr>'}
        </tbody></table>
        <div class="section-title">Batches (FEFO order)</div>
        <table class="tbl compact"><thead><tr><th>Batch</th><th>Warehouse</th><th>Expiry</th><th class="right">Qty</th><th>Status</th></tr></thead><tbody>
          ${batches.slice(0, 12).map(b => `<tr class="clickable" onclick="location.hash='#/batches?id=${b.id}'"><td class="mono">${esc(b.batchNo)}</td><td>${Calc.whCode(b.whId)}</td><td>${Calc.expLabel(b.exp)}</td><td class="right">${fmt.qty(b.qty)}</td><td>${UI.badge(Store.batchStatus(b))}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No batches in stock</td></tr>'}
        </tbody></table>
        ${bom ? `<div class="section-title">Recipe (per ${bom.outputQty} ${esc(it.uom)})</div><table class="tbl compact"><tbody>${bom.lines.map(l => { const c = Store.item(l.itemId); return `<tr><td>${esc(c.name)}</td><td class="right">${fmt.qty(l.qty, c.uom)}</td><td class="right muted">${fmt.money(l.qty * c.cost, 2)}</td></tr>`; }).join('')}</tbody></table>` : ''}
        ${usedIn.length ? `<div class="section-title">Used in recipes</div><div class="flex" style="flex-wrap:wrap">${usedIn.map(b => `<a class="chip" href="#/items?id=${b.itemId}">${esc(Store.item(b.itemId).name)}</a>`).join('')}</div>` : ''}
        <div class="section-title">Recent stock movements</div>
        <table class="tbl compact"><thead><tr><th>When</th><th>Type</th><th>Ref</th><th>WH</th><th class="right">Qty</th></tr></thead><tbody>
          ${moves.map(m => `<tr><td class="nowrap">${fmt.dt(m.ts)}</td><td>${Calc.moveLabel(m.type)}</td><td class="mono">${esc(m.ref || '')}</td><td>${Calc.whCode(m.whId)}</td><td class="right fw-600 ${m.qty < 0 ? 'text-danger' : 'text-success'}">${m.qty > 0 ? '+' : ''}${fmt.qty(m.qty)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No movements</td></tr>'}
        </tbody></table>`,
      foot: `<button class="btn btn-danger" data-del>${icon('trash', 'sm')} Delete</button><div class="grow"></div>
        ${it.type === 'finished' && App.can('production') && bom ? `<button class="btn" data-produce>${icon('factory', 'sm')} Plan production</button>` : ''}
        ${it.type !== 'finished' && App.can('purchases') ? `<button class="btn" data-po>${icon('cart', 'sm')} Raise PO</button>` : ''}
        <button class="btn btn-primary" data-edit>${icon('edit', 'sm')} Edit item</button>`,
      onMount(dr, close) {
        $('[data-edit]', dr).addEventListener('click', () => { close(); self.create(it); });
        $('[data-del]', dr).addEventListener('click', async () => {
          if (!(await UI.confirm({ title: 'Delete item?', message: `Delete <b>${esc(it.name)}</b>? This cannot be undone.`, okText: 'Delete', danger: true }))) return;
          if (UI.act(() => { Store.deleteItem(id); return true; }, 'Item deleted')) close();
        });
        $('[data-produce]', dr)?.addEventListener('click', () => { close(); App.go('#/production', () => Pages.production.create({ itemId: id })); });
        $('[data-po]', dr)?.addEventListener('click', () => { close(); App.go('#/purchases', () => Pages.purchases.create({ vendorId: it.vendorId, lines: [{ itemId: id, qty: it.orderQty || 100, rate: it.cost, gst: it.gst }] })); });
      },
    });
  },

  create(it = null) {
    const e = it || { type: Pages.items.tab === 'all' ? 'finished' : Pages.items.tab, uom: 'pcs', gst: 5, storage: 'Chilled 0–4°C', shelfLife: 20 };
    const db = Store.db;
    const cats = [...new Set(db.items.map(i => i.category))].sort();
    UI.formModal({
      title: it ? `Edit · ${esc(it.name)}` : 'New item', size: 'lg', submitText: it ? 'Save changes' : 'Create item',
      body: `<div class="form-grid">
        ${UI.field('Item name', UI.input('name', e.name, { ph: 'e.g. Premium Tofu – Plain 200 g' }), { req: true, span: true })}
        ${UI.field('SKU', UI.input('sku', e.sku, { ph: 'FG-TOF-PL200' }), { req: true })}
        ${UI.field('Item type', UI.select('type', UI.options([{ id: 'finished', name: 'Finished Good' }, { id: 'raw', name: 'Raw Material' }, { id: 'packaging', name: 'Packaging' }], e.type)))}
        ${UI.field('Category', UI.input('category', e.category, { extra: 'list="cats"', ph: 'Tofu, Spices, Packaging…' }) + `<datalist id="cats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>`, { req: true })}
        ${UI.field('Unit of measure', UI.select('uom', UI.options(['pcs', 'kg', 'g', 'L', 'ml', 'box'], e.uom)))}
        ${UI.field('Pack description', UI.input('packSize', e.packSize, { ph: '200 g vacuum pack' }))}
        ${UI.field('Storage condition', UI.select('storage', UI.options(['Chilled 0–4°C', 'Frozen −18°C', 'Ambient (<30°C)'], e.storage)))}
        ${UI.field('Shelf life (days)', UI.input('shelfLife', e.shelfLife, { type: 'number', min: 0 }))}
        ${UI.field('Reorder level', UI.input('reorderLevel', e.reorderLevel, { type: 'number', min: 0 }), { hint: 'Alert when usable stock drops below this' })}
        ${UI.field('MRP (₹)', UI.input('mrp', e.mrp, { type: 'number', min: 0, step: '0.01' }))}
        ${UI.field('Selling price (₹)', UI.input('price', e.price, { type: 'number', min: 0, step: '0.01' }))}
        ${UI.field('Cost (₹ per unit)', UI.input('cost', e.cost, { type: 'number', min: 0, step: '0.01' }))}
        ${UI.field('GST rate', UI.select('gst', UI.options(['0', '5', '12', '18', '28'].map(x => ({ id: x, name: x + '%' })), String(e.gst))))}
        ${UI.field('HSN code', UI.input('hsn', e.hsn))}
        ${UI.field('Barcode (EAN)', UI.input('barcode', e.barcode))}
        ${UI.field('Preferred vendor', UI.select('vendorId', UI.options(db.vendors, e.vendorId, { placeholder: '— None —' })))}
        ${UI.field('Net weight per unit (kg)', UI.input('weightKg', e.weightKg, { type: 'number', min: 0, step: '0.001' }), { hint: 'Used for plant capacity (kg/day)' })}
      </div>`,
      onSubmit(form, close) {
        const d = UI.formData(form);
        d.gst = +d.gst;
        ['shelfLife', 'reorderLevel', 'mrp', 'price', 'cost', 'weightKg'].forEach(k => { d[k] = d[k] ?? 0; });
        if (!d.category) throw new Error('Category is required');
        if (it) d.id = it.id;
        else { d.color = UI.colorFor(d.name); d.cold = d.storage.startsWith('Chilled'); }
        const saved = Store.saveItem(d);
        close(); UI.toast(it ? 'Item updated' : 'Item created'); App.refresh();
        Pages.items.open(saved.id);
      },
    });
  },
};

/* ---------------- Batches & Expiry ---------------- */
Pages.batches = {
  title: 'Batches & Expiry',
  render(el, params) {
    const db = Store.db;
    const self = this;
    const live = db.batches.filter(b => b.qty > 0);
    const expiring = live.filter(b => Store.batchStatus(b) === 'Expiring');
    const expired = live.filter(b => Store.batchStatus(b) === 'Expired');
    const val = list => list.reduce((s, b) => s + b.qty * b.cost, 0);
    el.innerHTML = App.head({
      title: 'Batches & Expiry', sub: 'Lot-level tracking with FEFO (first-expiry, first-out) and full recall traceability',
      actions: `${App.sampleBtn('Receive sample GRN')}${App.can('adjustments') ? `<button class="btn btn-danger" data-wo ${expired.length ? '' : 'disabled'}>${icon('trash', 'sm')} Write off expired</button>` : ''}`,
    }) + `<div class="grid grid-4 mb-16">
        ${UI.kpi({ label: 'Live batches', value: fmt.num(live.length), ic: 'layers', tone: 'blue', foot: `${fmt.compact(val(live))} total value` })}
        ${UI.kpi({ label: 'Expiring soon', value: expiring.length, ic: 'clock', tone: 'amber', foot: `${fmt.compact(val(expiring))} at risk — dispatch first` })}
        ${UI.kpi({ label: 'Expired in stock', value: expired.length, ic: 'alert', tone: 'red', foot: `${fmt.compact(val(expired))} to write off` })}
        ${UI.kpi({ label: 'Traceability', value: '100%', ic: 'scan', tone: 'green', foot: 'Every pack traceable to raw lots & customers' })}
      </div><div id="tbl"></div>`;
    App.bindSample(el, () => Seed.Sample.receipts());
    $('[data-wo]', el)?.addEventListener('click', async () => {
      if (!(await UI.confirm({ title: 'Write off expired stock?', message: `${expired.length} expired batch(es) worth <b>${fmt.money(val(expired))}</b> will be removed via stock adjustments.`, okText: 'Write off', danger: true }))) return;
      UI.act(() => Store.writeOffExpired(), r => `Posted ${r.length} write-off adjustment(s)`);
    });
    new UI.DataTable($('#tbl', el), {
      id: 'batches', exportName: 'batches', searchPh: 'Search batch no, item, vendor lot…',
      rows: () => { const st = $('[data-f=st]', el)?.value; return st === 'Consumed' ? db.batches : db.batches.filter(b => b.qty > 0); },
      sort: { key: 'exp', dir: 'asc' },
      searchText: b => `${b.batchNo} ${Store.item(b.itemId)?.name} ${b.vendorLot} ${b.ref}`,
      filters: [
        { key: 'st', label: 'In-stock batches', value: params.f || '', options: ['Available', 'Expiring', 'Expired', 'Consumed'], test: (b, v) => Store.batchStatus(b) === v },
        { key: 'wh', label: 'All warehouses', options: db.warehouses.map(w => ({ id: w.id, name: w.name })), test: (b, v) => b.whId === v },
        { key: 'ty', label: 'All item types', options: [{ id: 'finished', name: 'Finished goods' }, { id: 'raw', name: 'Raw materials' }, { id: 'packaging', name: 'Packaging' }], test: (b, v) => Store.item(b.itemId)?.type === v },
      ],
      onRow: b => self.open(b.id),
      columns: [
        { key: 'batchNo', label: 'Batch / Lot', render: b => `<div class="mono fw-600">${esc(b.batchNo)}</div><div class="cell-sub">${esc(b.source)}${b.ref ? ' · ' + esc(b.ref) : ''}</div>` },
        { key: 'item', label: 'Item', sort: b => Store.item(b.itemId)?.name, render: b => UI.itemCell(Store.item(b.itemId)) },
        { key: 'wh', label: 'Warehouse', sort: b => Calc.whCode(b.whId), render: b => `<span class="chip">${esc(Calc.whCode(b.whId))}</span>` },
        { key: 'mfg', label: 'Mfg / Recv', render: b => fmt.date(b.mfg) },
        { key: 'exp', label: 'Expiry', sort: b => b.exp || '9999', render: b => Calc.expLabel(b.exp) },
        { key: 'qty', label: 'Qty left', align: 'right', render: b => `<b>${fmt.qty(b.qty, Store.item(b.itemId)?.uom)}</b><div style="width:90px;margin-left:auto;margin-top:4px">${UI.progress(b.qty / (b.initialQty || 1) * 100)}</div>`, csv: b => b.qty },
        { key: 'value', label: 'Value', align: 'right', sort: b => b.qty * b.cost, render: b => fmt.money(b.qty * b.cost) },
        { key: 'status', label: 'Status', sort: b => Store.batchStatus(b), render: b => UI.badge(Store.batchStatus(b)) },
      ],
    });
    if (params.id) self.open(params.id);
  },

  open(id) {
    const b = Store.byId('batches', id); if (!b) return;
    const db = Store.db;
    const it = Store.item(b.itemId);
    const siblings = db.batches.filter(x => x.batchNo === b.batchNo && x.itemId === b.itemId);
    const sids = new Set(siblings.map(x => x.id));
    const customers = [];
    for (const so of db.salesOrders) for (const a of so.allocations || []) if (sids.has(a.batchId)) customers.push({ so, a });
    const moves = db.movements.filter(m => sids.has(m.batchId)).slice().reverse();
    const mo = b.source === 'Production' ? db.productions.find(m => m.no === b.ref) : null;
    const usedBy = it.type !== 'finished' ? db.productions.filter(m => m.consumed.some(c => sids.has(c.batchId))) : [];
    const life = it.shelfLife ? Math.min(100, Math.max(0, Store.daysBetween(b.mfg, Store.today()) / it.shelfLife * 100)) : 0;
    const traceCsv = () => UI.csvDownload(`recall-trace-${b.batchNo}.csv`, [['Batch', 'Item', 'Customer', 'City', 'Sales Order', 'Invoice', 'Dispatch date', 'Qty'], ...customers.map(({ so, a }) => [b.batchNo, it.name, Store.customer(so.customerId)?.name, Store.customer(so.customerId)?.city, so.no, so.invoiceNo, so.dispatchDate, a.qty])]);
    UI.drawer({
      title: `<span class="mono">${esc(b.batchNo)}</span>`, badge: UI.badge(Store.batchStatus(b)), sub: `${esc(it.name)} · ${esc(Calc.whName(b.whId))}`,
      body: `<div class="stat-strip">${UI.stat('Qty on hand', fmt.qty(b.qty, it.uom))}${UI.stat('Received / made', fmt.qty(b.initialQty, it.uom))}${UI.stat('Unit cost', fmt.money(b.cost, 2))}${UI.stat('Value', fmt.money(b.qty * b.cost))}</div>
        <div class="section-title">Shelf life</div>
        <div class="flex-between small"><span>Mfg ${fmt.date(b.mfg)}</span><span>Expiry ${fmt.date(b.exp)}</span></div>
        <div class="mt-8">${UI.progress(life, life > 85 ? 'red' : life > 60 ? 'amber' : 'green')}</div>
        <div class="small muted mt-8">${life.toFixed(0)}% of shelf life elapsed · ${Calc.expLabel(b.exp).replace(/<[^>]+>/g, ' ')}</div>
        <dl class="dl mt-16"><dt>Source</dt><dd>${esc(b.source)} ${b.ref ? `· <span class="mono">${esc(b.ref)}</span>` : ''}</dd>${b.vendorLot ? `<dt>Vendor lot</dt><dd class="mono">${esc(b.vendorLot)}</dd>` : ''}<dt>QC status</dt><dd>${UI.badge(b.qc || 'Passed')}</dd><dt>Storage</dt><dd>${esc(it.storage)}</dd></dl>
        ${mo ? `<div class="section-title">Backward trace · raw material lots used</div>
          <table class="tbl compact"><thead><tr><th>Material</th><th>Lot</th><th class="right">Qty</th></tr></thead><tbody>${mo.consumed.map(c => { const rb = Store.byId('batches', c.batchId); const ri = Store.item(c.itemId); return `<tr><td>${esc(ri?.name)}</td><td class="mono">${esc(rb?.batchNo || '')}</td><td class="right">${fmt.qty(c.qty, ri?.uom)}</td></tr>`; }).join('')}</tbody></table>
          <div class="small muted mt-8">Production order <a href="#/production?id=${mo.id}">${mo.no}</a> · QC pH ${mo.qc?.ph ?? '—'} · core ${mo.qc?.coreTemp ?? '—'}°C · ${esc(mo.qc?.inspector || '')}</div>` : ''}
        ${it.type !== 'finished' ? `<div class="section-title">Forward trace · production batches made from this lot</div>
          <table class="tbl compact"><thead><tr><th>Production order</th><th>Product</th><th>Output batch</th><th class="right">Lot qty used</th></tr></thead><tbody>
          ${usedBy.map(m => `<tr class="clickable" onclick="location.hash='#/production?id=${m.id}'"><td class="mono">${m.no}</td><td>${esc(Store.item(m.itemId)?.name)}</td><td class="mono">${esc(m.batchNo || '—')}</td><td class="right">${fmt.qty(m.consumed.filter(c => sids.has(c.batchId)).reduce((s, c) => s + c.qty, 0), it.uom)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Not yet issued to production</td></tr>'}</tbody></table>` : `<div class="section-title flex-between"><span>Forward trace · customers who received this batch</span>${customers.length ? '<button class="btn btn-sm" data-trace>' + icon('download', 'sm') + ' Recall report</button>' : ''}</div>
        <table class="tbl compact"><thead><tr><th>Customer</th><th>Order / Invoice</th><th>Dispatched</th><th class="right">Qty</th></tr></thead><tbody>
          ${customers.map(({ so, a }) => `<tr class="clickable" onclick="location.hash='#/sales?id=${so.id}'"><td>${esc(Store.customer(so.customerId)?.name)}<div class="cell-sub">${esc(Store.customer(so.customerId)?.city)}</div></td><td class="mono">${so.no}<div class="cell-sub">${so.invoiceNo || ''}</div></td><td>${fmt.date(so.dispatchDate)}</td><td class="right fw-600">${fmt.qty(a.qty)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Not yet dispatched to any customer</td></tr>'}
        </tbody></table>`}
        <div class="section-title">Movement history</div>
        <table class="tbl compact"><thead><tr><th>When</th><th>Type</th><th>Ref</th><th>WH</th><th class="right">Qty</th></tr></thead><tbody>
          ${moves.slice(0, 25).map(m => `<tr><td class="nowrap">${fmt.dt(m.ts)}</td><td>${Calc.moveLabel(m.type)}</td><td class="mono">${esc(m.ref || '')}</td><td>${Calc.whCode(m.whId)}</td><td class="right fw-600 ${m.qty < 0 ? 'text-danger' : 'text-success'}">${m.qty > 0 ? '+' : ''}${fmt.qty(m.qty)}</td></tr>`).join('')}
        </tbody></table>`,
      foot: `${App.can('adjustments') && b.qty > 0 ? `<button class="btn" data-adj>${icon('clipboard', 'sm')} Adjust</button>` : ''}${App.can('transfers') && b.qty > 0 && Store.isUsable(b) ? `<button class="btn" data-trf>${icon('transfer', 'sm')} Transfer</button>` : ''}`,
      onMount(dr, close) {
        $('[data-trace]', dr)?.addEventListener('click', traceCsv);
        $('[data-adj]', dr)?.addEventListener('click', () => { close(); App.go('#/adjustments', () => Pages.adjustments.create({ whId: b.whId, lines: [{ batchId: b.id, qty: Store.isUsable(b) ? -1 : -b.qty }], type: Store.isUsable(b) ? 'Damage' : 'Expired' })); });
        $('[data-trf]', dr)?.addEventListener('click', () => { close(); App.go('#/transfers', () => Pages.transfers.create({ from: b.whId, lines: [{ itemId: b.itemId, qty: Math.min(b.qty, 24) }] })); });
      },
    });
  },
};

/* ---------------- Warehouses & Cold Chain ---------------- */
Pages.warehouses = {
  title: 'Warehouses & Cold Chain',
  render(el) {
    const db = Store.db;
    const self = this;
    const lastTemp = id => { for (let i = db.tempLogs.length - 1; i >= 0; i--) if (db.tempLogs[i].whId === id) return db.tempLogs[i]; return null; };
    const exc24 = db.tempLogs.filter(l => !l.ok && l.ts > Date.now() - 86400000).length;
    const compliance = db.tempLogs.length ? db.tempLogs.filter(l => l.ok).length / db.tempLogs.length * 100 : 100;
    el.innerHTML = App.head({
      title: 'Warehouses & Cold Chain', sub: 'Plant stores, cold rooms and distribution hubs with temperature compliance',
      actions: `${App.sampleBtn('Capture sensor readings')}<button class="btn" data-log>${icon('thermo', 'sm')} Log temperature</button><button class="btn btn-primary" data-new>${icon('plus', 'sm')} Add warehouse</button>`,
    }) + `<div class="grid grid-4 mb-16">
        ${UI.kpi({ label: 'Locations', value: db.warehouses.length, ic: 'warehouse', tone: 'blue', foot: `${db.warehouses.filter(w => w.type === 'Cold Storage').length} cold storage · ${db.warehouses.filter(w => w.isPlant).length} at plant` })}
        ${UI.kpi({ label: 'Temperature compliance', value: fmt.pct(compliance), ic: 'shield', tone: compliance > 97 ? 'green' : 'amber', foot: `${db.tempLogs.length} readings (21 days)` })}
        ${UI.kpi({ label: 'Excursions · 24h', value: exc24, ic: 'thermo', tone: exc24 ? 'red' : 'green', foot: exc24 ? 'Investigate & record CAPA' : 'Cold chain intact' })}
        ${UI.kpi({ label: 'Goods in transit', value: db.transfers.filter(t => t.status === 'In Transit').length, ic: 'truck', tone: 'violet', foot: 'Reefer transfers between sites' })}
      </div>
      <div class="grid grid-2" id="whs">${db.warehouses.map(w => {
        const lt = lastTemp(w.id);
        const bs = db.batches.filter(b => b.whId === w.id && b.qty > 0);
        const fgUnits = bs.filter(b => Store.item(b.itemId)?.type === 'finished').reduce((s, b) => s + b.qty, 0);
        const other = bs.filter(b => Store.item(b.itemId)?.type !== 'finished').reduce((s, b) => s + b.qty, 0);
        const used = Math.min(100, (fgUnits + other * 0.3) / (w.capacity || 1) * 100);
        const skus = new Set(bs.map(b => b.itemId)).size;
        return `<div class="card wh-card"><div class="top"><div class="dot-ic ${w.type === 'Cold Storage' ? 'ti-cyan' : 'ti-amber'}" style="width:44px;height:44px">${icon(w.type === 'Cold Storage' ? 'thermo' : 'warehouse')}</div>
          <div class="grow"><div class="flex" style="gap:8px;flex-wrap:wrap"><b style="font-size:15px">${esc(w.name)}</b><span class="chip mono">${esc(w.code)}</span>${w.isPlant ? '<span class="badge b-violet plain">Plant</span>' : '<span class="badge b-blue plain">Hub</span>'}</div>
          <div class="small muted">${esc(w.type)} · ${esc(w.city)} · Manager: ${esc(w.manager || '—')}</div></div>
          <div class="right"><div class="temp ${lt && !lt.ok ? 'temp-bad' : 'temp-ok'}">${lt ? lt.temp + '°C' : '—'}</div><div class="small muted">Range ${w.tempMin}–${w.tempMax}°C · ${lt ? fmt.rel(lt.ts) : 'no data'}</div></div></div>
          <div class="chart-box" style="height:90px;margin-top:12px"><canvas data-spark="${w.id}"></canvas></div>
          <div class="flex-between small mt-8"><span class="muted">Space utilisation</span><b>${fmt.pct(used, 0)}</b></div><div class="mt-8">${UI.progress(used, used > 85 ? 'red' : used > 65 ? 'amber' : 'green')}</div>
          <div class="stat-strip mt-16">${UI.stat('SKUs', skus)}${UI.stat('Batches', bs.length)}${UI.stat('Stock value', fmt.compact(bs.reduce((s, b) => s + b.qty * b.cost, 0)))}</div>
          <div class="flex mt-16"><button class="btn btn-sm" data-stock="${w.id}">${icon('eye', 'sm')} View stock</button><button class="btn btn-sm" data-logw="${w.id}">${icon('thermo', 'sm')} Log reading</button><div class="grow"></div><button class="btn btn-sm btn-ghost" data-edit="${w.id}">${icon('edit', 'sm')} Edit</button></div></div>`;
      }).join('')}</div>
      <div class="section-title" style="margin-top:28px">Temperature log</div><div id="tbl"></div>`;
    App.bindSample(el, () => Seed.Sample.temps());
    $('[data-new]', el).addEventListener('click', () => self.edit());
    $('[data-log]', el).addEventListener('click', () => self.logReading());
    $$('[data-logw]', el).forEach(b => b.addEventListener('click', () => self.logReading(b.dataset.logw)));
    $$('[data-edit]', el).forEach(b => b.addEventListener('click', () => self.edit(Store.wh(b.dataset.edit))));
    $$('[data-stock]', el).forEach(b => b.addEventListener('click', () => self.stock(b.dataset.stock)));
    // sparklines
    $$('[data-spark]', el).forEach(cv => {
      const w = Store.wh(cv.dataset.spark);
      const logs = db.tempLogs.filter(l => l.whId === w.id).slice(-21);
      UI.chart(cv, {
        type: 'line',
        data: { labels: logs.map(l => fmt.dt(l.ts)), datasets: [
          { data: logs.map(l => l.temp), borderColor: w.type === 'Cold Storage' ? '#0b9bd8' : '#e98a07', backgroundColor: w.type === 'Cold Storage' ? 'rgba(11,155,216,.1)' : 'rgba(233,138,7,.1)', fill: true, tension: .35, borderWidth: 2, pointRadius: logs.map(l => l.ok ? 0 : 4), pointBackgroundColor: '#e5484d' },
          { data: logs.map(() => w.tempMax), borderColor: 'rgba(229,72,77,.5)', borderDash: [4, 4], borderWidth: 1, pointRadius: 0, fill: false },
        ] },
        options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.datasetIndex ? ` Max ${c.raw}°C` : ` ${c.raw}°C` } } }, scales: { x: { display: false }, y: { display: true, grid: UI.grid, border: { display: false }, ticks: { maxTicksLimit: 3, callback: v => v + '°' } } } },
      });
    });
    new UI.DataTable($('#tbl', el), {
      id: 'temps', exportName: 'temperature-log', pageSize: 10, searchable: false,
      rows: () => db.tempLogs.slice().reverse().map(l => ({ ...l })),
      filters: [
        { key: 'wh', label: 'All warehouses', options: db.warehouses.map(w => ({ id: w.id, name: w.name })), test: (r, v) => r.whId === v },
        { key: 'ok', label: 'All readings', options: [{ id: 'bad', name: 'Excursions only' }, { id: 'ok', name: 'Within range' }], test: (r, v) => (v === 'bad' ? !r.ok : r.ok) },
      ],
      columns: [
        { key: 'ts', label: 'Recorded', render: r => fmt.dt(r.ts) },
        { key: 'whId', label: 'Warehouse', render: r => esc(Calc.whName(r.whId)) },
        { key: 'temp', label: 'Temperature', align: 'right', render: r => `<b class="${r.ok ? '' : 'text-danger'}">${r.temp}°C</b>` },
        { key: 'range', label: 'Allowed', sort: false, render: r => { const w = Store.wh(r.whId); return `<span class="muted">${w?.tempMin}–${w?.tempMax}°C</span>`; } },
        { key: 'ok', label: 'Status', render: r => UI.badge(r.ok ? 'OK' : 'Excursion') },
        { key: 'by', label: 'Source', render: r => esc(r.by) },
        { key: 'note', label: 'Note', render: r => `<span class="muted">${esc(r.note || '')}</span>` },
      ],
    });
  },
  logReading(whId) {
    const db = Store.db;
    UI.formModal({
      title: 'Log temperature reading', size: 'sm', submitText: 'Record', submitIcon: 'thermo',
      body: `${UI.field('Warehouse', UI.select('whId', UI.options(db.warehouses, whId)), { req: true })}
        <div class="mt-16">${UI.field('Temperature (°C)', UI.input('temp', '', { type: 'number', step: '0.1', ph: 'e.g. 2.8' }), { req: true })}</div>
        <div class="mt-16">${UI.field('Note', UI.input('note', '', { ph: 'Optional' }))}</div>`,
      onSubmit(form, close) {
        const d = UI.formData(form);
        if (d.temp === null || isNaN(d.temp)) throw new Error('Enter a temperature');
        const ok = Store.logTemp(d);
        close(); UI.toast(ok ? 'Reading recorded — within range' : 'Excursion recorded — alert raised', ok ? 'success' : 'warning'); App.refresh();
      },
    });
  },
  edit(w) {
    const e = w || { type: 'Cold Storage', tempMin: 0, tempMax: 4, capacity: 10000, isPlant: false };
    UI.formModal({
      title: w ? `Edit · ${esc(w.name)}` : 'Add warehouse', size: 'lg',
      body: `<div class="form-grid">
        ${UI.field('Name', UI.input('name', e.name, { ph: 'e.g. Nagpur Cold Hub' }), { req: true, span: true })}
        ${UI.field('Code', UI.input('code', e.code, { ph: 'NGP-HB1' }), { req: true })}
        ${UI.field('Type', UI.select('type', UI.options(['Cold Storage', 'Dry Store', 'Frozen Store', 'Dispatch Bay'], e.type)))}
        ${UI.field('City', UI.input('city', e.city))}
        ${UI.field('State', UI.input('state', e.state || 'Maharashtra'))}
        ${UI.field('Min temp (°C)', UI.input('tempMin', e.tempMin, { type: 'number', step: '0.1' }))}
        ${UI.field('Max temp (°C)', UI.input('tempMax', e.tempMax, { type: 'number', step: '0.1' }))}
        ${UI.field('Capacity (pack units)', UI.input('capacity', e.capacity, { type: 'number', min: 0 }))}
        ${UI.field('Manager', UI.input('manager', e.manager))}
        ${UI.field('Address', UI.input('address', e.address), { span: true })}
        <label class="flex span-2"><input type="checkbox" name="isPlant" ${e.isPlant ? 'checked' : ''}> Located at manufacturing plant (materials can be issued to production from here)</label>
      </div>`,
      onSubmit(form, close) {
        const d = UI.formData(form);
        if (!d.code) throw new Error('Code is required');
        if (w) d.id = w.id; else d.active = true;
        Store.saveWarehouse(d);
        close(); UI.toast(w ? 'Warehouse updated' : 'Warehouse added'); App.refresh();
      },
    });
  },
  stock(whId) {
    const w = Store.wh(whId);
    const db = Store.db;
    const rows = db.items.map(it => ({ it, s: Store.stock(it.id, whId), e: Store.expiredStock(it.id, whId), v: Store.stockValue(it.id, whId) })).filter(x => x.s || x.e).sort((a, b) => b.v - a.v);
    UI.drawer({
      title: esc(w.name), sub: `${esc(w.type)} · ${esc(w.address || w.city)}`,
      body: `<div class="stat-strip">${UI.stat('SKUs', rows.length)}${UI.stat('Value', fmt.compact(rows.reduce((s, x) => s + x.v, 0)))}${UI.stat('Range', `${w.tempMin}–${w.tempMax}°C`)}</div>
        <table class="tbl compact mt-16"><thead><tr><th>Item</th><th class="right">Usable</th><th class="right">Expired</th><th class="right">Value</th></tr></thead><tbody>
        ${rows.map(x => `<tr class="clickable" onclick="location.hash='#/items?id=${x.it.id}'"><td>${UI.itemCell(x.it)}</td><td class="right fw-600">${fmt.qty(x.s, x.it.uom)}</td><td class="right ${x.e ? 'text-danger' : 'muted'}">${fmt.qty(x.e)}</td><td class="right">${fmt.money(x.v)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Empty</td></tr>'}</tbody></table>`,
    });
  },
};

/* ---------------- Stock Adjustments ---------------- */
Pages.adjustments = {
  title: 'Stock Adjustments',
  TYPES: ['Damage', 'Expired', 'Cycle Count', 'QC Sample', 'Pest / Leakage', 'Found Stock'],
  render(el, params) {
    const db = Store.db;
    const self = this;
    const from = Store.addDays(Store.today(), -29);
    const recent = db.adjustments.filter(a => a.date >= from);
    const loss = recent.reduce((s, a) => s + Math.min(0, a.value), 0);
    const byType = {};
    recent.forEach(a => { byType[a.type] = (byType[a.type] || 0) + Math.abs(Math.min(0, a.value)); });
    const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];
    const expiredVal = db.batches.filter(b => Store.batchStatus(b) === 'Expired').reduce((s, b) => s + b.qty * b.cost, 0);
    el.innerHTML = App.head({
      title: 'Stock Adjustments', sub: 'Wastage, damages, expiry write-offs and cycle-count corrections — every change audited',
      actions: `${App.sampleBtn('Generate sample adjustment')}<button class="btn btn-danger" data-wo ${expiredVal ? '' : 'disabled'}>${icon('trash', 'sm')} Write off expired</button><button class="btn btn-primary" data-new>${icon('plus', 'sm')} New adjustment</button>`,
    }) + `<div class="grid grid-4 mb-16">
        ${UI.kpi({ label: 'Write-off value · 30d', value: fmt.compact(-loss), ic: 'trendDown', tone: 'red', foot: `${recent.length} adjustments posted` })}
        ${UI.kpi({ label: 'Top loss reason', value: topType ? esc(topType[0]) : '—', ic: 'pie', tone: 'amber', foot: topType ? fmt.compact(topType[1]) + ' in 30 days' : '' })}
        ${UI.kpi({ label: 'Expired awaiting write-off', value: fmt.compact(expiredVal), ic: 'clock', tone: expiredVal ? 'red' : 'green', foot: 'Across all warehouses' })}
        ${UI.kpi({ label: 'Wastage % of production', value: fmt.pct(-loss / Math.max(1, db.productions.filter(m => m.status === 'Completed' && m.completedAt > Date.now() - 30 * 86400000).reduce((s, m) => s + m.good * m.unitCost, 0)) * 100, 2), ic: 'leaf', tone: 'green', foot: 'Value basis · 30 days' })}
      </div><div id="tbl"></div>`;
    App.bindSample(el, () => Seed.Sample.adjustments(2));
    $('[data-new]', el).addEventListener('click', () => self.create());
    $('[data-wo]', el).addEventListener('click', async () => {
      if (!(await UI.confirm({ title: 'Write off expired stock?', message: `Expired stock worth <b>${fmt.money(expiredVal)}</b> will be written off.`, okText: 'Write off', danger: true }))) return;
      UI.act(() => Store.writeOffExpired(), r => `Posted ${r.length} write-off adjustment(s)`);
    });
    new UI.DataTable($('#tbl', el), {
      id: 'adjustments', exportName: 'adjustments', rows: () => db.adjustments,
      searchText: a => `${a.no} ${a.type} ${a.reason} ${a.by} ${a.lines.map(l => l.batchNo).join(' ')}`,
      filters: [
        { key: 'ty', label: 'All types', options: self.TYPES, test: (r, v) => r.type === v },
        { key: 'wh', label: 'All warehouses', options: db.warehouses.map(w => ({ id: w.id, name: w.name })), test: (r, v) => r.whId === v },
      ],
      onRow: a => self.open(a.id),
      columns: [
        { key: 'no', label: 'Adjustment #', render: a => `<span class="mono fw-600">${a.no}</span>` },
        { key: 'date', label: 'Date', render: a => fmt.date(a.date) },
        { key: 'type', label: 'Type', render: a => UI.badge(a.type, a.value < 0 ? 'red' : 'green') },
        { key: 'whId', label: 'Warehouse', render: a => esc(Calc.whCode(a.whId)) },
        { key: 'reason', label: 'Reason', render: a => `<span class="muted">${esc(a.reason)}</span>` },
        { key: 'lines', label: 'Lines', align: 'right', sort: a => a.lines.length, render: a => a.lines.length },
        { key: 'value', label: 'Value impact', align: 'right', render: a => `<b class="${a.value < 0 ? 'text-danger' : 'text-success'}">${a.value < 0 ? '−' : '+'}${fmt.money(Math.abs(a.value))}</b>` },
        { key: 'by', label: 'Posted by', render: a => esc(a.by || '') },
      ],
    });
    if (params.id) self.open(params.id);
  },
  open(id) {
    const a = Store.byId('adjustments', id);
    UI.drawer({
      title: a.no, badge: UI.badge(a.type, a.value < 0 ? 'red' : 'green'), sub: `${fmt.date(a.date)} · ${esc(Calc.whName(a.whId))} · by ${esc(a.by || '')}`,
      body: `<dl class="dl"><dt>Reason</dt><dd>${esc(a.reason || '—')}</dd><dt>Value impact</dt><dd class="${a.value < 0 ? 'text-danger' : 'text-success'}">${fmt.money(a.value, 2)}</dd></dl>
        <div class="section-title">Lines</div><table class="tbl compact"><thead><tr><th>Item</th><th>Batch</th><th class="right">Qty change</th><th class="right">Value</th></tr></thead><tbody>
        ${a.lines.map(l => { const it = Store.item(l.itemId); return `<tr><td>${esc(it?.name)}</td><td class="mono">${esc(l.batchNo)}</td><td class="right fw-600 ${l.qty < 0 ? 'text-danger' : 'text-success'}">${l.qty > 0 ? '+' : ''}${fmt.qty(l.qty, it?.uom)}</td><td class="right">${fmt.money(l.qty * l.cost, 2)}</td></tr>`; }).join('')}</tbody></table>`,
    });
  },
  create(pre = {}) {
    const db = Store.db;
    const state = { whId: pre.whId || db.warehouses[0].id, lines: pre.lines ? pre.lines.map(l => ({ ...l })) : [{ batchId: '', qty: -1 }] };
    const batchOpts = (l) => {
      const list = db.batches.filter(b => b.whId === state.whId && (b.qty > 0 || b.id === l.batchId)).sort((a, b) => Store.item(a.itemId).name.localeCompare(Store.item(b.itemId).name));
      return UI.options(list, l.batchId, { placeholder: 'Select batch…', label: b => `${Store.item(b.itemId).name} · ${b.batchNo} · ${fmt.qty(b.qty)} ${Store.item(b.itemId).uom}${Store.isUsable(b) ? '' : ' (EXPIRED)'}` });
    };
    let editor;
    UI.formModal({
      title: 'New stock adjustment', size: 'lg', submitText: 'Post adjustment',
      body: `<div class="form-grid-3">
          ${UI.field('Warehouse', UI.select('whId', UI.options(db.warehouses, state.whId)), { req: true })}
          ${UI.field('Adjustment type', UI.select('type', UI.options(this.TYPES, pre.type || 'Damage')), { req: true })}
          ${UI.field('Date', UI.input('date', Store.today(), { type: 'date' }))}
        </div>
        <div class="mt-16">${UI.field('Reason / remarks', UI.input('reason', pre.reason || '', { ph: 'e.g. Pouch puncture during handling' }))}</div>
        <div class="section-title">Batches <span class="muted" style="text-transform:none;font-weight:500;letter-spacing:0">— negative to reduce, positive to add</span></div><div id="lines"></div>`,
      onMount(m, close, form) {
        editor = UI.lineEditor($('#lines', m), {
          lines: state.lines, blank: () => ({ batchId: '', qty: -1 }), addLabel: 'Add batch',
          columns: [
            { key: 'batchId', label: 'Batch', type: 'select', options: l => batchOpts(l), rerender: true },
            { key: 'onhand', label: 'On hand', width: '110px', align: 'right', render: l => { const b = Store.byId('batches', l.batchId); return b ? fmt.qty(b.qty) : '—'; } },
            { key: 'qty', label: 'Change (±)', type: 'number', width: '120px' },
            { key: 'after', label: 'After', width: '100px', align: 'right', render: l => { const b = Store.byId('batches', l.batchId); if (!b) return '—'; const v = b.qty + (l.qty || 0); return `<b class="${v < 0 ? 'text-danger' : ''}">${fmt.qty(v)}</b>`; } },
          ],
        });
        form.whId.addEventListener('change', () => { state.whId = form.whId.value; state.lines.splice(0, state.lines.length, { batchId: '', qty: -1 }); editor.render(); });
      },
      onSubmit(form, close) {
        const d = UI.formData(form);
        const adj = Store.createAdjustment({ ...d, lines: state.lines });
        close(); UI.toast(`${adj.no} posted — stock updated`); App.refresh();
      },
    });
  },
};

/* ---------------- Stock Transfers ---------------- */
Pages.transfers = {
  title: 'Stock Transfers',
  render(el, params) {
    const db = Store.db;
    const self = this;
    const transit = db.transfers.filter(t => t.status === 'In Transit');
    const units = t => t.lines.reduce((s, l) => s + l.qty, 0);
    el.innerHTML = App.head({
      title: 'Stock Transfers', sub: 'Reefer movements between plant and distribution hubs — FEFO batches move with full lot identity',
      actions: `${App.sampleBtn('Generate sample transfer')}<button class="btn btn-primary" data-new>${icon('plus', 'sm')} New transfer</button>`,
    }) + `<div class="grid grid-4 mb-16">
        ${UI.kpi({ label: 'In transit', value: transit.length, ic: 'truck', tone: 'violet', foot: `${fmt.num(transit.reduce((s, t) => s + units(t), 0))} packs on the road` })}
        ${UI.kpi({ label: 'Transfers · 30d', value: db.transfers.filter(t => t.date >= Store.addDays(Store.today(), -29)).length, ic: 'transfer', tone: 'blue', foot: 'Plant → hubs' })}
        ${UI.kpi({ label: 'Units moved · 30d', value: fmt.num(db.transfers.filter(t => t.date >= Store.addDays(Store.today(), -29)).reduce((s, t) => s + units(t), 0)), ic: 'box', tone: 'cyan', foot: 'Finished goods' })}
        ${UI.kpi({ label: 'Avg transit time', value: (() => { const done = db.transfers.filter(t => t.receivedAt).slice(0, 40); return done.length ? (done.reduce((s, t) => s + (t.receivedAt - t.createdAt), 0) / done.length / 3600000).toFixed(1) + ' h' : '—'; })(), ic: 'clock', tone: 'green', foot: 'Dispatch to receipt' })}
      </div><div id="tbl"></div>`;
    App.bindSample(el, () => Seed.Sample.transfers(1));
    $('[data-new]', el).addEventListener('click', () => self.create());
    new UI.DataTable($('#tbl', el), {
      id: 'transfers', exportName: 'transfers', rows: () => db.transfers,
      searchText: t => `${t.no} ${Calc.whName(t.from)} ${Calc.whName(t.to)} ${t.vehicle} ${t.lines.map(l => l.batchNo).join(' ')}`,
      filters: [{ key: 'st', label: 'All statuses', options: ['In Transit', 'Completed'], test: (r, v) => r.status === v }],
      onRow: t => self.open(t.id),
      columns: [
        { key: 'no', label: 'Transfer #', render: t => `<span class="mono fw-600">${t.no}</span>` },
        { key: 'date', label: 'Date', render: t => fmt.date(t.date) },
        { key: 'route', label: 'Route', sort: t => Calc.whCode(t.to), render: t => `<span class="chip">${esc(Calc.whCode(t.from))}</span> → <span class="chip">${esc(Calc.whCode(t.to))}</span>` },
        { key: 'lines', label: 'Batches', align: 'right', sort: t => t.lines.length, render: t => t.lines.length },
        { key: 'units', label: 'Units', align: 'right', sort: units, render: t => fmt.num(units(t)) },
        { key: 'vehicle', label: 'Vehicle', render: t => `<span class="muted">${esc(t.vehicle || '—')}</span>` },
        { key: 'status', label: 'Status', render: t => UI.badge(t.status) },
        { key: 'act', label: '', sort: false, csv: false, render: t => t.status === 'In Transit' ? `<button class="btn btn-sm btn-success" data-recv="${t.id}">${icon('check', 'sm')} Receive</button>` : '' },
      ],
      afterDraw: body => $$('[data-recv]', body).forEach(b => b.addEventListener('click', () => UI.act(() => Store.receiveTransfer(b.dataset.recv), 'Transfer received at destination'))),
    });
    if (params.id) self.open(params.id);
  },
  open(id) {
    const t = Store.byId('transfers', id);
    UI.drawer({
      title: t.no, badge: UI.badge(t.status), sub: `${esc(Calc.whName(t.from))} → ${esc(Calc.whName(t.to))}`,
      body: `<dl class="dl"><dt>Dispatched</dt><dd>${fmt.dt(t.createdAt)} by ${esc(t.by || '')}</dd><dt>Vehicle</dt><dd>${esc(t.vehicle || '—')}</dd>${t.receivedAt ? `<dt>Received</dt><dd>${fmt.dt(t.receivedAt)}</dd>` : ''}<dt>Notes</dt><dd>${esc(t.notes || '—')}</dd></dl>
        <div class="section-title">Batches</div><table class="tbl compact"><thead><tr><th>Item</th><th>Batch</th><th>Expiry</th><th class="right">Qty</th></tr></thead><tbody>
        ${t.lines.map(l => `<tr><td>${esc(Store.item(l.itemId)?.name)}</td><td class="mono">${esc(l.batchNo)}</td><td>${fmt.date(l.exp)}</td><td class="right fw-600">${fmt.qty(l.qty)}</td></tr>`).join('')}</tbody></table>`,
      foot: t.status === 'In Transit' ? `<button class="btn btn-success" data-recv>${icon('check', 'sm')} Receive at ${esc(Calc.whCode(t.to))}</button>` : '',
      onMount(dr, close) { $('[data-recv]', dr)?.addEventListener('click', () => { if (UI.act(() => { Store.receiveTransfer(id); return true; }, 'Transfer received')) close(); }); },
    });
  },
  create(pre = {}) {
    const db = Store.db;
    const src = pre.from || db.warehouses.find(w => w.isPlant && w.type === 'Cold Storage')?.id || db.warehouses[0].id;
    const state = { from: src, lines: pre.lines ? pre.lines.map(l => ({ ...l })) : [{ itemId: '', qty: 0 }] };
    let editor;
    const itemOpts = l => UI.options(db.items.filter(i => Store.stock(i.id, state.from) > 0 || i.id === l.itemId), l.itemId, { placeholder: 'Select item…', label: i => `${i.name} (${fmt.qty(Store.stock(i.id, state.from))} avail.)` });
    UI.formModal({
      title: 'New stock transfer', size: 'lg', submitText: 'Dispatch transfer', submitIcon: 'truck',
      body: `<div class="form-grid">
          ${UI.field('From warehouse', UI.select('from', UI.options(db.warehouses, state.from)), { req: true })}
          ${UI.field('To warehouse', UI.select('to', UI.options(db.warehouses.filter(w => w.id !== state.from), pre.to, { placeholder: 'Select destination…' })), { req: true })}
          ${UI.field('Vehicle / reefer', UI.input('vehicle', '', { ph: 'MH12 AB 1234 (Reefer)' }))}
          ${UI.field('Date', UI.input('date', Store.today(), { type: 'date' }))}
        </div>
        <div class="alert info mt-16">${icon('info', 'sm')}<div>Batches are picked automatically using <b>FEFO</b> — the earliest-expiring usable lots leave first.</div></div>
        <div id="lines"></div>`,
      onMount(m, close, form) {
        editor = UI.lineEditor($('#lines', m), {
          lines: state.lines, blank: () => ({ itemId: '', qty: 0 }), addLabel: 'Add item',
          columns: [
            { key: 'itemId', label: 'Item', type: 'select', options: itemOpts, rerender: true },
            { key: 'avail', label: 'Available', width: '110px', align: 'right', render: l => l.itemId ? fmt.qty(Store.stock(l.itemId, state.from)) : '—' },
            { key: 'qty', label: 'Qty', type: 'number', width: '110px', min: 0 },
            { key: 'pick', label: 'FEFO picks', width: '200px', render: l => { if (!l.itemId || !(l.qty > 0)) return '—'; try { return Store.allocate(l.itemId, state.from, l.qty).map(p => `<span class="chip mono" style="margin:1px">${esc(p.batch.batchNo)} × ${fmt.qty(p.qty)}</span>`).join(''); } catch (e) { return `<span class="small text-danger">Insufficient</span>`; } } },
          ],
        });
        form.from.addEventListener('change', () => {
          state.from = form.from.value;
          form.to.innerHTML = UI.options(db.warehouses.filter(w => w.id !== state.from), '', { placeholder: 'Select destination…' });
          state.lines.splice(0, state.lines.length, { itemId: '', qty: 0 }); editor.render();
        });
      },
      onSubmit(form, close) {
        const d = UI.formData(form);
        const valid = state.lines.filter(l => l.itemId && l.qty > 0);
        if (!valid.length) throw new Error('Add at least one item with quantity');
        const batchLines = valid.flatMap(l => Store.allocate(l.itemId, d.from, l.qty).map(p => ({ batchId: p.batch.id, qty: p.qty })));
        const tr = Store.createTransfer({ ...d, lines: batchLines });
        close(); UI.toast(`${tr.no} dispatched — ${batchLines.length} batch line(s) in transit`); App.refresh();
      },
    });
  },
};
