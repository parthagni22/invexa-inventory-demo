/* Dashboard */
Pages.dashboard = {
  title: 'Dashboard',
  render(el) {
    const db = Store.db, t = Store.today();
    const user = App.user;
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    const rev30 = Calc.revenueByDay(30), rev60 = Calc.revenueByDay(60);
    const cur = rev30.reduce((s, x) => s + x.v, 0);
    const prev = rev60.slice(0, 30).reduce((s, x) => s + x.v, 0);
    const growth = prev ? (cur - prev) / prev * 100 : 0;
    const invVal = Calc.inventoryValue();
    const fgVal = Calc.inventoryValue(b => Store.item(b.itemId)?.type === 'finished');
    const rec = Calc.receivables();
    const todaySO = db.salesOrders.filter(s => s.date === t && s.status !== 'Cancelled');
    const todayRev = todaySO.reduce((s, x) => s + Calc.net(x), 0);
    const kg7 = Calc.productionKgByDay(7);
    const util = kg7.reduce((s, x) => s + x.v, 0) / 7 / (db.company.capacityKg || 1000) * 100;
    const skus = db.items.filter(i => i.active).length;
    const fgUnits = db.batches.filter(b => b.qty > 0 && Store.isUsable(b) && Store.item(b.itemId)?.type === 'finished').reduce((s, b) => s + b.qty, 0);
    const expiring = db.batches.filter(b => Store.batchStatus(b) === 'Expiring');
    const expired = db.batches.filter(b => Store.batchStatus(b) === 'Expired');
    const alerts = Store.alerts();

    const sold = Calc.unitsSoldByItem(30);
    const top = db.items.filter(i => i.type === 'finished').map(i => ({ it: i, ...(sold[i.id] || { qty: 0, rev: 0 }), stock: Store.stock(i.id) }))
      .sort((a, b) => b.rev - a.rev).slice(0, 6);

    el.innerHTML = `
      <div class="hero">
        <div><h2>${greet}, ${esc(user.name.split(' ')[0])} 👋</h2><p>${fmt.date(t)} · Here's what's happening across your plant, cold rooms and sales channels.</p></div>
        <div class="hero-stats">
          <div class="hero-stat"><div class="v">${fmt.compact(todayRev)}</div><div class="l">Booked today (${todaySO.length} orders)</div></div>
          <div class="hero-stat"><div class="v">${fmt.num(db.productions.filter(m => m.status === 'Completed' && m.completedAt > Date.now() - 86400000).reduce((s, m) => s + m.good * (Store.item(m.itemId)?.weightKg || 0), 0))} kg</div><div class="l">Produced · last 24h</div></div>
          <div class="hero-stat"><div class="v">${fmt.pct(util, 0)}</div><div class="l">Plant utilisation (7d)</div></div>
        </div>
      </div>
      <div class="grid grid-4">
        ${UI.kpi({ label: 'Inventory value', value: fmt.compact(invVal), ic: 'database', tone: 'blue', foot: `Finished goods ${fmt.compact(fgVal)} · ${skus} SKUs` })}
        ${UI.kpi({ label: 'Revenue · last 30 days', value: fmt.compact(cur), ic: 'trendUp', tone: 'green', foot: `<span class="${growth >= 0 ? 'trend-up' : 'trend-down'}">${growth >= 0 ? '▲' : '▼'} ${fmt.pct(Math.abs(growth))}</span> vs previous 30 days` })}
        ${UI.kpi({ label: 'Finished goods on hand', value: fmt.num(fgUnits) + ' <span style="font-size:14px;color:var(--muted);font-weight:500">packs</span>', ic: 'box', tone: 'violet', foot: `<span class="${expiring.length ? 'text-warning' : ''}">${expiring.length} batches expiring</span> · <span class="${expired.length ? 'text-danger' : ''}">${expired.length} expired</span>` })}
        ${UI.kpi({ label: 'Receivables', value: fmt.compact(rec.due), ic: 'wallet', tone: rec.overdue ? 'amber' : 'cyan', foot: `<span class="${rec.overdue ? 'text-danger' : ''}">${fmt.compact(rec.overdue)} overdue</span>` })}
      </div>

      <div class="grid grid-main mt-16">
        <div class="card"><div class="card-head"><div><div class="card-title">Sales vs production</div><div class="card-sub">Net sales (₹, ex-GST) and packs produced — last 30 days</div></div>
          <div class="seg" id="rng"><button data-r="14">14D</button><button data-r="30" class="active">30D</button><button data-r="60">60D</button></div></div>
          <div class="card-body"><div class="chart-box"><canvas id="c-trend"></canvas></div></div></div>
        <div class="card"><div class="card-head"><div><div class="card-title">Action centre</div><div class="card-sub">${alerts.length} item(s) need attention</div></div><a href="#/reports" class="small">Reports →</a></div>
          <div class="card-body" style="padding-top:6px;max-height:330px;overflow:auto">${alerts.length ? alerts.slice(0, 9).map(a => `
            <a class="list-row" href="${a.route}" style="color:inherit"><div class="dot-ic ${{ red: 'ti-red', amber: 'ti-amber', blue: 'ti-blue' }[a.sev]}">${icon({ low: 'box', expiring: 'clock', expired: 'alert', po: 'cart', so: 'truck', temp: 'thermo', trf: 'transfer' }[a.kind])}</div>
            <div class="meta"><div class="t">${esc(a.title)}</div><div class="s">${esc(a.sub)}</div></div>${icon('chevRight', 'sm')}</a>`).join('') : UI.empty('checkCircle', 'All clear', 'Nothing needs attention')}</div></div>
      </div>

      <div class="grid grid-3 mt-16">
        <div class="card"><div class="card-head"><div><div class="card-title">Stock value by category</div><div class="card-sub">At batch cost</div></div></div><div class="card-body"><div class="chart-box sm"><canvas id="c-cat"></canvas></div></div></div>
        <div class="card"><div class="card-head"><div><div class="card-title">Expiry risk</div><div class="card-sub">Finished-goods value by days to expiry</div></div><a href="#/batches" class="small">Batches →</a></div><div class="card-body"><div class="chart-box sm"><canvas id="c-exp"></canvas></div></div></div>
        <div class="card"><div class="card-head"><div><div class="card-title">Cold chain & capacity</div><div class="card-sub">Latest sensor reading · space used</div></div><a href="#/warehouses" class="small">Details →</a></div>
          <div class="card-body" style="padding-top:8px">${db.warehouses.map(w => {
            const last = [...db.tempLogs].reverse().find(l => l.whId === w.id);
            const units = db.batches.filter(b => b.whId === w.id && b.qty > 0 && Store.item(b.itemId)?.type === 'finished').reduce((s, b) => s + b.qty, 0);
            const rawKg = db.batches.filter(b => b.whId === w.id && b.qty > 0 && Store.item(b.itemId)?.type !== 'finished').reduce((s, b) => s + b.qty, 0);
            const used = Math.min(100, (units + rawKg * 0.3) / (w.capacity || 1) * 100);
            return `<div class="list-row"><div class="dot-ic ${last && !last.ok ? 'ti-red' : 'ti-cyan'}">${icon('thermo')}</div><div class="meta"><div class="flex-between"><div class="t">${esc(w.name)}</div><b class="${last && !last.ok ? 'temp-bad' : 'temp-ok'}">${last ? last.temp + '°C' : '—'}</b></div>
              <div class="flex" style="gap:10px"><div class="grow">${UI.progress(used, used > 85 ? 'red' : used > 65 ? 'amber' : 'green')}</div><span class="s">${fmt.pct(used, 0)}</span></div></div></div>`;
          }).join('')}</div></div>
      </div>

      <div class="grid grid-main mt-16">
        <div class="card"><div class="card-head"><div><div class="card-title">Top products · 30 days</div><div class="card-sub">Units sold, revenue and days of stock cover</div></div><a href="#/items" class="small">Catalog →</a></div>
          <div class="card-body table-wrap" style="padding:8px 0 0"><table class="tbl compact"><thead><tr><th>Product</th><th class="right">Units sold</th><th class="right">Revenue</th><th class="right">On hand</th><th style="width:150px">Days of cover</th></tr></thead><tbody>
          ${top.map(r => { const cover = r.qty ? r.stock / (r.qty / 30) : 99; return `<tr class="clickable" onclick="location.hash='#/items?id=${r.it.id}'"><td>${UI.itemCell(r.it, esc(r.it.category))}</td><td class="right">${fmt.num(r.qty)}</td><td class="right fw-600">${fmt.compact(r.rev)}</td><td class="right">${fmt.num(r.stock)}</td>
            <td><div class="flex" style="gap:8px"><div class="grow">${UI.progress(Math.min(100, cover / 10 * 100), cover < 2 ? 'red' : cover < 4 ? 'amber' : 'green')}</div><span class="small">${cover >= 99 ? '—' : cover.toFixed(1) + 'd'}</span></div></td></tr>`; }).join('')}
          </tbody></table></div></div>
        <div class="card"><div class="card-head"><div><div class="card-title">Recent activity</div><div class="card-sub">Audit trail across modules</div></div>${App.can('activity') ? '<a href="#/activity" class="small">View all →</a>' : ''}</div>
          <div class="card-body" style="padding-top:6px">${db.activity.slice(0, 7).map(a => `<div class="list-row">${UI.avatar(a.user, 30)}<div class="meta"><div class="t" style="font-weight:500"><b>${esc(a.user)}</b> ${esc(a.action.toLowerCase())} ${esc(a.entity.toLowerCase())} <span class="mono">${esc(a.ref || '')}</span></div><div class="s">${esc(a.detail || '')} · ${fmt.rel(a.ts)}</div></div></div>`).join('')}</div></div>
      </div>`;

    // charts
    const trend = range => {
      const r = Calc.revenueByDay(range), p = Calc.productionByDay(range);
      const cv = $('#c-trend', el), ctx = cv.getContext('2d');
      UI.chart(cv, {
        data: {
          labels: r.map(x => fmt.short(x.d)),
          datasets: [
            { type: 'bar', label: 'Net sales (₹)', data: r.map(x => Math.round(x.v)), backgroundColor: UI.gradient(ctx, 'rgba(47,111,237,.9)', 'rgba(106,92,255,.55)'), borderRadius: 5, maxBarThickness: 18, yAxisID: 'y' },
            { type: 'line', label: 'Packs produced', data: p.map(x => x.v), borderColor: '#12a46b', backgroundColor: 'rgba(18,164,107,.08)', fill: true, tension: .35, pointRadius: 0, borderWidth: 2, yAxisID: 'y1' },
          ],
        },
        options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'top', align: 'end' }, tooltip: { callbacks: { label: c => c.dataset.yAxisID === 'y' ? ` ${fmt.money(c.raw)}` : ` ${fmt.num(c.raw)} packs` } } },
          scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } }, y: { grid: UI.grid, border: { display: false }, ticks: { callback: v => fmt.compact(v) } }, y1: { position: 'right', grid: { display: false }, border: { display: false } } } },
      });
    };
    trend(30);
    $$('#rng button', el).forEach(b => b.addEventListener('click', () => {
      $$('#rng button', el).forEach(x => x.classList.toggle('active', x === b));
      Chart.getChart($('#c-trend', el))?.destroy();
      trend(+b.dataset.r);
    }));

    const cats = {};
    for (const b of db.batches) if (b.qty > 0) { const c = Store.item(b.itemId)?.category || 'Other'; cats[c] = (cats[c] || 0) + b.qty * b.cost; }
    const catArr = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const top6 = catArr.slice(0, 6); const rest = catArr.slice(6).reduce((s, x) => s + x[1], 0);
    if (rest) top6.push(['Others', rest]);
    UI.chart($('#c-cat', el), {
      type: 'doughnut',
      data: { labels: top6.map(x => x[0]), datasets: [{ data: top6.map(x => Math.round(x[1])), backgroundColor: ['#2f6fed', '#6a5cff', '#12a46b', '#e98a07', '#0b9bd8', '#e5484d', '#94a3b8'], borderWidth: 2, borderColor: '#fff' }] },
      options: { cutout: '68%', plugins: { legend: { position: 'right' }, tooltip: { callbacks: { label: c => ` ${c.label}: ${fmt.compact(c.raw)}` } } } },
    });

    const buckets = [['Expired', 0], ['0–3 d', 0], ['4–7 d', 0], ['8–15 d', 0], ['16–30 d', 0], ['30+ d', 0]];
    for (const b of db.batches) {
      if (b.qty <= 0 || Store.item(b.itemId)?.type !== 'finished' || !b.exp) continue;
      const d = Store.daysBetween(t, b.exp), v = b.qty * b.cost;
      buckets[d < 0 ? 0 : d <= 3 ? 1 : d <= 7 ? 2 : d <= 15 ? 3 : d <= 30 ? 4 : 5][1] += v;
    }
    UI.chart($('#c-exp', el), {
      type: 'bar',
      data: { labels: buckets.map(b => b[0]), datasets: [{ data: buckets.map(b => Math.round(b[1])), backgroundColor: ['#e5484d', '#f77b7f', '#e98a07', '#f7b33b', '#5b8dff', '#12a46b'], borderRadius: 6, maxBarThickness: 34 }] },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${fmt.money(c.raw)}` } } }, scales: { x: { grid: { display: false } }, y: { grid: UI.grid, border: { display: false }, ticks: { callback: v => fmt.compact(v) } } } },
    });
  },
};
