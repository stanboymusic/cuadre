

let REP_TAB = 'general', REP_FROM = todayISO(), REP_TO = todayISO(), REP_VENDOR = '';
function renderReportes(el) {
  el.innerHTML = `
<div class="tabs">
  ${['general', 'productos', 'clientes', 'vendedor'].map(t => `<div class="tab ${REP_TAB === t ? 'active' : ''}" onclick="REP_TAB='${t}'; render()">${({ general: 'General', productos: 'Por producto', clientes: 'Por cliente', vendedor: 'Por vendedor' })[t]}</div>`).join('')}
</div>
<div class="searchbar">
  <label style="font-size:12.5px;">Desde</label><input type="date" value="${REP_FROM}" onchange="REP_FROM=this.value; render()">
  <label style="font-size:12.5px;">Hasta</label><input type="date" value="${REP_TO}" onchange="REP_TO=this.value; render()">
  ${REP_TAB === 'vendedor' ? `<select onchange="REP_VENDOR=this.value; render()"><option value="">Todos los vendedores</option>${DB.config.vendors.map(v => `<option ${REP_VENDOR === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>` : ''}
</div>
<div id="repBody">${REP_TAB === 'general' ? repGeneral() : REP_TAB === 'productos' ? repProductos() : REP_TAB === 'clientes' ? repClientes() : repVendedor()
    }</div>
  `;
}
function salesInRange() { return DB.sales.filter(s => s.date >= REP_FROM && s.date <= REP_TO); }
function repGeneral() {
  const sales = salesInRange();
  const purchases = DB.purchases.filter(p => p.date >= REP_FROM && p.date <= REP_TO);
  const expenses = DB.expenses.filter(e => e.date >= REP_FROM && e.date <= REP_TO);
  const ingresos = sales.reduce((a, s) => a + s.totalUsd, 0);
  const cogs = sales.reduce((a, s) => a + s.items.reduce((x, it) => x + (it.cost || 0) * it.qty, 0), 0);
  const comprasUsd = purchases.reduce((a, p) => a + p.totalUsd, 0);
  const egresosUsd = expenses.reduce((a, e) => a + e.amountUsd, 0);
  const utilidadBruta = ingresos - cogs, utilidadNeta = utilidadBruta - egresosUsd;
  return `
<div class="grid grid-4">
  <div class="stat"><div class="lbl">Ingresos por ventas</div><div class="val amt">${money(ingresos, 'USD')}</div><div class="sub">${sales.length} venta(s)</div></div>
  <div class="stat"><div class="lbl">Compras</div><div class="val amt">${money(comprasUsd, 'USD')}</div></div>
  <div class="stat neg"><div class="lbl">Egresos</div><div class="val amt">${money(egresosUsd, 'USD')}</div></div>
  <div class="stat ${utilidadNeta < 0 ? 'neg' : 'pos'}"><div class="lbl">Utilidad neta</div><div class="val amt">${money(utilidadNeta, 'USD')}</div><div class="sub">Bruta: ${money(utilidadBruta, 'USD')}</div></div>
</div>`;
}
function repProductos() {
  const sales = salesInRange();
  const agg = {};
  sales.forEach(s => s.items.forEach(it => {
    if (it.kind !== 'p') return;
    if (!agg[it.refId]) agg[it.refId] = { name: it.name, qty: 0, revenue: 0, profit: 0 };
    agg[it.refId].qty += it.qty;
    agg[it.refId].revenue += it.priceUsd * it.qty;
    agg[it.refId].profit += (it.priceUsd - (it.cost || 0)) * it.qty;
  }));
  const rows = Object.values(agg);
  const topQty = [...rows].sort((a, b) => b.qty - a.qty).slice(0, 5);
  const topRev = [...rows].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const topProfit = [...rows].sort((a, b) => b.profit - a.profit).slice(0, 5);
  const block = (title, arr, key, cur) => `
<div class="section-title"><h2 style="font-size:14px;">${title}</h2></div>
${arr.length ? `<div class="table-wrap"><table><thead><tr><th>Producto</th><th style="text-align:right">${title.includes('vendidos') ? 'Cantidad' : 'Monto'}</th></tr></thead>
  <tbody>${arr.map(r => `<tr><td>${esc(r.name)}</td><td class="amt" style="text-align:right">${key === 'qty' ? r.qty : money(r[key], cur || 'USD')}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="empty">Sin datos en el rango.</div>`}`;
  return block('Top 5 más vendidos', topQty, 'qty') + block('Top 5 en facturación', topRev, 'revenue') + block('Top 5 en ganancia', topProfit, 'profit');
}
function repClientes() {
  const sales = salesInRange();
  const agg = {};
  sales.forEach(s => {
    const key = s.clientId || 'occ';
    if (!agg[key]) agg[key] = { name: s.clientName, total: 0, count: 0 };
    agg[key].total += s.totalUsd; agg[key].count += 1;
  });
  const rows = Object.values(agg).sort((a, b) => b.total - a.total);
  return rows.length ? `<div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Ventas</th><th style="text-align:right">Total comprado</th></tr></thead>
<tbody>${rows.map(r => `<tr><td>${esc(r.name)}</td><td class="amt">${r.count}</td><td class="amt" style="text-align:right">${money(r.total, 'USD')}</td></tr>`).join('')}</tbody></table></div>`
    : `<div class="empty">Sin ventas en el rango.</div>`;
}
function repVendedor() {
  let sales = salesInRange();
  if (REP_VENDOR) sales = sales.filter(s => s.vendor === REP_VENDOR);
  const agg = {};
  sales.forEach(s => {
    if (!agg[s.vendor]) agg[s.vendor] = { total: 0, count: 0 };
    agg[s.vendor].total += s.totalUsd; agg[s.vendor].count += 1;
  });
  const rows = Object.entries(agg).map(([vendor, v]) => ({ vendor, ...v })).sort((a, b) => b.total - a.total);
  return rows.length ? `<div class="table-wrap"><table><thead><tr><th>Vendedor</th><th>Ventas</th><th style="text-align:right">Total vendido</th></tr></thead>
<tbody>${rows.map(r => `<tr><td>${esc(r.vendor)}</td><td class="amt">${r.count}</td><td class="amt" style="text-align:right">${money(r.total, 'USD')}</td></tr>`).join('')}</tbody></table></div>`
    : `<div class="empty">Sin ventas en el rango.</div>`;
}



// Expose to global scope for inline HTML handlers
window.REP_TAB = REP_TAB;
window.renderReportes = renderReportes;
window.repClientes = repClientes;
window.repGeneral = repGeneral;
window.repProductos = repProductos;
window.repVendedor = repVendedor;
window.salesInRange = salesInRange;
