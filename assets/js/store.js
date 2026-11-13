/* ==========================================================================
   Invexa — Data store & business operations
   Everything is batch (lot) based: stock = Σ batch.qty. Every quantity
   change writes a movement to the stock ledger, so all modules stay in sync.
   ========================================================================== */
const Store = (() => {
  const VAULT_KEY = 'invexa.vault';
  const AUTH_KEY = 'invexa.auth';
  let db = null;
  let cryptoKey = null;
  let saveTimer = null;
  let simNow = null;
  let currentUser = null;
  let silent = false;
  const listeners = new Set();

  /* ---------- Time helpers ---------- */
  const now = () => simNow ?? Date.now();
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  const isoOf = ts => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const today = () => isoOf(now());
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d.getTime()); };
  const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
  const yymmdd = iso => iso.slice(2).replace(/-/g, '');

  /* ---------- Ids & numbering ---------- */
  const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
  const SERIES = { PO: 'PO', SO: 'SO', INV: 'INV', MO: 'MO', GRN: 'GRN', RTN: 'RTN', CN: 'CN', ADJ: 'ADJ', TRF: 'TRF', PAY: 'PAY' };
  function nextNo(series) {
    db.counters[series] = (db.counters[series] || 0) + 1;
    return `${SERIES[series]}-${pad(db.counters[series], 5)}`;
  }

  /* ---------- Persistence ---------- */
  function emit(reason) { if (!silent) listeners.forEach(fn => { try { fn(reason); } catch (e) { console.error(e); } }); }
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function commit(reason = 'change') {
    db.meta.updatedAt = Date.now();
    emit(reason);
    if (silent) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 250);
  }
  async function persist() {
    if (!db || !cryptoKey) return;
    try {
      const box = await Security.seal(cryptoKey, db);
      localStorage.setItem(VAULT_KEY, JSON.stringify(box));
    } catch (e) {
      console.error('Persist failed', e);
      if (window.UI) UI.toast('Could not save to browser storage (quota?)', 'error');
    }
  }
  async function attach(dekRaw) {
    cryptoKey = await Security.importDek(dekRaw);
    const raw = localStorage.getItem(VAULT_KEY);
    if (!raw) return false;
    try { db = await Security.open(cryptoKey, JSON.parse(raw)); return true; }
    catch (e) { console.error('Vault decrypt failed', e); return false; }
  }
  function setDb(next) { db = next; }
  function detach() { db = null; cryptoKey = null; currentUser = null; }
  function hasVault() { return !!localStorage.getItem(VAULT_KEY); }
  function vaultInfo() { const raw = localStorage.getItem(VAULT_KEY); if (!raw) return null; const b = JSON.parse(raw); return { bytes: raw.length, alg: b.alg, iv: b.iv, at: b.at, preview: b.ct.slice(0, 120) }; }

  /* ---------- Auth registry (outside the vault: needed pre-login) ---------- */
  function authData() { try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch { return null; } }
  function saveAuth(a) { localStorage.setItem(AUTH_KEY, JSON.stringify(a)); }

  /* ---------- Lookups ---------- */
  const byId = (coll, id) => db[coll].find(x => x.id === id);
  const item = id => byId('items', id);
  const wh = id => byId('warehouses', id);
  const vendor = id => byId('vendors', id);
  const customer = id => byId('customers', id);
  const bomFor = itemId => db.boms.find(b => b.itemId === itemId);

  function nearDays(it) { const s = it?.shelfLife || 30; return s <= 30 ? 3 : s <= 120 ? 10 : 30; }
  function batchStatus(b) {
    if (b.qty <= 0) return 'Consumed';
    const t = today();
    if (b.exp && b.exp < t) return 'Expired';
    if (b.exp && daysBetween(t, b.exp) <= nearDays(item(b.itemId))) return 'Expiring';
    return 'Available';
  }
  const isUsable = b => b.qty > 0 && (!b.exp || b.exp >= today());

  function batchesOf(itemId, whId) {
    return db.batches.filter(b => b.itemId === itemId && (!whId || b.whId === whId) && b.qty > 0);
  }
  function fefo(itemId, whIds) {
    const set = Array.isArray(whIds) ? whIds : whIds ? [whIds] : null;
    return db.batches
      .filter(b => b.itemId === itemId && b.qty > 0 && isUsable(b) && (!set || set.includes(b.whId)))
      .sort((a, b) => (a.exp || '9999').localeCompare(b.exp || '9999') || a.mfg.localeCompare(b.mfg));
  }
  function stock(itemId, whId) {
    let s = 0;
    for (const b of db.batches) if (b.itemId === itemId && b.qty > 0 && (!whId || b.whId === whId) && isUsable(b)) s += b.qty;
    return round(s);
  }
  function expiredStock(itemId, whId) {
    let s = 0;
    for (const b of db.batches) if (b.itemId === itemId && b.qty > 0 && (!whId || b.whId === whId) && !isUsable(b)) s += b.qty;
    return round(s);
  }
  function stockValue(itemId, whId) {
    let v = 0;
    for (const b of db.batches) if (b.itemId === itemId && b.qty > 0 && (!whId || b.whId === whId)) v += b.qty * b.cost;
    return v;
  }
  function committed(itemId) {
    let s = 0;
    for (const so of db.salesOrders) if (so.status === 'Confirmed') for (const l of so.lines) if (l.itemId === itemId) s += l.qty;
    return s;
  }
  function onOrder(itemId) {
    let s = 0;
    for (const po of db.purchaseOrders) if (['Issued', 'Partially Received'].includes(po.status)) for (const l of po.lines) if (l.itemId === itemId) s += Math.max(0, l.qty - (l.received || 0));
    return s;
  }
  const plantWhs = () => db.warehouses.filter(w => w.isPlant).map(w => w.id);
  const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

  /* ---------- Ledger ---------- */
  function move(type, b, qty, ref, note) {
    db.movements.push({ id: uid('mv'), ts: now(), d: today(), type, itemId: b.itemId, batchId: b.id, batchNo: b.batchNo, whId: b.whId, qty: round(qty), cost: b.cost, ref, note });
  }
  function log(action, entity, ref, detail = '') {
    db.activity.unshift({ id: uid('ac'), ts: now(), user: currentUser?.name || 'System', uid: currentUser?.id, action, entity, ref, detail });
    if (db.activity.length > 600) db.activity.length = 600;
  }
  function newBatch({ itemId, whId, qty, cost, mfg, exp, batchNo, source, ref, vendorLot, qc }) {
    const it = item(itemId);
    const b = {
      id: uid('bt'), batchNo: batchNo || autoBatchNo(it, mfg || today()), itemId, whId, qty: round(qty), initialQty: round(qty),
      cost: round(cost, 2), mfg: mfg || today(), exp: exp || (it.shelfLife ? addDays(mfg || today(), it.shelfLife) : null),
      source, ref, vendorLot: vendorLot || '', qc: qc || 'Passed', createdAt: now(),
    };
    db.batches.push(b);
    return b;
  }
  function autoBatchNo(it, mfg) {
    const base = `${it.code}-${yymmdd(mfg)}`;
    const n = db.batches.filter(b => b.batchNo.startsWith(base)).length;
    return n ? `${base}-${n + 1}` : base;
  }
  /** Allocate qty FEFO across batches. Returns picks or throws. */
  function allocate(itemId, whIds, qty) {
    const picks = [];
    let need = qty;
    for (const b of fefo(itemId, whIds)) {
      if (need <= 1e-9) break;
      const take = Math.min(b.qty, need);
      picks.push({ batch: b, qty: round(take) });
      need = round(need - take);
    }
    if (need > 1e-6) {
      const it = item(itemId);
      throw new Error(`Insufficient stock for ${it.name}: short by ${fmtQ(need)} ${it.uom}`);
    }
    return picks;
  }
  const fmtQ = n => (Math.round(n * 100) / 100).toLocaleString('en-IN');

  /* ---------- Master data ---------- */
  function saveItem(data) {
    if (!data.name?.trim()) throw new Error('Item name is required');
    if (!data.sku?.trim()) throw new Error('SKU is required');
    const dup = db.items.find(i => i.sku.toLowerCase() === data.sku.toLowerCase() && i.id !== data.id);
    if (dup) throw new Error(`SKU ${data.sku} already exists`);
    if (data.id) {
      Object.assign(item(data.id), data);
      log('Updated', 'Item', data.sku, data.name);
    } else {
      data.id = uid('it');
      data.code = data.code || data.sku.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase();
      data.active = true;
      data.createdAt = now();
      db.items.push(data);
      log('Created', 'Item', data.sku, data.name);
    }
    commit('items');
    return data;
  }
  function deleteItem(id) {
    const it = item(id);
    if (db.batches.some(b => b.itemId === id && b.qty > 0)) throw new Error('Item has stock on hand — mark it inactive instead');
    if (db.boms.some(b => b.itemId === id || b.lines.some(l => l.itemId === id))) throw new Error('Item is used in a recipe (BOM)');
    if (db.salesOrders.some(s => s.lines.some(l => l.itemId === id)) || db.purchaseOrders.some(p => p.lines.some(l => l.itemId === id)))
      throw new Error('Item is referenced by transactions — mark it inactive instead');
    db.items = db.items.filter(i => i.id !== id);
    log('Deleted', 'Item', it.sku, it.name);
    commit('items');
  }
  function saveParty(coll, data, label) {
    if (!data.name?.trim()) throw new Error('Name is required');
    if (data.id) { Object.assign(byId(coll, data.id), data); log('Updated', label, data.name); }
    else { data.id = uid(coll.slice(0, 2)); data.createdAt = now(); data.active = true; db[coll].push(data); log('Created', label, data.name); }
    commit(coll);
    return data;
  }
  const saveVendor = d => saveParty('vendors', d, 'Vendor');
  const saveCustomer = d => saveParty('customers', d, 'Customer');
  function saveWarehouse(d) {
    if (!d.name?.trim()) throw new Error('Name is required');
    if (d.id) { Object.assign(wh(d.id), d); log('Updated', 'Warehouse', d.code, d.name); }
    else { d.id = uid('wh'); d.createdAt = now(); db.warehouses.push(d); log('Created', 'Warehouse', d.code, d.name); }
    commit('warehouses');
    return d;
  }
  function saveBom(d) {
    if (!d.itemId) throw new Error('Select the finished product');
    if (!d.lines?.length) throw new Error('Add at least one ingredient');
    const existing = bomFor(d.itemId);
    if (existing && existing.id !== d.id) throw new Error('This product already has a recipe');
    if (d.id) Object.assign(byId('boms', d.id), d);
    else { d.id = uid('bom'); db.boms.push(d); }
    log('Saved', 'Recipe', item(d.itemId).sku, `${d.lines.length} components`);
    commit('boms');
    return d;
  }

  /* ---------- Production ---------- */
  function requirements(itemId, qty) {
    const bom = bomFor(itemId);
    if (!bom) return [];
    const plant = plantWhs();
    return bom.lines.map(l => {
      const need = round(l.qty * qty / (bom.outputQty || 1));
      const avail = plant.reduce((s, w) => s + stock(l.itemId, w), 0);
      return { itemId: l.itemId, qty: need, available: round(avail), ok: avail + 1e-9 >= need };
    });
  }
  function createMO({ itemId, qty, whId, date, shift = 'Morning', notes = '', status = 'Planned' }) {
    if (!itemId) throw new Error('Select a product');
    if (!(qty > 0)) throw new Error('Quantity must be greater than zero');
    if (!bomFor(itemId)) throw new Error('No recipe (BOM) defined for this product');
    const mo = { id: uid('mo'), no: nextNo('MO'), itemId, qty: Math.round(qty), whId, date: date || today(), shift, notes, status, consumed: [], createdAt: now(), createdBy: currentUser?.name };
    db.productions.unshift(mo);
    log('Planned', 'Production', mo.no, `${mo.qty} × ${item(itemId).name}`);
    commit('production');
    return mo;
  }
  function startMO(id) {
    const mo = byId('productions', id);
    if (mo.status !== 'Planned') throw new Error('Only planned orders can be started');
    const reqs = requirements(mo.itemId, mo.qty);
    const short = reqs.filter(r => !r.ok);
    if (short.length) throw new Error(`Material shortage: ${short.map(r => item(r.itemId).name).join(', ')}`);
    const plant = plantWhs();
    const picks = reqs.flatMap(r => allocate(r.itemId, plant, r.qty));
    for (const p of picks) {
      p.batch.qty = round(p.batch.qty - p.qty);
      move('PROD_ISSUE', p.batch, -p.qty, mo.no);
      mo.consumed.push({ batchId: p.batch.id, itemId: p.batch.itemId, qty: p.qty, cost: p.batch.cost });
    }
    mo.status = 'In Progress';
    mo.startedAt = now();
    log('Started', 'Production', mo.no, 'Materials issued (FEFO)');
    commit('production');
    return mo;
  }
  function completeMO(id, { good, rejected = 0, qc = {}, notes = '' }) {
    const mo = byId('productions', id);
    if (mo.status !== 'In Progress') throw new Error('Order must be in progress');
    good = Math.round(good); rejected = Math.round(rejected);
    if (!(good > 0)) throw new Error('Good quantity must be greater than zero');
    const it = item(mo.itemId);
    const matCost = mo.consumed.reduce((s, c) => s + c.qty * c.cost, 0);
    const unitCost = (matCost / good) + (it.convCost || 0);
    const b = newBatch({ itemId: mo.itemId, whId: mo.whId, qty: good, cost: unitCost, mfg: today(), source: 'Production', ref: mo.no, qc: 'Passed' });
    move('PROD_RECEIPT', b, good, mo.no);
    Object.assign(mo, { status: 'Completed', good, rejected, qc, completeNotes: notes, batchId: b.id, batchNo: b.batchNo, unitCost: round(unitCost, 2), completedAt: now() });
    log('Completed', 'Production', mo.no, `${good} good / ${rejected} rejected → batch ${b.batchNo}`);
    commit('production');
    return mo;
  }
  function cancelMO(id) {
    const mo = byId('productions', id);
    if (!['Planned', 'In Progress'].includes(mo.status)) throw new Error('Cannot cancel this order');
    if (mo.status === 'In Progress') {
      for (const c of mo.consumed) { const b = byId('batches', c.batchId); if (b) { b.qty = round(b.qty + c.qty); move('PROD_REVERSAL', b, c.qty, mo.no); } }
    }
    mo.status = 'Cancelled';
    log('Cancelled', 'Production', mo.no);
    commit('production');
  }

  /* ---------- Purchasing ---------- */
  function poTotals(po) {
    let sub = 0, tax = 0;
    for (const l of po.lines) { const a = l.qty * l.rate; sub += a; tax += a * (l.gst || 0) / 100; }
    return { sub, tax, total: sub + tax };
  }
  function savePO(d) {
    if (!d.vendorId) throw new Error('Select a vendor');
    d.lines = (d.lines || []).filter(l => l.itemId && l.qty > 0);
    if (!d.lines.length) throw new Error('Add at least one line item');
    d.lines.forEach(l => { l.received = l.received || 0; });
    if (d.id) {
      const po = byId('purchaseOrders', d.id);
      if (po.status !== 'Draft') throw new Error('Only draft POs can be edited');
      Object.assign(po, d);
      log('Updated', 'Purchase Order', po.no);
    } else {
      Object.assign(d, { id: uid('po'), no: nextNo('PO'), status: d.status || 'Draft', createdAt: now(), createdBy: currentUser?.name, grns: [] });
      db.purchaseOrders.unshift(d);
      log('Created', 'Purchase Order', d.no, vendor(d.vendorId).name);
    }
    commit('purchases');
    return d;
  }
  function issuePO(id) {
    const po = byId('purchaseOrders', id);
    if (po.status !== 'Draft') throw new Error('PO already issued');
    po.status = 'Issued'; po.issuedAt = now();
    log('Issued', 'Purchase Order', po.no, `to ${vendor(po.vendorId).name}`);
    commit('purchases');
  }
  function receivePO(id, receipts, { date } = {}) {
    const po = byId('purchaseOrders', id);
    if (!['Issued', 'Partially Received'].includes(po.status)) throw new Error('PO is not open for receiving');
    const rows = receipts.filter(r => r.qty > 0);
    if (!rows.length) throw new Error('Enter quantity received for at least one line');
    const grn = { id: uid('grn'), no: nextNo('GRN'), poId: po.id, date: date || today(), lines: [], by: currentUser?.name };
    for (const r of rows) {
      const l = po.lines[r.idx];
      const open = l.qty - (l.received || 0);
      if (r.qty > open + 1e-9) throw new Error(`${item(l.itemId).name}: receiving more than ordered (${open} open)`);
      const it = item(l.itemId);
      const mfg = r.mfg || date || today();
      const b = newBatch({ itemId: l.itemId, whId: r.whId || po.whId, qty: r.qty, cost: l.rate, mfg, exp: r.exp || (it.shelfLife ? addDays(mfg, it.shelfLife) : null), batchNo: r.lot || `L${yymmdd(date || today())}-${it.code}`, source: 'Purchase', ref: po.no, vendorLot: r.lot, qc: r.qc || 'Passed' });
      move('GRN', b, r.qty, grn.no, po.no);
      l.received = round((l.received || 0) + r.qty);
      grn.lines.push({ itemId: l.itemId, qty: r.qty, batchId: b.id, batchNo: b.batchNo });
    }
    po.grns.push(grn);
    po.status = po.lines.every(l => l.received + 1e-9 >= l.qty) ? 'Received' : 'Partially Received';
    if (po.status === 'Received') po.receivedAt = now();
    log('Received', 'Goods Receipt', grn.no, `${po.no} · ${grn.lines.length} line(s)`);
    commit('purchases');
    return grn;
  }
  function cancelPO(id) {
    const po = byId('purchaseOrders', id);
    if (!['Draft', 'Issued'].includes(po.status)) throw new Error('Cannot cancel a PO that has receipts');
    po.status = 'Cancelled';
    log('Cancelled', 'Purchase Order', po.no);
    commit('purchases');
  }
  function markPOBilled(id) {
    const po = byId('purchaseOrders', id);
    po.billStatus = 'Paid'; po.paidAt = now();
    log('Paid', 'Vendor Bill', po.no, `₹${Math.round(poTotals(po).total).toLocaleString('en-IN')}`);
    commit('purchases');
  }

  /* ---------- Sales ---------- */
  function soTotals(so) {
    let sub = 0, disc = 0, tax = 0;
    for (const l of so.lines) {
      const gross = l.qty * l.rate; const d = gross * (l.disc || 0) / 100;
      sub += gross; disc += d; tax += (gross - d) * (l.gst || 0) / 100;
    }
    const total = sub - disc + tax;
    const paid = (so.payments || []).reduce((s, p) => s + p.amount, 0);
    const cu = customer(so.customerId);
    const intra = (cu?.state || 'Maharashtra') === (db.company.state || 'Maharashtra');
    return { sub, disc, tax, total, paid, due: Math.max(0, total - paid), intra, cgst: intra ? tax / 2 : 0, sgst: intra ? tax / 2 : 0, igst: intra ? 0 : tax };
  }
  function saveSO(d) {
    if (!d.customerId) throw new Error('Select a customer');
    d.lines = (d.lines || []).filter(l => l.itemId && l.qty > 0);
    if (!d.lines.length) throw new Error('Add at least one line item');
    if (!d.whId) throw new Error('Select the dispatch warehouse');
    if (d.id) {
      const so = byId('salesOrders', d.id);
      if (!['Draft', 'Confirmed'].includes(so.status)) throw new Error('Dispatched orders cannot be edited');
      Object.assign(so, d);
      log('Updated', 'Sales Order', so.no);
    } else {
      const cu = customer(d.customerId);
      Object.assign(d, { id: uid('so'), no: nextNo('SO'), status: d.status || 'Draft', payments: [], allocations: [], createdAt: now(), createdBy: currentUser?.name, dueDate: addDays(d.date || today(), cu.creditDays ?? 15) });
      db.salesOrders.unshift(d);
      log('Created', 'Sales Order', d.no, cu.name);
    }
    commit('sales');
    return d;
  }
  function soShortages(so) {
    const need = {};
    so.lines.forEach(l => { need[l.itemId] = (need[l.itemId] || 0) + l.qty; });
    return Object.entries(need).map(([itemId, q]) => ({ itemId, need: q, have: stock(itemId, so.whId) })).filter(x => x.have < x.need);
  }
  function confirmSO(id) {
    const so = byId('salesOrders', id);
    if (so.status !== 'Draft') throw new Error('Order already confirmed');
    so.status = 'Confirmed'; so.confirmedAt = now();
    log('Confirmed', 'Sales Order', so.no);
    commit('sales');
  }
  function dispatchSO(id, { vehicle = '', driver = '' } = {}) {
    const so = byId('salesOrders', id);
    if (!['Draft', 'Confirmed'].includes(so.status)) throw new Error('Order cannot be dispatched');
    // validate all lines first (atomic)
    const need = {};
    so.lines.forEach(l => { need[l.itemId] = (need[l.itemId] || 0) + l.qty; });
    for (const [itemId, q] of Object.entries(need)) allocate(itemId, so.whId, q);
    so.allocations = [];
    for (const l of so.lines) {
      for (const p of allocate(l.itemId, so.whId, l.qty)) {
        p.batch.qty = round(p.batch.qty - p.qty);
        move('SALE', p.batch, -p.qty, so.no);
        so.allocations.push({ itemId: l.itemId, batchId: p.batch.id, batchNo: p.batch.batchNo, exp: p.batch.exp, qty: p.qty, cost: p.batch.cost });
      }
    }
    so.status = 'Dispatched';
    so.dispatchedAt = now(); so.dispatchDate = today();
    so.invoiceNo = so.invoiceNo || nextNo('INV');
    so.vehicle = vehicle; so.driver = driver;
    log('Dispatched', 'Sales Order', so.no, `Invoice ${so.invoiceNo}`);
    commit('sales');
    return so;
  }
  function deliverSO(id) {
    const so = byId('salesOrders', id);
    if (so.status !== 'Dispatched') throw new Error('Order is not in transit');
    so.status = 'Delivered'; so.deliveredAt = now(); so.deliveryDate = today();
    log('Delivered', 'Sales Order', so.no);
    commit('sales');
  }
  function recordPayment(id, { amount, mode = 'Bank Transfer', ref = '' }) {
    const so = byId('salesOrders', id);
    const t = soTotals(so);
    if (!(amount > 0)) throw new Error('Enter a valid amount');
    if (amount > t.due + 0.5) throw new Error('Amount exceeds balance due');
    so.payments.push({ id: uid('pay'), no: nextNo('PAY'), date: today(), amount: round(amount, 2), mode, ref });
    log('Payment', 'Sales Order', so.no, `₹${Math.round(amount).toLocaleString('en-IN')} via ${mode}`);
    commit('sales');
  }
  function cancelSO(id) {
    const so = byId('salesOrders', id);
    if (!['Draft', 'Confirmed'].includes(so.status)) throw new Error('Dispatched orders cannot be cancelled — create a return');
    so.status = 'Cancelled';
    log('Cancelled', 'Sales Order', so.no);
    commit('sales');
  }
  function payStatus(so) {
    if (['Draft', 'Confirmed', 'Cancelled'].includes(so.status)) return '—';
    const t = soTotals(so);
    if (t.due <= 0.5) return 'Paid';
    if (so.dueDate < today()) return 'Overdue';
    return t.paid > 0 ? 'Partial' : 'Unpaid';
  }

  /* ---------- Returns ---------- */
  function returnedQty(soId, batchId) {
    let s = 0;
    for (const r of db.returns) if (r.soId === soId) for (const l of r.lines) if (l.batchId === batchId) s += l.qty;
    return s;
  }
  function createReturn({ soId, date, reason, notes = '', lines }) {
    const so = byId('salesOrders', soId);
    if (!so || !['Dispatched', 'Delivered'].includes(so.status)) throw new Error('Select a dispatched/delivered order');
    lines = lines.filter(l => l.qty > 0);
    if (!lines.length) throw new Error('Enter return quantity for at least one batch');
    const rt = { id: uid('rt'), no: nextNo('RTN'), cn: nextNo('CN'), soId, customerId: so.customerId, date: date || today(), reason, notes, lines: [], value: 0, createdAt: now(), by: currentUser?.name };
    for (const l of lines) {
      const alloc = so.allocations.find(a => a.batchId === l.batchId);
      const max = alloc.qty - returnedQty(soId, l.batchId);
      if (l.qty > max + 1e-9) throw new Error(`Return qty exceeds dispatched qty for batch ${alloc.batchNo}`);
      const b = byId('batches', l.batchId);
      const sl = so.lines.find(x => x.itemId === alloc.itemId);
      const rate = sl.rate * (1 - (sl.disc || 0) / 100) * (1 + (sl.gst || 0) / 100);
      let action = l.action;
      if (action === 'Restock' && b.exp && b.exp < today()) action = 'Scrap';
      if (action === 'Restock') { b.qty = round(b.qty + l.qty); move('RETURN', b, l.qty, rt.no, reason); }
      else db.movements.push({ id: uid('mv'), ts: now(), d: today(), type: 'RETURN_SCRAP', itemId: b.itemId, batchId: b.id, batchNo: b.batchNo, whId: b.whId, qty: 0, cost: b.cost, ref: rt.no, note: `${l.qty} scrapped — ${reason}`, scrapQty: l.qty });
      rt.lines.push({ itemId: alloc.itemId, batchId: b.id, batchNo: b.batchNo, qty: l.qty, action, rate: round(rate, 2) });
      rt.value += l.qty * rate;
    }
    rt.value = round(rt.value, 2);
    db.returns.unshift(rt);
    log('Created', 'Sales Return', rt.no, `${so.no} · Credit note ${rt.cn}`);
    commit('returns');
    return rt;
  }

  /* ---------- Adjustments ---------- */
  function createAdjustment({ date, whId, type, reason = '', lines }) {
    lines = lines.filter(l => l.batchId && l.qty);
    if (!lines.length) throw new Error('Add at least one batch line');
    const adj = { id: uid('adj'), no: nextNo('ADJ'), date: date || today(), whId, type, reason, lines: [], value: 0, createdAt: now(), by: currentUser?.name };
    for (const l of lines) {
      const b = byId('batches', l.batchId);
      if (b.qty + l.qty < -1e-9) throw new Error(`Batch ${b.batchNo} has only ${b.qty} on hand`);
    }
    for (const l of lines) {
      const b = byId('batches', l.batchId);
      b.qty = round(b.qty + l.qty);
      move('ADJ', b, l.qty, adj.no, type);
      adj.lines.push({ batchId: b.id, batchNo: b.batchNo, itemId: b.itemId, qty: l.qty, cost: b.cost });
      adj.value += l.qty * b.cost;
    }
    adj.value = round(adj.value, 2);
    db.adjustments.unshift(adj);
    log('Posted', 'Stock Adjustment', adj.no, `${type} · ${adj.lines.length} line(s)`);
    commit('adjustments');
    return adj;
  }
  function writeOffExpired(whId) {
    const exp = db.batches.filter(b => b.qty > 0 && b.exp && b.exp < today() && (!whId || b.whId === whId));
    if (!exp.length) throw new Error('No expired stock to write off');
    const groups = {};
    exp.forEach(b => { (groups[b.whId] = groups[b.whId] || []).push(b); });
    return Object.entries(groups).map(([w, bs]) => createAdjustment({ whId: w, type: 'Expired', reason: 'Expired stock write-off', lines: bs.map(b => ({ batchId: b.id, qty: -b.qty })) }));
  }

  /* ---------- Transfers ---------- */
  function createTransfer({ from, to, date, vehicle = '', notes = '', lines }) {
    if (!from || !to || from === to) throw new Error('Choose different source and destination');
    lines = lines.filter(l => l.batchId && l.qty > 0);
    if (!lines.length) throw new Error('Add at least one batch');
    for (const l of lines) { const b = byId('batches', l.batchId); if (l.qty > b.qty + 1e-9) throw new Error(`Batch ${b.batchNo} has only ${b.qty}`); }
    const tr = { id: uid('tr'), no: nextNo('TRF'), from, to, date: date || today(), vehicle, notes, status: 'In Transit', lines: [], createdAt: now(), by: currentUser?.name };
    for (const l of lines) {
      const b = byId('batches', l.batchId);
      b.qty = round(b.qty - l.qty);
      move('TRF_OUT', b, -l.qty, tr.no);
      tr.lines.push({ batchId: b.id, batchNo: b.batchNo, itemId: b.itemId, qty: l.qty, exp: b.exp, mfg: b.mfg, cost: b.cost });
    }
    db.transfers.unshift(tr);
    log('Dispatched', 'Stock Transfer', tr.no, `${wh(from).name} → ${wh(to).name}`);
    commit('transfers');
    return tr;
  }
  function receiveTransfer(id) {
    const tr = byId('transfers', id);
    if (tr.status !== 'In Transit') throw new Error('Transfer already received');
    for (const l of tr.lines) {
      let b = db.batches.find(x => x.batchNo === l.batchNo && x.itemId === l.itemId && x.whId === tr.to);
      if (b) b.qty = round(b.qty + l.qty);
      else b = newBatch({ itemId: l.itemId, whId: tr.to, qty: l.qty, cost: l.cost, mfg: l.mfg, exp: l.exp, batchNo: l.batchNo, source: 'Transfer', ref: tr.no });
      move('TRF_IN', b, l.qty, tr.no);
    }
    tr.status = 'Completed'; tr.receivedAt = now();
    log('Received', 'Stock Transfer', tr.no);
    commit('transfers');
  }

  /* ---------- Cold chain ---------- */
  function logTemp({ whId, temp, note = '' }) {
    const w = wh(whId);
    const ok = temp >= w.tempMin && temp <= w.tempMax;
    db.tempLogs.push({ id: uid('tl'), ts: now(), whId, temp: round(temp, 1), ok, by: currentUser?.name || 'Sensor', note });
    if (db.tempLogs.length > 1200) db.tempLogs.splice(0, db.tempLogs.length - 1200);
    if (!ok) log('Excursion', 'Cold Chain', w.code, `${temp}°C (range ${w.tempMin}–${w.tempMax}°C)`);
    commit('temps');
    return ok;
  }

  /* ---------- Alerts (shared by dashboard, bell, sidebar) ---------- */
  function alerts() {
    const out = [];
    const t = today();
    for (const it of db.items.filter(i => i.active)) {
      const s = stock(it.id);
      const cover = it.type === 'finished' ? s : s + onOrder(it.id);
      if (it.reorderLevel && cover < it.reorderLevel) out.push({ kind: 'low', sev: s === 0 ? 'red' : 'amber', title: `${s === 0 ? 'Out of stock' : 'Low stock'}: ${it.name}`, sub: `${fmtQ(s)} ${it.uom} on hand${it.type === 'finished' ? '' : ` + ${fmtQ(cover - s)} on order`} · reorder at ${fmtQ(it.reorderLevel)}`, route: `#/items?id=${it.id}` });
    }
    const expiring = db.batches.filter(b => batchStatus(b) === 'Expiring');
    if (expiring.length) out.push({ kind: 'expiring', sev: 'amber', title: `${expiring.length} batch(es) expiring soon`, sub: 'Prioritise dispatch (FEFO) or plan promotions', route: '#/batches?f=Expiring' });
    const expired = db.batches.filter(b => batchStatus(b) === 'Expired');
    if (expired.length) out.push({ kind: 'expired', sev: 'red', title: `${expired.length} expired batch(es) in stock`, sub: `Value ₹${Math.round(expired.reduce((s, b) => s + b.qty * b.cost, 0)).toLocaleString('en-IN')} — write off`, route: '#/batches?f=Expired' });
    const late = db.purchaseOrders.filter(p => ['Issued', 'Partially Received'].includes(p.status) && p.expected < t);
    if (late.length) out.push({ kind: 'po', sev: 'amber', title: `${late.length} purchase order(s) overdue`, sub: 'Follow up with vendors', route: '#/purchases' });
    const toShip = db.salesOrders.filter(s => s.status === 'Confirmed');
    if (toShip.length) out.push({ kind: 'so', sev: 'blue', title: `${toShip.length} order(s) awaiting dispatch`, sub: 'Confirmed sales orders', route: '#/sales?f=Confirmed' });
    const since = now() - 86400000;
    const exc = db.tempLogs.filter(l => !l.ok && l.ts >= since);
    if (exc.length) out.push({ kind: 'temp', sev: 'red', title: `${exc.length} temperature excursion(s) in 24h`, sub: 'Check cold room compressors & doors', route: '#/warehouses' });
    const transit = db.transfers.filter(x => x.status === 'In Transit');
    if (transit.length) out.push({ kind: 'trf', sev: 'blue', title: `${transit.length} transfer(s) in transit`, sub: 'Receive at destination hub', route: '#/transfers' });
    return out;
  }

  return {
    get db() { return db; }, setDb, attach, detach, hasVault, vaultInfo, persist, commit, onChange,
    authData, saveAuth,
    setClock: ts => { simNow = ts; }, now, today, addDays, daysBetween, isoOf, uid, nextNo, round,
    setUser: u => { currentUser = u; }, get user() { return currentUser; },
    setSilent: v => { silent = v; },
    item, wh, vendor, customer, bomFor, byId, batchStatus, isUsable, batchesOf, fefo, stock, expiredStock, stockValue, committed, onOrder, plantWhs, allocate, log, newBatch, move,
    saveItem, deleteItem, saveVendor, saveCustomer, saveWarehouse, saveBom,
    requirements, createMO, startMO, completeMO, cancelMO,
    poTotals, savePO, issuePO, receivePO, cancelPO, markPOBilled,
    soTotals, saveSO, soShortages, confirmSO, dispatchSO, deliverSO, recordPayment, cancelSO, payStatus,
    returnedQty, createReturn, createAdjustment, writeOffExpired, createTransfer, receiveTransfer, logTemp, alerts,
  };
})();
