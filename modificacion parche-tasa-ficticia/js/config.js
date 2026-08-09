

function renderConfig(el) {
  const c = DB.config;
  el.innerHTML = `
<div class="grid grid-2">
  <div class="card card-pad">
    <h3 style="margin-top:0;font-size:15px;">Datos del negocio</h3>
    <div class="field"><label>Nombre del negocio</label><input id="cf_name" value="${esc(c.businessName)}"></div>
    <div class="field"><label>RIF</label><input id="cf_rif" value="${esc(c.rif || '')}"></div>
    <div class="field"><label>Dirección</label><input id="cf_addr" value="${esc(c.address || '')}"></div>
    <div class="field"><label>Teléfono</label><input id="cf_phone" value="${esc(c.phone || '')}"></div>
    <div class="row-fields">
      <div class="field"><label>Tasa del día (Bs./$)</label><input id="cf_rate" type="number" step="0.01" value="${c.exchangeRate}"></div>
      <div class="field"><label>IVA (%)</label><input id="cf_iva" type="number" step="0.01" value="${c.iva}"></div>
    </div>
    <div class="field"><label>Tasa COP/$ (opcional — deja en 0 si no la usas)</label><input id="cf_rate_cop" type="number" step="0.01" value="${c.exchangeRateCop || 0}"></div>
    <button class="btn btn-primary" onclick="guardedRun(this,saveBizConfig)">Guardar</button>
  </div>

  <div class="card card-pad">
    <h3 style="margin-top:0;font-size:15px;">Métodos de pago</h3>
    ${listEditor('paymentMethods', c.paymentMethods)}
  </div>
</div>

<div class="card card-pad" style="margin-top:16px;">
  <h3 style="margin-top:0;font-size:15px;">Tasa ficticia (protección cambiaria)</h3>
  <div class="hint" style="margin-bottom:10px;">Si la activas, todos los precios se venden un poco por encima del real para poder ofrecer un "descuento" a quien pague en divisas — y así protegerte de la devaluación del bolívar en los pagos en Bs.</div>
  <label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;margin-bottom:10px;">
    <input id="cf_use_fict" type="checkbox" ${c.useFictitiousRate ? 'checked' : ''} onchange="toggleFictRateFields(this.checked)"> Activar tasa ficticia
  </label>
  <div id="fictRateFields" style="${c.useFictitiousRate ? '' : 'opacity:.45;pointer-events:none;'}">
    <div class="row-fields">
      <div class="field"><label>Descuento a divisas (%)</label><input id="cf_cash_discount" type="number" step="1" min="0" max="99" value="${c.cashDiscountPercent ?? 20}" oninput="updateFictRatePreview()"></div>
      <div class="field"><label>Multiplicador aplicado a los precios</label><input id="cf_fict_mult" value="" readonly></div>
    </div>
    <div class="hint" id="fictRatePreview" style="margin:2px 0 12px;"></div>
    <label style="font-size:13px;font-weight:600;">¿Qué métodos de pago cuentan como "pago en divisas" (aplican el descuento)?</label>
    <div class="chip-list" style="margin-top:8px;">
      ${c.paymentMethods.filter(m => m !== 'Crédito').map(m => `
        <label style="display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:20px;padding:5px 12px;margin:0 6px 6px 0;font-size:12.5px;">
          <input type="checkbox" value="${esc(m)}" class="fict-method-chk" ${(c.divisaCashMethods || []).includes(m) ? 'checked' : ''}> ${esc(m)}
        </label>`).join('')}
    </div>
  </div>
  <button class="btn btn-primary" style="margin-top:14px;" onclick="guardedRun(this,saveFictRateConfig)">Guardar tasa ficticia</button>
</div>

<div class="grid grid-2" style="margin-top:16px;">
  <div class="card card-pad">
    <h3 style="margin-top:0;font-size:15px;">Tipos de egreso</h3>
    ${listEditor('expenseTypes', c.expenseTypes)}
  </div>
  <div class="card card-pad">
    <h3 style="margin-top:0;font-size:15px;">Vendedores</h3>
    ${listEditor('vendors', c.vendors)}
  </div>
</div>
  `;
  updateFictRatePreview();
}
function toggleFictRateFields(on) {
  document.getElementById('fictRateFields').style.cssText = on ? '' : 'opacity:.45;pointer-events:none;';
  updateFictRatePreview();
}
function updateFictRatePreview() {
  const discount = Number(document.getElementById('cf_cash_discount')?.value) || 0;
  const mult = (discount > 0 && discount < 100) ? 1 / (1 - discount / 100) : 1;
  const multEl = document.getElementById('cf_fict_mult');
  if (multEl) multEl.value = mult.toFixed(4) + 'x';
  const preview = document.getElementById('fictRatePreview');
  if (!preview) return;
  const copOficial = DB.config.exchangeRateCop || 0;
  const ejemplo = 20; // ejemplo de referencia en USD
  const inflado = ejemplo * mult;
  let txt = `Ejemplo: un producto de ${money(ejemplo, 'USD')} se vendería a <b>${money(inflado, 'USD')}</b>; si el cliente paga en divisas, con el ${discount}% de descuento queda de nuevo en ${money(ejemplo, 'USD')}.`;
  if (copOficial > 0) txt += ` Tasa ficticia COP/$ equivalente: <b>${(copOficial * mult).toLocaleString('es-VE', { maximumFractionDigits: 0 })}</b> (oficial: ${copOficial.toLocaleString('es-VE')}).`;
  preview.innerHTML = txt;
}
async function saveFictRateConfig() {
  DB.config.useFictitiousRate = document.getElementById('cf_use_fict').checked;
  DB.config.cashDiscountPercent = Number(document.getElementById('cf_cash_discount').value) || 0;
  DB.config.divisaCashMethods = Array.from(document.querySelectorAll('.fict-method-chk:checked')).map(el => el.value);
  await save('config');
  toast('Tasa ficticia guardada ✓');
  render();
}
function listEditor(key, arr) {
  return `
<div class="chip-list">${arr.map((v, i) => `<span class="chip">${esc(v)}<button onclick="removeConfigItem('${key}',${i})">✕</button></span>`).join('')}</div>
<div class="searchbar" style="margin-top:10px;">
  <input id="ci_${key}" placeholder="Añadir…" onkeydown="if(event.key==='Enter'){addConfigItem('${key}')}">
  <button class="btn btn-sm" onclick="addConfigItem('${key}')">+ Añadir</button>
</div>`;
}
async function addConfigItem(key) {
  const input = document.getElementById('ci_' + key);
  const val = input.value.trim();
  if (!val) return;
  DB.config[key].push(val);
  await save('config');
  renderConfig(document.getElementById('content'));
}
async function removeConfigItem(key, idx) {
  DB.config[key].splice(idx, 1);
  await save('config');
  renderConfig(document.getElementById('content'));
}
async function saveBizConfig() {
  DB.config.businessName = document.getElementById('cf_name').value.trim() || 'Mi Negocio';
  DB.config.rif = document.getElementById('cf_rif').value.trim();
  DB.config.address = document.getElementById('cf_addr').value.trim();
  DB.config.phone = document.getElementById('cf_phone').value.trim();
  DB.config.exchangeRate = Number(document.getElementById('cf_rate').value) || 1;
  DB.config.exchangeRateCop = Number(document.getElementById('cf_rate_cop').value) || 0;
  DB.config.iva = Number(document.getElementById('cf_iva').value) || 0;
  await save('config');
  toast('Configuración guardada ✓');
  render();
}



// Expose to global scope for inline HTML handlers
window.addConfigItem = addConfigItem;
window.listEditor = listEditor;
window.removeConfigItem = removeConfigItem;
window.renderConfig = renderConfig;
window.saveBizConfig = saveBizConfig;
window.toggleFictRateFields = toggleFictRateFields;
window.updateFictRatePreview = updateFictRatePreview;
window.saveFictRateConfig = saveFictRateConfig;
