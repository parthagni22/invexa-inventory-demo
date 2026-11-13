/* Shared calculations used by several modules */
const Calc = {
  isSold: s => ['Dispatched', 'Delivered'].includes(s.status),
  soDate: s => s.dispatchDate || s.date,
  /** taxable (net of discount, ex-GST) revenue per SO */
  net(s) { const t = Store.soTotals(s); return t.sub - t.disc; },
  salesInRange(fromIso, toIso) {
    return Store.db.salesOrders.filter(s => Calc.isSold(s) && Calc.soDate(s) >= fromIso && Calc.soDate(s) <= toIso);
  },
  dailySeries(days, fn) {
    const out = [];
    const t = Store.today();
    for (let i = days - 1; i >= 0; i--) { const d = Store.addDays(t, -i); out.push({ d, v: fn(d) }); }
    return out;
  },
  revenueByDay(days) {
    const map = {};
    const from = Store.addDays(Store.today(), -(days - 1));
    for (const s of Calc.salesInRange(from, Store.today())) { const d = Calc.soDate(s); map[d] = (map[d] || 0) + Calc.net(s); }
    return Calc.dailySeries(days, d => map[d] || 0);
  },
  productionByDay(days) {
    const map = {};
    for (const m of Store.db.productions) if (m.status === 'Completed') { const d = Store.isoOf(m.completedAt); map[d] = (map[d] || 0) + m.good; }
    return Calc.dailySeries(days, d => map[d] || 0);
  },
  productionKgByDay(days) {
    const map = {};
    for (const m of Store.db.productions) if (m.status === 'Completed') { const d = Store.isoOf(m.completedAt); map[d] = (map[d] || 0) + m.good * (Store.item(m.itemId)?.weightKg || 0); }
    return Calc.dailySeries(days, d => map[d] || 0);
  },
  unitsSoldByItem(days) {
    const from = Store.addDays(Store.today(), -(days - 1));
    const m = {};
    for (const s of Calc.salesInRange(from, Store.today())) for (const l of s.lines) {
      const r = (m[l.itemId] = m[l.itemId] || { qty: 0, rev: 0 });
      r.qty += l.qty; r.rev += l.qty * l.rate * (1 - (l.disc || 0) / 100);
    }
    return m;
  },
  inventoryValue(filter = () => true) {
    let v = 0;
    for (const b of Store.db.batches) if (b.qty > 0 && filter(b)) v += b.qty * b.cost;
    return v;
  },
  receivables() {
    let due = 0, overdue = 0;
    const t = Store.today();
    for (const s of Store.db.salesOrders) if (Calc.isSold(s)) { const x = Store.soTotals(s).due; due += x; if (s.dueDate < t) overdue += x; }
    return { due, overdue };
  },
  stockStatus(it) {
    const s = Store.stock(it.id);
    if (s <= 0) return 'Out of Stock';
    if (it.reorderLevel && s < it.reorderLevel) return 'Low Stock';
    return 'In Stock';
  },
  expLabel(exp) {
    if (!exp) return '<span class="muted">No expiry</span>';
    const d = Store.daysBetween(Store.today(), exp);
    const cls = d < 0 ? 'text-danger' : d <= 3 ? 'text-warning' : 'muted';
    const txt = d < 0 ? `expired ${-d}d ago` : d === 0 ? 'expires today' : `in ${d} day${d === 1 ? '' : 's'}`;
    return `${fmt.date(exp)}<div class="small ${cls}">${txt}</div>`;
  },
  whName: id => Store.wh(id)?.name || '—',
  whCode: id => Store.wh(id)?.code || '—',
  typeLabel: t => ({ finished: 'Finished Good', raw: 'Raw Material', packaging: 'Packaging' }[t] || t),
  moveLabel: t => ({ OPENING: 'Opening', GRN: 'Goods Receipt', PROD_ISSUE: 'Production Issue', PROD_RECEIPT: 'Production Output', PROD_REVERSAL: 'Production Reversal', SALE: 'Sales Dispatch', RETURN: 'Sales Return', RETURN_SCRAP: 'Return (Scrapped)', ADJ: 'Adjustment', TRF_OUT: 'Transfer Out', TRF_IN: 'Transfer In' }[t] || t),
};

/* Printable business document (Tax Invoice / Purchase Order / Credit Note) */
function printDocument({ title, no, date, partyLabel, party, shipLabel, ship, meta = [], head, rows, totals, notes = '' }) {
  const c = Store.db.company;
  UI.modal({
    title: `${esc(title)} · ${esc(no)}`, size: 'xl',
    body: `<div id="print-area"><div class="invoice">
      <div class="inv-head"><div><div class="flex" style="gap:12px"><div class="brand-logo" style="width:42px;height:42px"><svg class="ic" viewBox="0 0 24 24" style="width:24px;height:24px">${ICONS.logo}</svg></div><div><div style="font-size:18px;font-weight:800">${esc(c.name)}</div><div class="small muted">${esc(c.address)}</div></div></div>
        <div class="small mt-8">GSTIN <b>${esc(c.gstin)}</b> · FSSAI Lic. <b>${esc(c.fssai)}</b> · ${esc(c.phone)}</div></div>
        <div class="right"><div class="inv-title">${esc(title.toUpperCase())}</div><div class="mono fw-600 mt-8">${esc(no)}</div><div class="small">Date: ${fmt.date(date)}</div>${meta.map(m => `<div class="small">${m}</div>`).join('')}</div></div>
      <div class="inv-parties"><div><div class="small muted fw-600" style="text-transform:uppercase">${esc(partyLabel)}</div>${party}</div>${ship ? `<div><div class="small muted fw-600" style="text-transform:uppercase">${esc(shipLabel)}</div>${ship}</div>` : ''}</div>
      <table><thead><tr>${head.map(h => `<th class="${h.r ? 'right' : ''}">${h.l}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((v, i) => `<td class="${head[i].r ? 'right' : ''}">${v}</td>`).join('')}</tr>`).join('')}</tbody></table>
      <div class="totals">${totals.map(([l, v, big]) => `<div class="r ${big ? 'big' : ''}"><span>${l}</span><span>${v}</span></div>`).join('')}</div>
      ${notes ? `<div class="small muted mt-16">${notes}</div>` : ''}
      <div class="flex-between mt-24" style="align-items:flex-end"><div class="small muted">This is a computer-generated document from the Invexa demo workspace.<br>Goods once sold are subject to the returns & exchange policy.</div><div class="center small"><div style="height:40px"></div><div style="border-top:1px solid var(--border-strong);padding-top:4px">Authorised signatory</div></div></div>
    </div></div>`,
    foot: `<button class="btn" data-close>Close</button><button class="btn btn-primary" data-print>${icon('printer', 'sm')} Print / Save PDF</button>`,
    onMount(m) { $('[data-print]', m).addEventListener('click', () => window.print()); },
  });
}
