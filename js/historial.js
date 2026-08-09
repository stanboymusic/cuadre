

let HIST_TYPE = '';
function renderHistorial(el) {
  let rows = unifiedHistory();
  if (HIST_TYPE) rows = rows.filter(r => r.type === HIST_TYPE);
  el.innerHTML = `
<div class="searchbar">
  <select onchange="HIST_TYPE=this.value; render()">
    <option value="">Todos los movimientos</option>
    <option value="venta" ${HIST_TYPE === 'venta' ? 'selected' : ''}>Ventas</option>
    <option value="compra" ${HIST_TYPE === 'compra' ? 'selected' : ''}>Compras (proveedores)</option>
    <option value="egreso" ${HIST_TYPE === 'egreso' ? 'selected' : ''}>Egresos</option>
    <option value="ajuste" ${HIST_TYPE === 'ajuste' ? 'selected' : ''}>Ajustes de inventario</option>
    <option value="cierre" ${HIST_TYPE === 'cierre' ? 'selected' : ''}>Cierres de caja (aperturas)</option>
    <option value="abono" ${HIST_TYPE === 'abono' ? 'selected' : ''}>Abonos</option>
  </select>
</div>
${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th style="text-align:right">Monto</th></tr></thead>
  <tbody>${rows.map(r => `<tr><td>${fmtDate(r.date)}</td><td>${histTag(r.type)}</td><td>${esc(r.detail)}</td><td class="amt" style="text-align:right">${r.amountLabel}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="empty"><div class="big">☰</div>Sin movimientos para este filtro.</div>`}
  `;
}



// Expose to global scope for inline HTML handlers
window.HIST_TYPE = HIST_TYPE;
window.renderHistorial = renderHistorial;
