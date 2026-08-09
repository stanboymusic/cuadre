

function renderDashboard(el) {
  const today = todayISO();
  const tSales = salesOnDate(today);
  const tExpenses = expensesOnDate(today);
  const totalVentasBs = tSales.reduce((a, s) => a + s.totalBs, 0);
  const totalVentasUsd = tSales.reduce((a, s) => a + s.totalUsd, 0);
  const cogs = tSales.reduce((a, s) => a + s.items.reduce((x, it) => x + (it.cost || 0) * it.qty, 0), 0);
  const totalEgresosUsd = tExpenses.reduce((a, e) => a + (e.amountUsd || 0), 0);
  const utilidadBruta = totalVentasUsd - cogs;
  const utilidadNeta = utilidadBruta - totalEgresosUsd;
  const lowStock = DB.products.filter(p => (p.stock || 0) <= (p.minStock || 0));
  const receivables = DB.clients.reduce((a, c) => a + Math.max(clientBalance(c.id), 0), 0);

  el.innerHTML = `
<div class="grid grid-4">
  <div class="stat"><div class="lbl">Ventas de hoy</div><div class="val amt">${money(totalVentasBs, 'Bs')}</div><div class="sub">${money(totalVentasUsd, 'USD')} · ${tSales.length} venta(s)</div></div>
  <div class="stat pos"><div class="lbl">Utilidad bruta hoy</div><div class="val amt">${money(utilidadBruta, 'USD')}</div><div class="sub">Ventas − costo de mercancía</div></div>
  <div class="stat ${utilidadNeta < 0 ? 'neg' : 'pos'}"><div class="lbl">Utilidad neta hoy</div><div class="val amt">${money(utilidadNeta, 'USD')}</div><div class="sub">− ${money(totalEgresosUsd, 'USD')} en egresos</div></div>
  <div class="stat"><div class="lbl">Cuentas por cobrar</div><div class="val amt">${money(receivables, 'USD')}</div><div class="sub">${DB.clients.filter(c => clientBalance(c.id) > 0).length} cliente(s) con saldo</div></div>
</div>

<div class="section-title"><h2>Accesos rápidos</h2></div>
<div class="grid grid-4">
  <div class="card card-pad" style="cursor:pointer" onclick="navigate('ventas')"><b>✦ Registrar venta</b><div class="hint" style="margin-top:6px;color:var(--ink-soft)">Nueva venta de productos o servicios</div></div>
  <div class="card card-pad" style="cursor:pointer" onclick="navigate('compras')"><b>⇩ Registrar compra</b><div class="hint" style="margin-top:6px;color:var(--ink-soft)">Entrada de mercancía y proveedores</div></div>
  <div class="card card-pad" style="cursor:pointer" onclick="navigate('egresos')"><b>⇧ Registrar egreso</b><div class="hint" style="margin-top:6px;color:var(--ink-soft)">Sueldos, alquiler, servicios…</div></div>
  <div class="card card-pad" style="cursor:pointer" onclick="navigate('cierre')"><b>▤ Cierre de caja</b><div class="hint" style="margin-top:6px;color:var(--ink-soft)">Cuadrar el efectivo del día</div></div>
</div>

<div class="section-title"><h2>Inventario bajo mínimo</h2></div>
${lowStock.length ? `
  <div class="table-wrap"><table><thead><tr><th>Producto</th><th>Existencia</th><th>Mínimo</th></tr></thead>
  <tbody>${lowStock.map(p => `<tr><td>${esc(p.name)}</td><td class="amt">${p.stock || 0}</td><td class="amt">${p.minStock || 0}</td></tr>`).join('')}</tbody></table></div>
` : `<div class="card card-pad" style="color:var(--ink-soft)">Todo el inventario está por encima del mínimo configurado.</div>`}

<div class="section-title"><h2>Últimos movimientos</h2></div>
${renderMiniHistorial()}
  `;
}
function renderMiniHistorial() {
  const rows = unifiedHistory().slice(0, 8);
  if (!rows.length) return `<div class="empty"><div class="big">🗒️</div>Todavía no hay movimientos registrados.</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th style="text-align:right">Monto</th></tr></thead>
<tbody>${rows.map(r => `<tr><td>${fmtDate(r.date)}</td><td>${histTag(r.type)}</td><td>${esc(r.detail)}</td><td class="amt" style="text-align:right">${r.amountLabel}</td></tr>`).join('')}</tbody></table></div>`;
}
function histTag(type) {
  const map = { venta: ['Venta', 'tag-teal'], compra: ['Compra', 'tag-gold'], egreso: ['Egreso', 'tag-clay'], ajuste: ['Ajuste', 'tag-muted'], cierre: ['Cierre', 'tag-muted'], abono: ['Abono', 'tag-teal'] };
  const [label, cls] = map[type] || [type, 'tag-muted'];
  return `<span class="tag ${cls}">${label}</span>`;
}
function unifiedHistory() {
  const rows = [];
  DB.sales.forEach(s => rows.push({ date: s.date, ts: s.ts, type: 'venta', detail: `Venta #${s.ticketNo} — ${s.clientName || 'Cliente ocasional'}`, amountLabel: money(s.totalBs, 'Bs') }));
  DB.purchases.forEach(p => rows.push({ date: p.date, ts: p.ts, type: 'compra', detail: `Compra #${p.purchaseNo} — ${getSupplier(p.supplierId)?.name || 'Proveedor'}`, amountLabel: money(p.totalUsd, 'USD') }));
  DB.expenses.forEach(e => rows.push({ date: e.date, ts: e.ts, type: 'egreso', detail: `${e.type}${e.note ? ' — ' + e.note : ''}`, amountLabel: money(e.amountUsd, 'USD') }));
  DB.inventoryAdjustments.forEach(a => rows.push({ date: a.date, ts: a.ts, type: 'ajuste', detail: `${getProduct(a.productId)?.name || 'Producto'} · ${a.qty > 0 ? '+' : ''}${a.qty} (${a.reason})`, amountLabel: '' }));
  DB.cashClosings.forEach(c => rows.push({ date: c.date, ts: c.ts, type: 'cierre', detail: `Cierre de caja del ${fmtDate(c.date)}`, amountLabel: money(c.diffUsd || 0, 'USD') }));
  DB.receivablePayments.forEach(p => rows.push({ date: p.date, ts: p.ts, type: 'abono', detail: `Abono de ${getClient(p.clientId)?.name || 'cliente'}`, amountLabel: money(p.amount, 'USD') }));
  return rows.sort((a, b) => (b.ts || 0) - (a.ts || 0));
}



// Expose to global scope for inline HTML handlers
window.histTag = histTag;
window.renderDashboard = renderDashboard;
window.renderMiniHistorial = renderMiniHistorial;
window.unifiedHistory = unifiedHistory;
