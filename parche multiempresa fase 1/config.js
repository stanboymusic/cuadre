

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

<div class="grid grid-2" style="margin-top:16px;">
  <div class="card card-pad">
    <h3 style="margin-top:0;font-size:15px;">Empresa (multiempresa)</h3>
    <div class="hint" style="margin-bottom:10px;">Tu usuario: <b>${esc((pb.authStore.record && (pb.authStore.record.email || pb.authStore.record.username)) || '—')}</b><br>companyId asignado: <b>${esc((pb.authStore.record && pb.authStore.record.companyId) || 'Sin asignar — pídele a tu administrador que lo configure en PocketBase')}</b></div>
    <button class="btn btn-primary" onclick="guardedRun(this,async()=>{await syncAllWithCompany(); toast('Datos sincronizados con tu empresa ✓');})">Sincronizar mis datos con mi empresa</button>
    <div class="hint" style="margin-top:8px;">Úsalo una sola vez después de que te asignen un companyId, para que tus registros existentes queden ligados a tu empresa.</div>
  </div>
</div>
  `;
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

