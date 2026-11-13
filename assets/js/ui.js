/* ==========================================================================
   Invexa — UI toolkit
   ========================================================================== */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const fmt = (() => {
  const inr0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  const inr2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const toDate = v => (typeof v === 'number' ? new Date(v) : new Date(String(v).length === 10 ? v + 'T00:00:00' : v));
  return {
    money: (n, dec = 0) => '₹' + (dec ? inr2 : inr0).format(Math.round((n || 0) * 100) / 100),
    compact(n) {
      const a = Math.abs(n || 0), s = n < 0 ? '-' : '';
      if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)} Cr`;
      if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(2)} L`;
      if (a >= 1e3) return `${s}₹${(a / 1e3).toFixed(1)}K`;
      return `${s}₹${Math.round(a)}`;
    },
    num: (n, dec = 0) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: dec }).format(n || 0),
    qty: (n, uom = '') => `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0)}${uom ? ' ' + uom : ''}`,
    date(v) { if (!v) return '—'; const d = toDate(v); return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`; },
    short(v) { if (!v) return '—'; const d = toDate(v); return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]}`; },
    dt(v) { if (!v) return '—'; const d = toDate(v); return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; },
    rel(ts) {
      const s = Math.round((Date.now() - ts) / 1000);
      if (s < 60) return 'just now';
      if (s < 3600) return `${Math.floor(s / 60)}m ago`;
      if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
      if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
      return fmt.date(ts);
    },
    pct: (n, dec = 1) => `${(n || 0).toFixed(dec)}%`,
  };
})();

