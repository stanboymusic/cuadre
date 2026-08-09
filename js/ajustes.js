

function renderAjustes(el) {
  el.innerHTML = `
<div class="card card-pad">
  <div class="row-fields">
    <div class="field"><label>Producto</label>
      <select id="aj_prod"><option value="">— Selecciona —</option>${DB.products.map(p => `<option value="${p.id}">${esc(p.name)} (existencia: ${p.stock || 0})</option>`).join('')}</select>
    </div>
    <div class="field"><label>Cantidad (+ entra / − sale)</label><input id="aj_qty" type="number" placeholder="Ej: -2 o 5"></div>
    <div class="field"><label>Motivo</label>
      <select id="aj_reason"><option>Conteo físico</option><option>Producto dañado</option><option>Vencimiento</option><option>Merma</option><option>Corrección de registro</option><option>Otro</option></select>
    </div>
  </div>
  <button class="btn btn-primary" onclick="guardedRun(this,registerAdjustment)">Registrar ajuste</button>
</div>
<div class="section-title"><h2>Historial de ajustes</h2></div>
${DB.inventoryAdjustments.length ? `
<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Producto</th><th>Cantidad</th><th>Motivo</th></tr></thead>
  <tbody>${[...DB.inventoryAdjustments].reverse().map(a => `<tr><td>${fmtDate(a.date)}</td><td>${esc(getProduct(a.productId)?.name || '—')}</td>
    <td class="amt" style="color:${a.qty < 0 ? 'var(--clay)' : 'var(--teal)'}">${a.qty > 0 ? '+' : ''}${a.qty}</td><td>${esc(a.reason)}</td></tr>`).join('')}</tbody></table></div>
` : `<div class="empty"><div class="big">±</div>Sin ajustes registrados todavía.</div>`}
  `;
}
async function registerAdjustment() {
  const productId = document.getElementById('aj_prod').value;
  const qty = Number(document.getElementById('aj_qty').value);
  const reason = document.getElementById('aj_reason').value;
  if (!productId || !qty) { toast('Selecciona producto y cantidad', true); return; }
  const p = getProduct(productId);
  p.stock = (p.stock || 0) + qty;
  DB.inventoryAdjustments.push({ id: uid('adj'), productId, qty, reason, date: todayISO(), ts: Date.now() });
  await save('products'); await save('inventoryAdjustments');
  toast('Ajuste registrado ✓');
  render();
}



// Expose to global scope for inline HTML handlers
window.registerAdjustment = registerAdjustment;
window.renderAjustes = renderAjustes;
