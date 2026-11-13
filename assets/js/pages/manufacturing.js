/* ==========================================================================
   Manufacturing: Production Orders & Recipes (BOM)
   ========================================================================== */
Pages.production = {
  title: 'Production Orders',
  render(el, params) {
    const db = Store.db;
    const self = this;
    const since = Date.now() - 30 * 86400000;
    const done = db.productions.filter(m => m.status === 'Completed' && m.completedAt >= since);
    const good = done.reduce((s, m) => s + m.good, 0), rej = done.reduce((s, m) => s + m.rejected, 0);
    const kg = done.reduce((s, m) => s + m.good * (Store.item(m.itemId)?.weightKg || 0), 0);
    const kg7 = Calc.productionKgByDay(7);
    const cap = db.company.capacityKg || 1000;
    el.innerHTML = App.head({
      title: 'Production Orders', sub: 'Plan → issue materials (FEFO) → QC → release finished batches',
      actions: `${App.sampleBtn('Plan sample production')}<button class="btn btn-primary" data-new>${icon('plus', 'sm')} New production order</button>`,
    }) + `<div class="grid grid-4 mb-16">
        ${UI.kpi({ label: 'Planned', value: db.productions.filter(m => m.status === 'Planned').length, ic: 'calendar', tone: 'blue', foot: 'Awaiting material issue' })}
        ${UI.kpi({ label: 'In progress', value: db.productions.filter(m => m.status === 'In Progress').length, ic: 'factory', tone: 'amber', foot: 'On the shop floor' })}
        ${UI.kpi({ label: 'Output · 30 days', value: fmt.num(good) + ' <span style="font-size:14px;color:var(--muted);font-weight:500">packs</span>', ic: 'box', tone: 'violet', foot: `${fmt.num(kg)} kg · ${done.length} batches released` })}
        ${UI.kpi({ label: 'First-pass yield', value: fmt.pct(good / Math.max(1, good + rej) * 100), ic: 'checkCircle', tone: 'green', foot: `${fmt.num(rej)} packs rejected at QC` })}
      </div>
      <div class="card mb-16"><div class="card-head"><div><div class="card-title">Plant output vs capacity</div><div class="card-sub">Kg produced per day — capacity ${fmt.num(cap)} kg/day · 7-day avg utilisation ${fmt.pct(kg7.reduce((s, x) => s + x.v, 0) / 7 / cap * 100, 0)}</div></div></div>
        <div class="card-body"><div class="chart-box sm"><canvas id="c-out"></canvas></div></div></div>
      <div id="tbl"></div>`;
    App.bindSample(el, () => Seed.Sample.production(2));
    $('[data-new]', el).addEventListener('click', () => self.create());
    const series = Calc.productionKgByDay(21);
    const cv = $('#c-out', el);
    UI.chart(cv, {
      data: { labels: series.map(x => fmt.short(x.d)), datasets: [
        { type: 'bar', label: 'Output (kg)', data: series.map(x => Math.round(x.v)), backgroundColor: UI.gradient(cv.getContext('2d'), 'rgba(18,164,107,.9)', 'rgba(18,164,107,.35)'), borderRadius: 5, maxBarThickness: 22 },
        { type: 'line', label: 'Capacity', data: series.map(() => cap), borderColor: '#e5484d', borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0 },
      ] },
      options: { plugins: { legend: { position: 'top', align: 'end' } }, scales: { x: { grid: { display: false } }, y: { grid: UI.grid, border: { display: false }, beginAtZero: true } } },
    });
    new UI.DataTable($('#tbl', el), {
      id: 'production', exportName: 'production-orders', rows: () => db.productions,
      searchText: m => `${m.no} ${Store.item(m.itemId)?.name} ${m.batchNo || ''} ${m.status}`,
      filters: [
        { key: 'st', label: 'All statuses', value: params.f || '', options: ['Planned', 'In Progress', 'Completed', 'Cancelled'], test: (r, v) => r.status === v },
        { key: 'it', label: 'All products', options: db.items.filter(i => i.type === 'finished'), test: (r, v) => r.itemId === v },
      ],
      onRow: m => self.open(m.id),
      columns: [
        { key: 'no', label: 'Order #', render: m => `<span class="mono fw-600">${m.no}</span>` },
        { key: 'date', label: 'Date / shift', render: m => `${fmt.date(m.date)}<div class="cell-sub">${esc(m.shift)} shift</div>` },
        { key: 'item', label: 'Product', sort: m => Store.item(m.itemId)?.name, render: m => UI.itemCell(Store.item(m.itemId)) },
        { key: 'qty', label: 'Planned', align: 'right', render: m => fmt.num(m.qty) },
        { key: 'good', label: 'Good / Rejected', align: 'right', render: m => m.status === 'Completed' ? `<b class="text-success">${fmt.num(m.good)}</b> / <span class="${m.rejected ? 'text-danger' : 'muted'}">${fmt.num(m.rejected)}</span>` : '<span class="muted">—</span>' },
        { key: 'batchNo', label: 'Output batch', render: m => m.batchNo ? `<span class="mono">${esc(m.batchNo)}</span>` : '<span class="muted">—</span>' },
        { key: 'unitCost', label: 'Unit cost', align: 'right', render: m => m.unitCost ? fmt.money(m.unitCost, 2) : '<span class="muted">—</span>' },
        { key: 'status', label: 'Status', render: m => UI.badge(m.status) },
        { key: 'act', label: '', sort: false, csv: false, render: m => m.status === 'Planned' ? `<button class="btn btn-sm btn-soft" data-start="${m.id}">${icon('play', 'sm')} Start</button>` : m.status === 'In Progress' ? `<button class="btn btn-sm btn-success" data-done="${m.id}">${icon('check', 'sm')} Complete</button>` : '' },
      ],
      afterDraw: body => {
        $$('[data-start]', body).forEach(b => b.addEventListener('click', () => UI.act(() => Store.startMO(b.dataset.start), 'Materials issued — production started')));
        $$('[data-done]', body).forEach(b => b.addEventListener('click', () => self.complete(b.dataset.done)));
      },
    });
    if (params.id) self.open(params.id);
  },
  open(id) {
    const m = Store.byId('productions', id); if (!m) return;
    const it = Store.item(m.itemId);
    const self = this;
    const reqs = m.status === 'Planned' ? Store.requirements(m.itemId, m.qty) : [];
    const matCost = m.consumed.reduce((s, c) => s + c.qty * c.cost, 0);
    UI.drawer({
      title: m.no, badge: UI.badge(m.status), sub: `${esc(it.name)} · ${fmt.num(m.qty)} packs · ${fmt.date(m.date)} (${esc(m.shift)})`,
      body: `<div class="stat-strip">${UI.stat('Planned qty', fmt.num(m.qty))}${UI.stat('Output (kg)', fmt.num(m.qty * (it.weightKg || 0)))}${m.status === 'Completed' ? UI.stat('Good', fmt.num(m.good)) + UI.stat('Yield', fmt.pct(m.good / (m.good + m.rejected) * 100)) : ''}${matCost ? UI.stat('Material cost', fmt.money(matCost)) : ''}</div>
        <dl class="dl mt-16"><dt>Output warehouse</dt><dd>${esc(Calc.whName(m.whId))}</dd><dt>Created by</dt><dd>${esc(m.createdBy || '—')} · ${fmt.dt(m.createdAt)}</dd>${m.startedAt ? `<dt>Started</dt><dd>${fmt.dt(m.startedAt)}</dd>` : ''}${m.completedAt ? `<dt>Completed</dt><dd>${fmt.dt(m.completedAt)}</dd><dt>Output batch</dt><dd><a class="mono" href="#/batches?id=${m.batchId}">${esc(m.batchNo)}</a> · expires ${fmt.date(Store.byId('batches', m.batchId)?.exp)}</dd>` : ''}${m.notes ? `<dt>Notes</dt><dd>${esc(m.notes)}</dd>` : ''}</dl>
        ${m.status === 'Planned' ? `<div class="section-title">Material requirements</div><table class="tbl compact"><thead><tr><th>Material</th><th class="right">Required</th><th class="right">Available</th><th></th></tr></thead><tbody>
          ${reqs.map(r => { const ri = Store.item(r.itemId); return `<tr><td>${esc(ri.name)}</td><td class="right">${fmt.qty(r.qty, ri.uom)}</td><td class="right">${fmt.qty(r.available, ri.uom)}</td><td>${r.ok ? UI.badge('OK') : UI.badge('Short', 'red')}</td></tr>`; }).join('')}</tbody></table>
          ${reqs.some(r => !r.ok) ? `<div class="alert warn mt-16">${icon('alert', 'sm')}<div>Material shortage — raise a purchase order before starting.</div></div>` : ''}` : ''}
        ${m.consumed.length ? `<div class="section-title">Materials issued (FEFO lots)</div><table class="tbl compact"><thead><tr><th>Material</th><th>Lot</th><th class="right">Qty</th><th class="right">Cost</th></tr></thead><tbody>
          ${m.consumed.map(c => { const ri = Store.item(c.itemId); const b = Store.byId('batches', c.batchId); return `<tr><td>${esc(ri?.name)}</td><td class="mono">${esc(b?.batchNo || '')}</td><td class="right">${fmt.qty(c.qty, ri?.uom)}</td><td class="right">${fmt.money(c.qty * c.cost, 2)}</td></tr>`; }).join('')}</tbody></table>` : ''}
        ${m.qc && m.status === 'Completed' ? `<div class="section-title">Quality control</div><dl class="dl"><dt>pH</dt><dd>${m.qc.ph ?? '—'}</dd><dt>Core temperature</dt><dd>${m.qc.coreTemp ?? '—'} °C</dd><dt>Moisture</dt><dd>${m.qc.moisture ?? '—'} %</dd><dt>Appearance / texture</dt><dd>${UI.badge(m.qc.appearance === 'OK' ? 'Passed' : m.qc.appearance || '—')}</dd><dt>Microbiology</dt><dd>${UI.badge(m.qc.micro === 'Pass' ? 'Passed' : m.qc.micro || '—')}</dd><dt>Inspector</dt><dd>${esc(m.qc.inspector || '—')}</dd></dl>` : ''}`,
      foot: `${['Planned', 'In Progress'].includes(m.status) ? `<button class="btn btn-danger" data-cancel>${icon('x', 'sm')} Cancel order</button>` : ''}<div class="grow"></div>
        ${m.status === 'Planned' ? `<button class="btn btn-primary" data-start>${icon('play', 'sm')} Issue materials & start</button>` : ''}
        ${m.status === 'In Progress' ? `<button class="btn btn-success" data-done>${icon('check', 'sm')} Record QC & complete</button>` : ''}`,
      onMount(dr, close) {
        $('[data-start]', dr)?.addEventListener('click', () => { if (UI.act(() => Store.startMO(id), 'Materials issued (FEFO) — production started')) self.open(id); });
        $('[data-done]', dr)?.addEventListener('click', () => { close(); self.complete(id); });
        $('[data-cancel]', dr)?.addEventListener('click', async () => {
          if (!(await UI.confirm({ title: 'Cancel production order?', message: m.status === 'In Progress' ? 'Issued materials will be returned to their original lots.' : 'The plan will be cancelled.', okText: 'Cancel order', danger: true }))) return;
          if (UI.act(() => { Store.cancelMO(id); return true; }, 'Production order cancelled')) close();
        });
      },
    });
  },
  complete(id) {
    const m = Store.byId('productions', id);
    const it = Store.item(m.itemId);
    UI.formModal({
      title: `Complete ${m.no} · QC release`, size: 'lg', submitText: 'Release batch', submitIcon: 'checkCircle',
      body: `<div class="alert info">${icon('info', 'sm')}<div>${esc(it.name)} — planned <b>${fmt.num(m.qty)}</b> packs. A new batch will be created in <b>${esc(Calc.whName(m.whId))}</b> with expiry ${fmt.date(Store.addDays(Store.today(), it.shelfLife || 0))} (${it.shelfLife} days shelf life).</div></div>
        <div class="form-grid-3 mt-16">
          ${UI.field('Good packs', UI.input('good', m.qty, { type: 'number', min: 0 }), { req: true })}
          ${UI.field('Rejected packs', UI.input('rejected', 0, { type: 'number', min: 0 }))}
          ${UI.field('Inspector', UI.input('inspector', 'QA – Meera Kulkarni'))}
          ${UI.field('pH', UI.input('ph', '6.0', { type: 'number', step: '0.1' }))}
          ${UI.field('Core temp (°C)', UI.input('coreTemp', '3.0', { type: 'number', step: '0.1' }))}
          ${UI.field('Moisture (%)', UI.input('moisture', '81', { type: 'number', step: '0.1' }))}
          ${UI.field('Appearance / texture', UI.select('appearance', UI.options(['OK', 'Failed'], 'OK')))}
          ${UI.field('Microbiology', UI.select('micro', UI.options(['Pass', 'Pending', 'Fail'], 'Pass')))}
          ${UI.field('Remarks', UI.input('notes', ''))}
        </div>`,
      onSubmit(form, close) {
        const d = UI.formData(form);
        if (d.appearance === 'Failed' || d.micro === 'Fail') throw new Error('QC failed — batch cannot be released. Record the output as rejected or cancel the order.');
        if ((d.good || 0) + (d.rejected || 0) > m.qty * 1.05) throw new Error('Output exceeds planned quantity by more than 5%');
        const r = Store.completeMO(id, { good: d.good, rejected: d.rejected || 0, notes: d.notes, qc: { ph: d.ph, coreTemp: d.coreTemp, moisture: d.moisture, appearance: d.appearance, micro: d.micro, inspector: d.inspector } });
        close(); UI.toast(`Batch ${r.batchNo} released to stock`); App.refresh(); Pages.production.open(id);
      },
    });
  },
  create(pre = {}) {
    const db = Store.db;
    const fgs = db.items.filter(i => i.type === 'finished' && i.active && Store.bomFor(i.id));
    const plants = db.warehouses.filter(w => w.isPlant);
    const defWh = plants.find(w => w.type === 'Cold Storage')?.id || plants[0]?.id;
    UI.formModal({
      title: 'New production order', size: 'lg', submitText: 'Create order',
      body: `<div class="form-grid">
          ${UI.field('Product', UI.select('itemId', UI.options(fgs, pre.itemId, { placeholder: 'Select product…' })), { req: true, span: true })}
          ${UI.field('Quantity (packs)', UI.input('qty', pre.qty || '', { type: 'number', min: 1, ph: 'e.g. 1200' }), { req: true })}
          ${UI.field('Output warehouse', UI.select('whId', UI.options(plants, defWh)))}
          ${UI.field('Production date', UI.input('date', Store.today(), { type: 'date' }))}
          ${UI.field('Shift', UI.select('shift', UI.options(['Morning', 'Evening', 'Night'], 'Morning')))}
          ${UI.field('Notes', UI.input('notes', ''), { span: true })}
        </div><div id="req" class="mt-16"></div>`,
      onMount(m, close, form) {
        const draw = () => {
          const id = form.itemId.value, q = parseFloat(form.qty.value) || 0;
          const box = $('#req', m);
          if (!id || !q) { box.innerHTML = `<div class="alert info">${icon('info', 'sm')}<div>Select a product and quantity to see material requirements from its recipe.</div></div>`; return; }
          const it = Store.item(id), reqs = Store.requirements(id, q);
          const cost = reqs.reduce((s, r) => s + r.qty * Store.item(r.itemId).cost, 0);
          const kg = q * (it.weightKg || 0), cap = db.company.capacityKg || 1000;
          box.innerHTML = `<div class="stat-strip">${UI.stat('Output weight', fmt.num(kg) + ' kg')}${UI.stat('Capacity used', fmt.pct(kg / cap * 100, 0))}${UI.stat('Material cost', fmt.money(cost))}${UI.stat('Cost / pack', fmt.money(cost / q + (it.convCost || 0), 2))}</div>
            <table class="tbl compact mt-16"><thead><tr><th>Material</th><th class="right">Required</th><th class="right">Available at plant</th><th></th></tr></thead><tbody>
            ${reqs.map(r => { const ri = Store.item(r.itemId); return `<tr><td>${esc(ri.name)}</td><td class="right">${fmt.qty(r.qty, ri.uom)}</td><td class="right">${fmt.qty(r.available, ri.uom)}</td><td>${r.ok ? UI.badge('OK') : UI.badge('Short', 'red')}</td></tr>`; }).join('')}</tbody></table>
            ${reqs.some(r => !r.ok) ? `<div class="alert warn mt-16">${icon('alert', 'sm')}<div>Some materials are short. You can still plan the order, but it can't start until stock is received.</div></div>` : ''}`;
        };
        form.itemId.addEventListener('change', draw); form.qty.addEventListener('input', draw); draw();
      },
      onSubmit(form, close) {
        const d = UI.formData(form);
        const mo = Store.createMO(d);
        close(); UI.toast(`${mo.no} planned`); App.refresh(); Pages.production.open(mo.id);
      },
    });
  },
};

