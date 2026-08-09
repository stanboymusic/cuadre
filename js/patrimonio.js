

function renderPatrimonio(el) {
  const inv = DB.config.initialInvestment || 0;

  const inventoryValue = DB.products.reduce((a, p) => a + (p.cost || 0) * (p.stock || 0), 0);
  const receivables = DB.clients.reduce((a, c) => a + Math.max(clientBalance(c.id), 0), 0);

  // Solo cuenta como caja el dinero que realmente entró (se excluye
  // cualquier fila de pago marcada como "Crédito" por error).
  const salesCashIn = DB.sales.reduce((a, s) =>
    a + (s.payments || []).filter(p => p.method !== 'Crédito').reduce((x, p) => x + (p.amountUsd || 0), 0), 0);
  const abonosCashIn = DB.receivablePayments.reduce((a, p) => a + (p.amount || 0), 0);
  const purchasesCashOut = DB.purchases.reduce((a, p) => a + (p.totalUsd || 0), 0);
  const expensesCashOut = DB.expenses.reduce((a, e) => a + (e.amountUsd || 0), 0);

  const cash = inv + salesCashIn + abonosCashIn - purchasesCashOut - expensesCashOut;
  const patrimonioBruto = cash + inventoryValue + receivables;
  const patrimonioNeto = patrimonioBruto - inv;

  el.innerHTML = `
<div class="grid grid-2">
  <div class="card card-pad">
    <h3 style="margin-top:0;font-size:15px;">Inversión inicial</h3>
    <div class="field"><label>Capital aportado (USD)</label><input id="pt_inv" type="number" step="0.01" value="${inv}"></div>
    <button class="btn btn-primary" onclick="guardedRun(this, saveInvestment)">Guardar</button>
    <div class="hint" style="margin-top:8px;">Lo que aportaste tú (o los socios) para arrancar el negocio. Es la referencia para medir cuánto valor ha generado la operación desde entonces.</div>
  </div>
  <div class="card card-pad">
    <h3 style="margin-top:0;font-size:15px;">¿Cómo se calcula?</h3>
    <div class="hint">
      <b>Patrimonio bruto</b> = caja acumulada + inventario a costo + cuentas por cobrar.<br><br>
      <b>Patrimonio neto</b> = patrimonio bruto − inversión inicial. Es lo que el negocio ha generado por sí mismo, además de lo que pusiste tú.
    </div>
  </div>
</div>

<div class="grid grid-4" style="margin-top:16px;">
  <div class="stat"><div class="lbl">Caja acumulada</div><div class="val amt">${money(cash, 'USD')}</div><div class="sub">Inversión + cobros − compras − egresos</div></div>
  <div class="stat"><div class="lbl">Inventario (a costo)</div><div class="val amt">${money(inventoryValue, 'USD')}</div><div class="sub">${DB.products.length} producto(s)</div></div>
  <div class="stat"><div class="lbl">Cuentas por cobrar</div><div class="val amt">${money(receivables, 'USD')}</div><div class="sub">${DB.clients.filter(c => clientBalance(c.id) > 0).length} cliente(s) con saldo</div></div>
  <div class="stat ${patrimonioBruto < 0 ? 'neg' : 'pos'}"><div class="lbl">Patrimonio bruto</div><div class="val amt">${money(patrimonioBruto, 'USD')}</div><div class="sub">Activos totales del negocio</div></div>
</div>

<div class="section-title"><h2>Patrimonio neto</h2></div>
<div class="card card-pad">
  <div class="stat ${patrimonioNeto < 0 ? 'neg' : 'pos'}" style="border:none;padding:0;">
    <div class="lbl">Valor generado por la operación</div>
    <div class="val amt" style="font-size:28px;">${money(patrimonioNeto, 'USD')}</div>
    <div class="sub">Patrimonio bruto (${money(patrimonioBruto, 'USD')}) − inversión inicial (${money(inv, 'USD')})</div>
  </div>
</div>
  `;
}
async function saveInvestment() {
  DB.config.initialInvestment = Number(document.getElementById('pt_inv').value) || 0;
  await save('config');
  toast('Inversión inicial guardada ✓');
  renderPatrimonio(document.getElementById('content'));
}

(async function init() {
  const favicon = document.createElement('link');
  favicon.rel = 'icon'; favicon.href = LOGO_ICON;
  document.head.appendChild(favicon);
  await loadDB();
  render();
})();
  

// Expose to global scope for inline HTML handlers
window.renderPatrimonio = renderPatrimonio;
window.saveInvestment = saveInvestment;
