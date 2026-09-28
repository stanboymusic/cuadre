// js/estados-rendiciones.js
let _estRendLoc = '';
let _estRendData = null;

async function renderEstadosRendiciones(el) {
  const estados = (window._ubicaciones || []).filter(u => u.tipo === 'estado' && u.activa);
  if (!_estRendLoc && estados.length) _estRendLoc = estados[0].id;
  
  el.innerHTML = `
    <div class="searchbar">
      <select onchange="_estRendLoc=this.value; _loadEstadosRend()">
        ${estados.map(u => `<option value="${u.id}" ${_estRendLoc === u.id ? 'selected':''}>${esc(u.nombre)}</option>`).join('')}
      </select>
    </div>
    <div id="estRendWrap">⏳ Cargando cuenta...</div>
  `;
  _loadEstadosRend();
}

async function _loadEstadosRend() {
  const wrap = document.getElementById('estRendWrap');
  if (!wrap) return;
  if (!_estRendLoc) {
    wrap.innerHTML = `<div class="empty">Selecciona una ubicación.</div>`;
    return;
  }
  
  try {
    const res = await fetch('/api/cuadre/estados/' + _estRendLoc + '/cuenta', { headers: { 'Authorization': pb.authStore.token } });
    if (!res.ok) throw new Error('Error en red');
    const data = await res.json();
    _estRendData = data;
    
    let html = `
      <div class="grid grid-4" style="margin-bottom:20px;">
        <div class="stat"><div class="lbl">Vendido Total</div><div class="val amt">${money(data.vendido, 'USD')}</div></div>
        <div class="stat"><div class="lbl">Comisión (${data.ubicacion.comision_pct}%)</div><div class="val amt" style="color:var(--clay)">-${money(data.comision_monto, 'USD')}</div></div>
        <div class="stat"><div class="lbl">Neto a Rendir</div><div class="val amt" style="color:var(--gold-deep)">${money(data.neto, 'USD')}</div></div>
        <div class="stat ${data.saldo > 0 ? 'neg':'pos'}"><div class="lbl">Saldo Pendiente</div><div class="val amt" style="font-size:24px;">${money(data.saldo, 'USD')}</div></div>
      </div>
      
      <div style="margin-bottom:20px;">
        <button class="btn btn-primary" onclick="openRendicionForm()">Registrar Rendición</button>
      </div>
      
      <div class="section-title"><h2>Últimos Movimientos</h2></div>
    `;
    
    if (!data.movimientos || !data.movimientos.length) {
      html += `<div class="empty">No hay movimientos aún.</div>`;
    } else {
      let trs = data.movimientos.map(m => {
        const isRend = m.tipo === 'rendicion';
        const col = isRend ? 'var(--teal)' : 'var(--ink)';
        const lbl = isRend ? `Rendición (${esc(m.metodo)})` : `Venta`;
        return `<tr>
          <td>${fmtDate(m.fecha, true)}</td>
          <td><span class="tag ${isRend ? 'tag-teal':'tag-muted'}">${lbl}</span></td>
          <td class="amt" style="color:${col};font-weight:600;">${money(Math.abs(m.monto), 'USD')}</td>
        </tr>`;
      }).join('');
      html += `<div class="table-wrap" style="overflow-x:auto;"><table><thead><tr><th>Fecha</th><th>Concepto</th><th style="text-align:right">Monto</th></tr></thead><tbody>${trs}</tbody></table></div>`;
    }
    
    wrap.innerHTML = html;
  } catch(err) {
    console.error(err);
    toast('Error cargando estado de cuenta', true);
    wrap.innerHTML = `<div class="empty">Error de conexión</div>`;
  }
}

function openRendicionForm() {
  if (!_estRendData) return;
  const saldo = _estRendData.saldo;
  if (saldo <= 0) {
    toast('No hay saldo pendiente por rendir', true);
    return;
  }
  
  const mid = openModal(`
    <div class="modal-head"><h3>Registrar Rendición</h3><button class="x-close">✕</button></div>
    <div class="modal-body">
      <div class="field">
        <label>Monto a rendir (USD)</label>
        <input type="number" step="0.01" id="rendMonto" max="${saldo}" value="${saldo.toFixed(2)}">
        <div class="hint">Saldo actual: ${money(saldo, 'USD')}</div>
      </div>
      <div class="field">
        <label>Método</label>
        <select id="rendMetodo">
          ${DB.config.paymentMethods.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Nota (opcional)</label>
        <input type="text" id="rendNota" placeholder="Ej: Depósito bancario #1234">
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="closeModal(MID)">Cancelar</button>
      <button class="btn btn-primary" onclick="guardedRun(this, guardarRendicion)">Guardar</button>
    </div>
  `);
  fixModal(mid);
}

async function guardarRendicion() {
  const monto = Number(document.getElementById('rendMonto').value) || 0;
  if (monto <= 0) { toast('El monto debe ser mayor a 0', true); return; }
  if (monto > _estRendData.saldo + 0.01) { toast('El monto excede el saldo pendiente', true); return; }
  
  const data = {
    ubicacion: _estRendLoc,
    monto: monto,
    metodo: document.getElementById('rendMetodo').value,
    nota: document.getElementById('rendNota').value.trim()
  };
  
  await pb.collection('rendiciones').create(data);
  toast('Rendición registrada ✓');
  closeTopModal();
  _loadEstadosRend();
}
