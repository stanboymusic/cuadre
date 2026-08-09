

function renderEgresos(el) {
  const today = todayISO();
  const todays = expensesOnDate(today);
  el.innerHTML = `
<div class="card card-pad">
  <div class="row-fields">
    <div class="field"><label>Tipo de egreso</label>
      <select id="eg_type">
        ${DB.config.expenseTypes.map(t => `<option>${esc(t)}</option>`).join('')}
        ${DB.config.expenseTypes.includes('Sueldos') ? '' : ''}
      </select>
    </div>
    <div class="field" id="eg_vendor_wrap" style="display:none;"><label>Vendedor</label>
      <select id="eg_vendor">${DB.config.vendors.map(v => `<option>${esc(v)}</option>`).join('')}</select>
    </div>
    <div class="field"><label>Monto (USD)</label><input id="eg_amount" type="number" step="0.01"></div>
    <div class="field"><label>Método de pago</label><select id="eg_method">${DB.config.paymentMethods.filter(m => m !== 'Crédito').map(m => `<option>${esc(m)}</option>`).join('')}</select></div>
  </div>
  <div class="field"><label>Nota (opcional)</label><input id="eg_note" placeholder="Detalle del egreso"></div>
  <button class="btn btn-primary" onclick="guardedRun(this,registerExpense)">Registrar egreso</button>
</div>
<div class="section-title"><h2>Egresos de hoy</h2></div>
${todays.length ? `
<div class="table-wrap"><table><thead><tr><th>Tipo</th><th>Nota</th><th>Método</th><th style="text-align:right">Monto</th></tr></thead>
  <tbody>${todays.map(e => `<tr><td>${esc(e.type)}</td><td>${esc(e.note || '—')}</td><td>${esc(e.method)}</td><td class="amt" style="text-align:right">${money(e.amountUsd, 'USD')}</td></tr>`).join('')}</tbody></table></div>
` : `<div class="empty"><div class="big">⇧</div>Sin egresos registrados hoy.</div>`}
  `;
  document.getElementById('eg_type').addEventListener('change', toggleVendorWrap);
  toggleVendorWrap();
  function toggleVendorWrap() {
    document.getElementById('eg_vendor_wrap').style.display = document.getElementById('eg_type').value === 'Sueldos' ? '' : 'none';
  }
}
async function registerExpense() {
  const type = document.getElementById('eg_type').value;
  const amountUsd = Number(document.getElementById('eg_amount').value) || 0;
  const method = document.getElementById('eg_method').value;
  const vendor = document.getElementById('eg_vendor_wrap').style.display !== 'none' ? document.getElementById('eg_vendor').value : '';
  const note = document.getElementById('eg_note').value.trim() || (vendor ? ('Sueldo — ' + vendor) : '');
  if (amountUsd <= 0) { toast('Ingresa un monto válido', true); return; }
  DB.expenses.push({ id: uid('egr'), type, amountUsd, method, note, date: todayISO(), ts: Date.now() });
  await save('expenses');
  toast('Egreso registrado ✓');
  render();
}



// Expose to global scope for inline HTML handlers
window.registerExpense = registerExpense;
window.renderEgresos = renderEgresos;