const UI = (() => {
  const charts = [];
  const tableState = {};

  function toast(msg, type = 'success') {
    const ic = { success: 'check', error: 'x', info: 'info', warning: 'alert' }[type] || 'info';
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<div class="ti">${icon(ic)}</div><div>${esc(msg)}</div>`;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .3s, transform .3s'; el.style.opacity = '0'; el.style.transform = 'translateY(6px)'; }, 3200);
    setTimeout(() => el.remove(), 3600);
  }

  function modal({ title, body = '', foot = '', size = '', onMount, dismissable = true }) {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true">
      <div class="modal-head"><div class="modal-title">${title}</div><button class="btn btn-ghost btn-icon btn-sm" data-close>${icon('x')}</button></div>
      <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
    document.body.appendChild(ov);
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape' && $$('.overlay').at(-1) === ov) close(); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('mousedown', e => { if (e.target === ov && dismissable) close(); });
    $$('[data-close]', ov).forEach(b => b.addEventListener('click', close));
    const m = $('.modal', ov);
    if (onMount) onMount(m, close);
    setTimeout(() => { const f = $('input:not([type=hidden]):not([readonly]), select, textarea', $('.modal-body', ov)); if (f && !f.dataset.nofocus) f.focus(); }, 30);
    return { el: m, close };
  }

  /** Form modal helper: run `onSubmit(form, close)`; errors become toasts. */
  function formModal({ title, body, size, submitText = 'Save', submitIcon = 'check', onSubmit, onMount }) {
    return modal({
      title, size, dismissable: false,
      body: `<form id="mform" novalidate>${body}</form>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" data-submit>${icon(submitIcon)} ${submitText}</button>`,
      onMount(m, close) {
        const form = $('#mform', m);
        const go = async e => {
          e?.preventDefault();
          const btn = $('[data-submit]', m);
          btn.disabled = true;
          try { await onSubmit(form, close); }
          catch (err) { console.error(err); toast(err.message || String(err), 'error'); }
          finally { btn.disabled = false; }
        };
        form.addEventListener('submit', go);
        $('[data-submit]', m).addEventListener('click', go);
        if (onMount) onMount(m, close, form);
      },
    });
  }

  function confirm({ title = 'Are you sure?', message = '', okText = 'Confirm', danger = false }) {
    return new Promise(res => {
      let done = false;
      const { close } = modal({
        title, size: 'sm', body: `<p style="margin:0;color:var(--text-2)">${message}</p>`,
        foot: `<button class="btn" data-close>Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${okText}</button>`,
        onMount(m, cl) {
          $('[data-ok]', m).addEventListener('click', () => { done = true; cl(); res(true); });
          $$('[data-close]', m).forEach(b => b.addEventListener('click', () => { if (!done) res(false); }));
        },
      });
      return close;
    });
  }

  function drawer({ title, sub = '', badge = '', body = '', foot = '', onMount, width }) {
    closeDrawer();
    const ov = document.createElement('div');
    ov.className = 'drawer-overlay';
    const dr = document.createElement('aside');
    dr.className = 'drawer';
    if (width) dr.style.width = width;
    dr.innerHTML = `<div class="drawer-head"><div><div class="flex" style="gap:10px"><h3 style="font-size:18px">${title}</h3>${badge}</div>${sub ? `<div class="muted small" style="margin-top:3px">${sub}</div>` : ''}</div>
      <button class="btn btn-ghost btn-icon btn-sm" data-dclose>${icon('x')}</button></div>
      <div class="drawer-body">${body}</div>${foot ? `<div class="drawer-foot">${foot}</div>` : ''}`;
    document.body.append(ov, dr);
    const close = () => { ov.remove(); dr.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape' && !$('.overlay')) close(); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', close);
    $('[data-dclose]', dr).addEventListener('click', close);
    UI._drawerClose = close;
    if (onMount) onMount(dr, close);
    return { el: dr, close };
  }
  function closeDrawer() { if (UI._drawerClose) { UI._drawerClose(); UI._drawerClose = null; } }

  const BADGE = {
    green: ['Available', 'Active', 'Completed', 'Delivered', 'Paid', 'Received', 'Passed', 'OK', 'In Stock', 'Restock', 'Healthy', 'Enabled'],
    amber: ['Expiring', 'Partial', 'Partially Received', 'In Progress', 'In Transit', 'Low Stock', 'Pending', 'Due Soon'],
    red: ['Expired', 'Overdue', 'Unpaid', 'Excursion', 'Scrap', 'Out of Stock', 'Failed', 'Rejected', 'Disabled'],
    blue: ['Confirmed', 'Issued', 'Planned', 'Open'],
    violet: ['Dispatched', 'Distributor', 'Administrator'],
    cyan: ['Modern Trade', 'E-commerce', 'Inventory Manager'],
    gray: ['Draft', 'Cancelled', 'Consumed', '—', 'Retailer', 'HoReCa', 'Sales Executive', 'Inactive'],
  };
  const BADGE_MAP = {};
  Object.entries(BADGE).forEach(([c, list]) => list.forEach(s => { BADGE_MAP[s] = c; }));
  const badge = (s, tone) => `<span class="badge b-${tone || BADGE_MAP[s] || 'gray'}">${esc(s)}</span>`;

  const empty = (ic, title, sub = '', action = '') => `<div class="empty"><div class="em-ic">${icon(ic)}</div><h4>${esc(title)}</h4><div>${esc(sub)}</div>${action ? `<div class="mt-16">${action}</div>` : ''}</div>`;

  const COLORS = ['#2f6fed', '#6a5cff', '#12a46b', '#e98a07', '#e5484d', '#0b9bd8', '#b4235f', '#0f766e'];
  const colorFor = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };
  const initials = s => String(s || '?').split(/[\s–-]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const avatar = (name, size = 30) => `<div class="avatar" style="width:${size}px;height:${size}px;background:${colorFor(name)};font-size:${Math.round(size * 0.4)}px">${esc(initials(name))}</div>`;
  const thumb = it => `<div class="thumb" style="background:linear-gradient(135deg, ${it?.color || '#64748b'}, ${shade(it?.color || '#64748b')})">${esc(initials(it?.name?.replace(/[^A-Za-z ]/g, '') || '?'))}</div>`;
  function shade(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((n >> 16) & 255) + 50), g = Math.min(255, ((n >> 8) & 255) + 50), b = Math.min(255, (n & 255) + 50);
    return `rgb(${r},${g},${b})`;
  }
  const itemCell = (it, sub) => `<div class="item-cell">${thumb(it)}<div style="min-width:0"><div class="cell-main">${esc(it?.name || 'Unknown')}</div><div class="cell-sub">${sub ?? esc(it?.sku || '')}</div></div></div>`;
  const progress = (pct, tone = '') => `<div class="progress ${tone}"><span style="width:${Math.max(0, Math.min(100, pct))}%"></span></div>`;
  const kpi = ({ label, value, ic, tone = 'blue', foot = '' }) => `<div class="card kpi k-${tone}"><div class="kpi-top"><div class="kpi-icon">${icon(ic)}</div><div class="kpi-label">${label}</div></div><div class="kpi-value">${value}</div><div class="kpi-foot">${foot}</div></div>`;
  const stat = (l, v) => `<div class="s"><div class="l">${l}</div><div class="v">${v}</div></div>`;

  function options(list, selected, { value = 'id', label = 'name', placeholder } = {}) {
    let h = placeholder !== undefined ? `<option value="">${esc(placeholder)}</option>` : '';
    for (const o of list) {
      const v = typeof o === 'string' ? o : o[value];
      const l = typeof o === 'string' ? o : (typeof label === 'function' ? label(o) : o[label]);
      h += `<option value="${esc(v)}" ${String(v) === String(selected ?? '') ? 'selected' : ''}>${esc(l)}</option>`;
    }
    return h;
  }
  function field(label, inner, { req, span, hint } = {}) {
    return `<div class="field ${span ? 'span-2' : ''}"><label>${label}${req ? ' <span class="req">*</span>' : ''}</label>${inner}${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
  }
  const input = (name, val = '', { type = 'text', ph = '', step, min, extra = '' } = {}) =>
    `<input class="input" name="${name}" type="${type}" value="${esc(val)}" placeholder="${esc(ph)}" ${step ? `step="${step}"` : ''} ${min !== undefined ? `min="${min}"` : ''} ${extra}>`;
  const select = (name, opts, extra = '') => `<select class="input" name="${name}" ${extra}>${opts}</select>`;
  function formData(form) {
    const o = {};
    for (const el of form.elements) {
      if (!el.name || el.closest('[data-lines]')) continue;
      if (el.type === 'checkbox') o[el.name] = el.checked;
      else if (el.type === 'number') o[el.name] = el.value === '' ? null : parseFloat(el.value);
      else o[el.name] = el.value.trim();
    }
    return o;
  }

  /* ---------- Line editor ---------- */
  function lineEditor(host, { columns, lines, onChange, addLabel = 'Add line', blank = () => ({}) }) {
    const render = () => {
      host.innerHTML = `<div class="lines" data-lines><table><thead><tr>${columns.map(c => `<th style="${c.width ? `width:${c.width}` : ''}" class="${c.align === 'right' ? 'right' : ''}">${c.label}</th>`).join('')}<th style="width:40px"></th></tr></thead>
        <tbody>${lines.map((l, i) => `<tr data-i="${i}">${columns.map(c => `<td class="${c.align === 'right' ? 'right' : ''}">${cell(c, l, i)}</td>`).join('')}<td><button type="button" class="btn btn-ghost btn-sm btn-icon" data-del="${i}" title="Remove">${icon('trash', 'sm')}</button></td></tr>`).join('')}
        </tbody></table></div><button type="button" class="btn btn-soft btn-sm mt-8" data-add>${icon('plus', 'sm')} ${addLabel}</button>`;
      $$('[data-del]', host).forEach(b => b.addEventListener('click', () => { lines.splice(+b.dataset.del, 1); render(); onChange?.(lines); }));
      $('[data-add]', host).addEventListener('click', () => { lines.push(blank()); render(); onChange?.(lines); });
      $$('[data-k]', host).forEach(el => {
        const ev = el.tagName === 'SELECT' ? 'change' : 'input';
        el.addEventListener(ev, () => {
          const i = +el.closest('tr').dataset.i, c = columns.find(x => x.key === el.dataset.k);
          lines[i][c.key] = c.type === 'number' ? (el.value === '' ? 0 : parseFloat(el.value)) : el.value;
          if (c.onSet) c.onSet(lines[i], el.value);
          if (c.rerender) { render(); } else { $$('[data-static]', el.closest('tr')).forEach(s => { const sc = columns.find(x => x.key === s.dataset.static); s.innerHTML = sc.render(lines[i], i); }); }
          onChange?.(lines);
        });
      });
    };
    const cell = (c, l, i) => {
      if (c.type === 'select') return `<select class="input sm" data-k="${c.key}">${c.options(l, i)}</select>`;
      if (c.type === 'number') return `<input class="input sm right" type="number" step="${c.step || 'any'}" min="${c.min ?? ''}" data-k="${c.key}" value="${l[c.key] ?? ''}">`;
      if (c.type === 'text') return `<input class="input sm" data-k="${c.key}" value="${esc(l[c.key] ?? '')}">`;
      return `<span data-static="${c.key}">${c.render(l, i)}</span>`;
    };
    render();
    return { render, lines };
  }

  /* ---------- Data table ---------- */
  class DataTable {
    constructor(el, opts) {
      this.el = el;
      this.o = Object.assign({ pageSize: 12, filters: [], searchable: true }, opts);
      const st = opts.id && tableState[opts.id];
      this.s = st || { q: '', f: {}, sort: opts.sort || null, page: 0 };
      if (opts.id) tableState[opts.id] = this.s;
      (this.o.filters || []).forEach(f => { if (f.value !== undefined && this.s.f[f.key] === undefined) this.s.f[f.key] = f.value; });
      this.mount();
    }
    mount() {
      const o = this.o;
      this.el.innerHTML = `<div class="card table-card">
        <div class="table-toolbar">
          ${o.searchable ? `<div class="search-input">${icon('search', 'sm')}<input class="input" placeholder="${esc(o.searchPh || 'Search…')}" value="${esc(this.s.q)}" data-q></div>` : ''}
          ${o.filters.map(f => `<select class="input" data-f="${f.key}">${options(f.options, this.s.f[f.key] ?? '', { placeholder: f.label })}</select>`).join('')}
          <div class="grow"></div>${o.toolbar || ''}
          ${o.exportName ? `<button class="btn btn-sm" data-export title="Export CSV">${icon('download', 'sm')} Export</button>` : ''}
        </div><div data-body></div></div>`;
      const q = $('[data-q]', this.el);
      if (q) q.addEventListener('input', () => { this.s.q = q.value; this.s.page = 0; this.draw(); });
      $$('[data-f]', this.el).forEach(s => s.addEventListener('change', () => { this.s.f[s.dataset.f] = s.value; this.s.page = 0; this.draw(); }));
      $('[data-export]', this.el)?.addEventListener('click', () => this.exportCsv());
      if (o.onMountToolbar) o.onMountToolbar($('.table-toolbar', this.el));
      this.draw();
    }
    rowsFiltered() {
      const o = this.o, s = this.s;
      let rows = typeof o.rows === 'function' ? o.rows() : o.rows;
      if (s.q) {
        const q = s.q.toLowerCase();
        rows = rows.filter(r => (o.searchText ? o.searchText(r) : JSON.stringify(r)).toLowerCase().includes(q));
      }
      for (const f of o.filters) { const v = s.f[f.key]; if (v) rows = rows.filter(r => f.test(r, v)); }
      if (s.sort) {
        const col = o.columns.find(c => c.key === s.sort.key);
        if (col) {
          const get = typeof col.sort === 'function' ? col.sort : r => r[col.key];
          rows = [...rows].sort((a, b) => { const x = get(a), y = get(b); return (x > y ? 1 : x < y ? -1 : 0) * (s.sort.dir === 'asc' ? 1 : -1); });
        }
      }
      return rows;
    }
    draw() {
      const o = this.o, s = this.s;
      const rows = this.rowsFiltered();
      const pages = Math.max(1, Math.ceil(rows.length / o.pageSize));
      s.page = Math.min(s.page, pages - 1);
      const slice = rows.slice(s.page * o.pageSize, (s.page + 1) * o.pageSize);
      const body = $('[data-body]', this.el);
      if (!rows.length) { body.innerHTML = o.emptyHtml || empty(o.emptyIcon || 'box', o.emptyTitle || 'Nothing here yet', o.emptySub || 'Try changing filters or create a new record.'); return; }
      body.innerHTML = `<div class="table-wrap"><table class="tbl ${o.compact ? 'compact' : ''}"><thead><tr>${o.columns.map(c => {
        const sorted = s.sort?.key === c.key;
        return `<th class="${c.sort !== false ? 'sortable' : ''} ${c.align === 'right' ? 'right' : ''}" data-sort="${c.key}" style="${c.width ? `width:${c.width}` : ''}">${c.label}${sorted ? `<span class="arr">${s.sort.dir === 'asc' ? '▲' : '▼'}</span>` : ''}</th>`;
      }).join('')}</tr></thead><tbody>${slice.map(r => `<tr class="${o.onRow ? 'clickable' : ''}" data-id="${esc(r.id)}">${o.columns.map(c => `<td class="${c.align === 'right' ? 'right' : ''} ${c.nowrap ? 'nowrap' : ''}">${c.render ? c.render(r) : esc(r[c.key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <div class="table-foot"><div>Showing ${s.page * o.pageSize + 1}–${Math.min(rows.length, (s.page + 1) * o.pageSize)} of ${fmt.num(rows.length)}</div>
        <div class="pager"><button class="btn btn-sm btn-icon" data-pg="-1" ${s.page === 0 ? 'disabled' : ''}>${icon('chevLeft', 'sm')}</button><span style="padding:5px 8px">${s.page + 1} / ${pages}</span><button class="btn btn-sm btn-icon" data-pg="1" ${s.page >= pages - 1 ? 'disabled' : ''}>${icon('chevRight', 'sm')}</button></div></div>`;
      $$('th[data-sort]', body).forEach(th => th.addEventListener('click', () => {
        const c = o.columns.find(x => x.key === th.dataset.sort); if (c.sort === false) return;
        s.sort = s.sort?.key === c.key ? { key: c.key, dir: s.sort.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: 'desc' };
        this.draw();
      }));
      $$('[data-pg]', body).forEach(b => b.addEventListener('click', () => { s.page += +b.dataset.pg; this.draw(); }));
      if (o.onRow) $$('tbody tr', body).forEach(tr => tr.addEventListener('click', e => { if (e.target.closest('button, a, input, select')) return; const r = rows.find(x => String(x.id) === tr.dataset.id); if (r) o.onRow(r); }));
      if (o.afterDraw) o.afterDraw(body);
    }
    exportCsv() {
      const rows = this.rowsFiltered();
      const cols = this.o.columns.filter(c => c.csv !== false);
      const tmp = document.createElement('div');
      const text = (c, r) => { if (typeof c.csv === 'function') return c.csv(r); if (c.render) { tmp.innerHTML = c.render(r); return tmp.innerText.replace(/\s+/g, ' ').trim(); } return r[c.key]; };
      csvDownload(`${this.o.exportName}-${Store.today()}.csv`, [cols.map(c => c.label.replace(/<[^>]+>/g, '')), ...rows.map(r => cols.map(c => text(c, r)))]);
      toast(`Exported ${rows.length} rows`);
    }
  }

  function csvDownload(name, matrix) {
    const csv = matrix.map(r => r.map(v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n');
    download(name, '﻿' + csv, 'text/csv');
  }
  function download(name, text, mime = 'application/json') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: mime }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- Charts ---------- */
  function chart(canvas, cfg) {
    if (!window.Chart || !canvas) return null;
    const c = new Chart(canvas, cfg);
    charts.push(c);
    return c;
  }
  function destroyCharts() { while (charts.length) { try { charts.pop().destroy(); } catch { /* ignore */ } } }
  if (window.Chart) {
    Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
    Chart.defaults.font.size = 11.5;
    Chart.defaults.color = '#7a849c';
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    Chart.defaults.plugins.legend.labels.boxHeight = 10;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.tooltip.backgroundColor = '#1b2236';
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.maintainAspectRatio = false;
  }
  const grid = { color: '#eef1f6', drawTicks: false };
  function gradient(ctx, c1, c2) {
    const g = ctx.createLinearGradient(0, 0, 0, 260);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    return g;
  }

  /* ---------- Popover ---------- */
  function popover(anchor, html, onMount) {
    closePopover();
    const p = document.createElement('div');
    p.className = 'popover';
    p.innerHTML = html;
    anchor.style.position = 'relative';
    anchor.appendChild(p);
    const off = e => { if (!p.contains(e.target)) closePopover(); };
    setTimeout(() => document.addEventListener('click', off), 0);
    UI._pop = () => { p.remove(); document.removeEventListener('click', off); };
    if (onMount) onMount(p);
    return p;
  }
  function closePopover() { if (UI._pop) { UI._pop(); UI._pop = null; } }

  function stars(r) { const f = Math.round(r); return `<span style="color:#f5a524;letter-spacing:1px">${'★'.repeat(f)}<span style="color:#d6dbe6">${'★'.repeat(5 - f)}</span></span> <span class="muted small">${(+r).toFixed(1)}</span>`; }

  /** Wrap a mutating action: toast + refresh, errors as toasts */
  function act(fn, okMsg) {
    try { const r = fn(); if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg); App.refresh(); return r; }
    catch (e) { console.error(e); toast(e.message, 'error'); return undefined; }
  }

  return { toast, modal, formModal, confirm, drawer, closeDrawer, badge, empty, avatar, thumb, itemCell, progress, kpi, stat, options, field, input, select, formData, lineEditor, DataTable, csvDownload, download, chart, destroyCharts, grid, gradient, popover, closePopover, colorFor, initials, stars, act };
})();