/* ---------------- Recipes (BOM) ---------------- */
Pages.recipes = {
  title: 'Recipes (BOM)',
  render(el) {
    const db = Store.db;
    const self = this;
    const fgs = db.items.filter(i => i.type === 'finished');
    const without = fgs.filter(i => !Store.bomFor(i.id));
    const costOf = bom => bom.lines.reduce((s, l) => s + l.qty * (Store.item(l.itemId)?.cost || 0), 0) / (bom.outputQty || 1);
    el.innerHTML = App.head({
      title: 'Recipes (Bill of Materials)', sub: 'Standard formulations drive material planning, costing and FEFO issue',
      actions: `<button class="btn btn-primary" data-new ${without.length ? '' : 'disabled'}>${icon('plus', 'sm')} New recipe</button>`,
    }) + (without.length ? `<div class="alert warn">${icon('alert', 'sm')}<div>${without.length} product(s) without a recipe: ${without.map(i => `<b>${esc(i.name)}</b>`).join(', ')}. Production can't be planned until a recipe exists.</div></div>` : '') +
      `<div class="grid grid-3">${db.boms.map(b => {
        const it = Store.item(b.itemId); if (!it) return '';
        const mc = costOf(b), std = mc + (it.convCost || 0), margin = it.price ? (it.price - std) / it.price * 100 : 0;
        return `<div class="card clickable" style="cursor:pointer" data-bom="${b.id}"><div class="card-body">
          <div class="flex-between">${UI.itemCell(it, esc(it.packSize || it.sku))}${UI.badge(fmt.pct(margin, 0) + ' margin', margin > 40 ? 'green' : margin > 25 ? 'amber' : 'red')}</div>
          <div class="stat-strip mt-16">${UI.stat('Components', b.lines.length)}${UI.stat('Material / pack', fmt.money(mc, 2))}${UI.stat('Std cost', fmt.money(std, 2))}</div>
          <div class="flex mt-16" style="flex-wrap:wrap;gap:6px">${b.lines.slice(0, 5).map(l => `<span class="chip">${esc(Store.item(l.itemId)?.name.split(' ').slice(0, 2).join(' '))}</span>`).join('')}${b.lines.length > 5 ? `<span class="chip">+${b.lines.length - 5}</span>` : ''}</div>
        </div></div>`;
      }).join('')}</div>`;
    $('[data-new]', el)?.addEventListener('click', () => self.edit());
    $$('[data-bom]', el).forEach(c => c.addEventListener('click', () => self.edit(Store.byId('boms', c.dataset.bom))));
  },
  edit(bom) {
    const db = Store.db;
    const comps = db.items.filter(i => i.type !== 'finished');
    const state = { lines: bom ? bom.lines.map(l => ({ ...l })) : [{ itemId: '', qty: 0 }] };
    const fgOpts = db.items.filter(i => i.type === 'finished' && (!Store.bomFor(i.id) || i.id === bom?.itemId));
    let form;
    const totals = () => {
      const t = state.lines.reduce((s, l) => s + (l.qty || 0) * (Store.item(l.itemId)?.cost || 0), 0);
      const out = parseFloat(form?.outputQty?.value) || 1;
      const it = Store.item(form?.itemId?.value);
      $('#bom-tot').innerHTML = `<div class="totals"><div class="r"><span>Material cost / pack</span><b>${fmt.money(t / out, 2)}</b></div><div class="r"><span>Conversion cost</span><span>${fmt.money(it?.convCost || 0, 2)}</span></div><div class="r big"><span>Standard cost</span><span>${fmt.money(t / out + (it?.convCost || 0), 2)}</span></div>${it?.price ? `<div class="r"><span>Margin at ${fmt.money(it.price)}</span><b class="text-success">${fmt.pct((it.price - t / out - (it.convCost || 0)) / it.price * 100)}</b></div>` : ''}</div>`;
    };
    UI.formModal({
      title: bom ? `Recipe · ${esc(Store.item(bom.itemId).name)}` : 'New recipe', size: 'lg', submitText: 'Save recipe',
      body: `<div class="form-grid-3">
          ${UI.field('Finished product', UI.select('itemId', UI.options(fgOpts, bom?.itemId, { placeholder: 'Select…' }), bom ? 'disabled' : ''), { req: true })}
          ${UI.field('Output quantity', UI.input('outputQty', bom?.outputQty || 1, { type: 'number', min: 1 }), { hint: 'Packs produced by this recipe' })}
          ${UI.field('Expected yield (%)', UI.input('yieldPct', bom?.yieldPct || 98, { type: 'number', min: 1, step: '0.1' }))}
        </div>
        <div class="mt-16">${UI.field('Notes', UI.input('notes', bom?.notes || ''))}</div>
        <div class="section-title">Components</div><div id="lines"></div><div id="bom-tot"></div>`,
      onMount(m, close, f) {
        form = f;
        UI.lineEditor($('#lines', m), {
          lines: state.lines, blank: () => ({ itemId: '', qty: 0 }), addLabel: 'Add component', onChange: totals,
          columns: [
            { key: 'itemId', label: 'Material / packaging', type: 'select', options: l => UI.options(comps, l.itemId, { placeholder: 'Select…', label: i => `${i.name} (${i.uom})` }), rerender: true },
            { key: 'qty', label: 'Qty per output', type: 'number', width: '130px', step: '0.001' },
            { key: 'uom', label: 'UOM', width: '60px', render: l => esc(Store.item(l.itemId)?.uom || '') },
            { key: 'cost', label: 'Cost', width: '100px', align: 'right', render: l => fmt.money((l.qty || 0) * (Store.item(l.itemId)?.cost || 0), 2) },
          ],
        });
        f.itemId.addEventListener('change', totals); f.outputQty.addEventListener('input', totals);
        totals();
      },
      onSubmit(f, close) {
        const d = UI.formData(f);
        Store.saveBom({ id: bom?.id, itemId: bom?.itemId || d.itemId, outputQty: d.outputQty || 1, yieldPct: d.yieldPct, notes: d.notes, lines: state.lines.filter(l => l.itemId && l.qty > 0) });
        close(); UI.toast('Recipe saved'); App.refresh();
      },
    });
  },
};
