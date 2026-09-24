// js/estados-envios.js — Pestaña de Envíos del módulo Estados.
// Requiere: estados-api.js, estados-calc.js, estados.js
// Punto 2: llama a window._reloadUbicaciones (de estados.js) si es necesario, 
// y el render principal lo maneja renderEstadosEnvios

let _enviosData = {
  envios: [],
  filtros: { estado: '', destino: '' }
};

async function _loadEnvios() {
  try {
    let filter = '';
    if (_enviosData.filtros.estado) filter += `estado="${_enviosData.filtros.estado}"`;
    if (_enviosData.filtros.destino) filter += (filter ? ' && ' : '') + `destino="${_enviosData.filtros.destino}"`;
    
    _enviosData.envios = await EstadosAPI.listarEnvios(filter);
  } catch (err) {
    console.error('Error cargando envíos:', err);
    toast('Error cargando envíos', true);
  }
}

async function renderEstadosEnvios(el) {
  el.innerHTML = `<div class="empty">⏳ Cargando envíos...</div>`;
  await _loadEnvios();

  const ubicaciones = window._ubicaciones || [];
  const estados = ubicaciones.filter(u => u.tipo === 'estado' && u.activa);

  let html = `
    <div class="section-title">
      <h2>Registro de envíos</h2>
      <button class="btn btn-gold" onclick="openNuevoEnvioModal()">+ Nuevo envío</button>
    </div>
    
    <div class="card card-pad" style="margin-bottom: 16px;">
      <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
        <select id="filtro_estado" onchange="actualizarFiltrosEnvio()">
          <option value="">Todos los estados</option>
          ${Object.entries(EstadosCalc.ESTADO_ENVIO).map(([k, v]) => `<option value="${k}" ${_enviosData.filtros.estado === k ? 'selected' : ''}>${v.label}</option>`).join('')}
        </select>
        <select id="filtro_destino" onchange="actualizarFiltrosEnvio()">
          <option value="">Todos los destinos</option>
          ${estados.map(u => `<option value="${u.id}" ${_enviosData.filtros.destino === u.id ? 'selected' : ''}>${esc(u.nombre)}</option>`).join('')}
        </select>
      </div>
    </div>
  `;

  if (_enviosData.envios.length === 0) {
    html += `<div class="empty"><div class="big">📦</div>No hay envíos que coincidan con los filtros.</div>`;
  } else {
    html += `<div class="grid grid-2" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));">`;
    _enviosData.envios.forEach(e => {
      const stateInfo = EstadosCalc.ESTADO_ENVIO[e.estado] || { label: e.estado, color: '#ccc' };
      const isDelayed = EstadosCalc.envioRetrasado(e);
      const destName = e.expand?.destino?.nombre || 'Desconocido';
      
      html += `
        <div class="card card-pad" style="cursor:pointer;" onclick="openEnvioDetalle('${e.id}')">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <b>${e.codigo}</b>
            <span class="tag" style="background:${stateInfo.color}; color:white;">${stateInfo.label}</span>
          </div>
          <div style="font-size:13px; color:var(--ink-soft); margin-bottom:4px;">
            📍 Destino: ${esc(destName)}
          </div>
          ${isDelayed ? `<div style="font-size:12px; color:var(--clay); margin-top:8px;">⚠️ Retrasado (Est: ${e.fecha_estimada ? fmtDate(e.fecha_estimada) : '?'})</div>` : ''}
          <div style="font-size:12px; color:var(--ink-soft); margin-top:8px;">
            📅 Creado: ${fmtDate(e.created)}
          </div>
        </div>
      `;
    });
    html += `</div>`;
  }
  
  el.innerHTML = html;
}

window.actualizarFiltrosEnvio = function() {
  _enviosData.filtros.estado = document.getElementById('filtro_estado').value;
  _enviosData.filtros.destino = document.getElementById('filtro_destino').value;
  const content = document.getElementById('est-content');
  if (content) renderEstadosEnvios(content);
};

// ── Modales ──────────────────────────────────────────────────────────────────

window.openNuevoEnvioModal = function() {
  const ubicaciones = window._ubicaciones || [];
  const estados = ubicaciones.filter(u => u.tipo === 'estado' && u.activa);
  
  if (estados.length === 0) {
    toast('Debes crear al menos una ubicación de estado activa primero', true);
    return;
  }
  
  const mid = openModal(`
    <div class="modal-head">
      <h3>Nuevo Envío</h3>
      <button class="x-close" onclick="closeModal('_nuevo_envio')">✕</button>
    </div>
    <div class="modal-body">
      <div class="field">
        <label>Destino</label>
        <select id="ne_destino">
          ${estados.map(u => `<option value="${u.id}">${esc(u.nombre)}</option>`).join('')}
        </select>
      </div>
      <div class="row-fields">
        <div class="field">
          <label>Transportista <span style="font-weight:400;color:var(--ink-soft);">(opcional)</span></label>
          <input id="ne_transportista" placeholder="Ej. Tealca, MRW...">
        </div>
        <div class="field">
          <label>Guía <span style="font-weight:400;color:var(--ink-soft);">(opcional)</span></label>
          <input id="ne_guia">
        </div>
      </div>
      <div class="row-fields">
        <div class="field">
          <label>Costo de Flete ($)</label>
          <input id="ne_flete" type="number" step="0.01" min="0" value="0">
        </div>
        <div class="field">
          <label>Fecha estimada <span style="font-weight:400;color:var(--ink-soft);">(opcional)</span></label>
          <input id="ne_fecha" type="date">
        </div>
      </div>
      <div class="field">
        <label>Notas <span style="font-weight:400;color:var(--ink-soft);">(opcional)</span></label>
        <input id="ne_notas">
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="closeTopModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardedRun(this, crearEnvio)">Crear envío</button>
    </div>
  `);
  if (typeof fixModal === 'function') fixModal(mid);
};

window.crearEnvio = async function() {
  const destino = document.getElementById('ne_destino').value;
  const transportista = document.getElementById('ne_transportista').value.trim();
  const guia = document.getElementById('ne_guia').value.trim();
  const flete = Number(document.getElementById('ne_flete').value) || 0;
  const fecha = document.getElementById('ne_fecha').value;
  const notas = document.getElementById('ne_notas').value.trim();

  try {
    const e = await EstadosAPI.crearEnvio({
      destino,
      transportista,
      guia,
      costo_flete: flete,
      fecha_estimada: fecha ? new Date(fecha).toISOString() : null,
      notas
    });
    closeTopModal();
    toast('Envío creado ✓');
    openEnvioDetalle(e.id);
  } catch (err) {
    toast(EstadosAPI.msgError(err), true);
  }
};

window.openEnvioDetalle = async function(id) {
  const mid = openModal(`<div class="modal-body"><div class="empty">⏳ Cargando detalles...</div></div>`);
  if (typeof fixModal === 'function') fixModal(mid);
  
  try {
    const data = await EstadosAPI.detalleEnvio(id);
    _renderEnvioDetalleInner(mid, data);
  } catch (err) {
    closeTopModal();
    toast(EstadosAPI.msgError(err), true);
  }
};

function _renderEnvioDetalleInner(mid, data) {
  const { envio, items, eventos } = data;
  const modalEl = document.querySelector('.modal-overlay:last-child .modal');
  if (!modalEl) return;
  
  const stateInfo = EstadosCalc.ESTADO_ENVIO[envio.estado] || { label: envio.estado, color: '#ccc' };
  
  let html = `
    <div class="modal-head">
      <h3>Envío ${envio.codigo}</h3>
      <button class="x-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body" style="padding-bottom:10px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div>📍 Destino: <b>${esc(envio.expand?.destino?.nombre || '')}</b></div>
        <span class="tag" style="background:${stateInfo.color}; color:white;">${stateInfo.label}</span>
      </div>
      
      <div class="grid grid-2" style="font-size:13px; color:var(--ink-soft); margin-bottom:16px; background:var(--bg-card); padding:10px; border-radius:8px;">
        <div>🚛 Transp: ${esc(envio.transportista || '—')}</div>
        <div>📄 Guía: ${esc(envio.guia || '—')}</div>
        <div>💰 Flete: $${envio.costo_flete || 0}</div>
        <div>📅 Est: ${envio.fecha_estimada ? fmtDate(envio.fecha_estimada) : '—'}</div>
      </div>
  `;
  
  // Lista de items
  html += `
    <div class="section-title"><h4>Productos</h4></div>
  `;
  
  if (envio.estado === 'preparando') {
    html += `
      <div style="display:flex; gap:8px; margin-bottom:12px;">
        <select id="ei_prod" style="flex:1">
          <option value="">Selecciona producto...</option>
          ${DB.products.filter(p => p.stock > 0).map(p => `<option value="${p.id}">${esc(p.name)} (Disp: ${p.stock})</option>`).join('')}
        </select>
        <input id="ei_qty" type="number" min="1" value="1" style="width:70px;" placeholder="Cant">
        <button class="btn btn-sm" onclick="guardedRun(this, () => agregarItemEnvio('${envio.id}'))">Añadir</button>
      </div>
    `;
  }
  
  if (items.length === 0) {
    html += `<div class="empty" style="padding:10px;">No hay productos.</div>`;
  } else {
    html += `<table style="width:100%; font-size:13px;">
      <tr style="text-align:left; border-bottom:1px solid var(--line);">
        <th>Producto</th>
        <th>Enviado</th>
        ${envio.estado !== 'preparando' && envio.estado !== 'en_transito' ? '<th>Recibido</th>' : ''}
        ${envio.estado === 'preparando' ? '<th></th>' : ''}
      </tr>
    `;
    items.forEach(it => {
      const prodName = it.expand?.producto?.name || 'Desconocido';
      html += `
        <tr style="border-bottom:1px solid var(--line-soft);">
          <td style="padding:4px 0;">${esc(prodName)}</td>
          <td>${it.cantidad_enviada}</td>
          ${envio.estado !== 'preparando' && envio.estado !== 'en_transito' ? `<td>${it.cantidad_recibida}</td>` : ''}
          ${envio.estado === 'preparando' ? `<td style="text-align:right;"><button class="btn btn-ghost btn-sm" onclick="guardedRun(this, () => quitarItemEnvio('${it.id}', '${envio.id}'))">✕</button></td>` : ''}
        </tr>
      `;
    });
    html += `</table>`;
  }
  
  // Timeline
  html += `<div class="section-title" style="margin-top:16px;"><h4>Línea de tiempo</h4></div>`;
  html += `<div style="font-size:12px;">`;
  eventos.forEach(ev => {
    html += `
      <div style="margin-bottom:8px; display:flex; gap:8px;">
        <div style="color:var(--ink-soft); width:120px; flex-shrink:0;">${fmtDate(ev.created)}</div>
        <div>
          <b>${esc(ev.estado)}</b>
          ${ev.nota ? `<div style="color:var(--ink-soft);">${esc(ev.nota)}</div>` : ''}
        </div>
      </div>
    `;
  });
  html += `</div>`;
  
  html += `</div><div class="modal-foot" style="flex-wrap:wrap;">`;
  
  // Botones según estado
  html += `<button class="btn btn-ghost" onclick="guardedRun(this, () => agregarNotaEnvio('${envio.id}'))">📝 Nota</button>`;
  
  if (envio.estado === 'preparando') {
    html += `<div style="flex:1"></div>`;
    html += `<button class="btn btn-clay" onclick="guardedRun(this, () => cancelarEnvio('${envio.id}'))">Cancelar</button>`;
    html += `<button class="btn btn-primary" onclick="guardedRun(this, () => despacharEnvio('${envio.id}'))" ${items.length === 0 ? 'disabled' : ''}>🚀 Despachar</button>`;
  } else if (envio.estado === 'en_transito') {
    html += `<div style="flex:1"></div>`;
    html += `<button class="btn btn-clay" onclick="guardedRun(this, () => cancelarEnvio('${envio.id}'))">Cancelar</button>`;
    html += `<button class="btn btn-primary" onclick="openRecibirEnvioModal('${envio.id}')">📦 Recibir</button>`;
  } else if (envio.estado === 'recibido_parcial' && !envio.incidencia_resuelta) {
    html += `<div style="flex:1"></div>`;
    html += `<button class="btn btn-primary" onclick="guardedRun(this, () => resolverIncidenciaEnvio('${envio.id}'))">✅ Resolver incidencia</button>`;
  } else {
    html += `<div style="flex:1"></div>`;
  }
  
  html += `</div>`;
  
  modalEl.innerHTML = html;
}

// ── Acciones de Envío ────────────────────────────────────────────────────────

window.agregarItemEnvio = async function(envioId) {
  const prodSel = document.getElementById('ei_prod');
  const qty = Number(document.getElementById('ei_qty').value);
  if (!prodSel.value || qty <= 0) return;
  
  const p = DB.products.find(x => x.id === prodSel.value);
  if (p && qty > p.stock) {
    toast(`Stock insuficiente. Disponible: ${p.stock}`, true);
    return;
  }
  
  try {
    await EstadosAPI.agregarItem(envioId, prodSel.value, qty);
    openEnvioDetalle(envioId); // recargar detalle
  } catch(err) {
    toast(EstadosAPI.msgError(err), true);
  }
};

window.quitarItemEnvio = async function(itemId, envioId) {
  try {
    await EstadosAPI.quitarItem(itemId);
    openEnvioDetalle(envioId);
  } catch(err) {
    toast(EstadosAPI.msgError(err), true);
  }
};

window.despacharEnvio = async function(id) {
  if (!confirm('¿Seguro que deseas despachar este envío? El stock se descontará de Central.')) return;
  try {
    await EstadosAPI.despachar(id);
    toast('Envío despachado');
    await _updateViewAfterAction();
    openEnvioDetalle(id);
  } catch(err) {
    toast(EstadosAPI.msgError(err), true);
  }
};

window.cancelarEnvio = async function(id) {
  if (!confirm('¿Seguro que deseas cancelar este envío?')) return;
  try {
    await EstadosAPI.cancelar(id);
    toast('Envío cancelado');
    await _updateViewAfterAction();
    openEnvioDetalle(id);
  } catch(err) {
    toast(EstadosAPI.msgError(err), true);
  }
};

window.agregarNotaEnvio = async function(id) {
  const nota = prompt('Escribe una nota para el timeline del envío:');
  if (!nota || !nota.trim()) return;
  try {
    await EstadosAPI.nota(id, nota.trim());
    toast('Nota añadida');
    openEnvioDetalle(id);
  } catch(err) {
    toast(EstadosAPI.msgError(err), true);
  }
};

window.resolverIncidenciaEnvio = async function(id) {
  const nota = prompt('¿Cómo se resolvió el faltante? (Ej: "Ajuste por extravío", "Llegó en otro paquete"):');
  if (!nota || !nota.trim()) return;
  try {
    await EstadosAPI.resolverIncidencia(id, nota.trim());
    toast('Incidencia resuelta');
    await _updateViewAfterAction();
    openEnvioDetalle(id);
  } catch(err) {
    toast(EstadosAPI.msgError(err), true);
  }
};

// ── Recepción ────────────────────────────────────────────────────────────────

window.openRecibirEnvioModal = async function(id) {
  const mid = openModal(`<div class="modal-body"><div class="empty">⏳ Cargando...</div></div>`);
  if (typeof fixModal === 'function') fixModal(mid);
  
  try {
    const data = await EstadosAPI.detalleEnvio(id);
    const { items, envio } = data;
    const modalEl = document.querySelector('.modal-overlay:last-child .modal');
    if (!modalEl) return;
    
    let html = `
      <div class="modal-head">
        <h3>Recibir Envío ${envio.codigo}</h3>
        <button class="x-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <p>Ajusta las cantidades recibidas si hubo faltantes:</p>
        <div id="re_items_list">
    `;
    
    items.forEach((it, i) => {
      const prodName = it.expand?.producto?.name || 'Desconocido';
      html += `
        <div class="field" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line-soft); padding-bottom:8px;">
          <div style="flex:1;">${esc(prodName)}<br><small style="color:var(--ink-soft)">Enviado: ${it.cantidad_enviada}</small></div>
          <input id="re_qty_${i}" type="number" min="0" max="${it.cantidad_enviada}" value="${it.cantidad_enviada}" 
                 style="width:80px;" oninput="checkDiferenciaRecep(${i}, ${it.cantidad_enviada})" data-id="${it.id}">
        </div>
        <div id="re_warn_${i}" style="color:var(--clay); font-size:12px; display:none; margin-top:-8px; margin-bottom:8px;">
          Faltante: <span id="re_diff_${i}"></span>
        </div>
      `;
    });
    
    html += `
        </div>
        <div class="field">
          <label>Nota de recepción <span style="font-weight:400;color:var(--ink-soft);">(opcional)</span></label>
          <input id="re_nota" placeholder="Todo OK, o detalle de problemas...">
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="closeTopModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="guardedRun(this, () => procesarRecepcion('${envio.id}'))">Confirmar Recepción</button>
      </div>
    `;
    
    modalEl.innerHTML = html;
  } catch (err) {
    closeTopModal();
    toast(EstadosAPI.msgError(err), true);
  }
};

window.checkDiferenciaRecep = function(idx, enviada) {
  const input = document.getElementById(`re_qty_${idx}`);
  const warn = document.getElementById(`re_warn_${idx}`);
  const diffSpan = document.getElementById(`re_diff_${idx}`);
  
  if (!input || !warn || !diffSpan) return;
  
  let val = Number(input.value);
  if (val > enviada) {
    input.value = enviada;
    val = enviada;
  }
  
  if (val < enviada) {
    diffSpan.textContent = (enviada - val);
    warn.style.display = 'block';
  } else {
    warn.style.display = 'none';
  }
};

window.procesarRecepcion = async function(envioId) {
  const inputs = document.querySelectorAll('input[id^="re_qty_"]');
  const items = [];
  
  for (let input of inputs) {
    const qty = Number(input.value);
    if (isNaN(qty) || qty < 0) {
      toast('Hay cantidades inválidas', true);
      return;
    }
    items.push({
      id: input.getAttribute('data-id'),
      cantidad_recibida: qty
    });
  }
  
  const nota = document.getElementById('re_nota').value.trim();
  
  try {
    await EstadosAPI.recibir(envioId, items, nota);
    toast('Recepción registrada');
    closeTopModal(); // cierra el modal de recepción
    await _updateViewAfterAction();
    openEnvioDetalle(envioId); // recarga el modal de detalle original
  } catch(err) {
    toast(EstadosAPI.msgError(err), true);
  }
};

// Utilidad para refrescar la lista de envíos debajo del modal
async function _updateViewAfterAction() {
  const content = document.getElementById('est-content');
  if (content && typeof renderEstadosEnvios === 'function' && window.ESTADOS_TAB === 'envios') {
    await renderEstadosEnvios(content);
  }
}

// Hookear en estados.js
const origRenderEstadosContent = window._renderEstadosContent;
window._renderEstadosContent = function(el) {
  if (typeof origRenderEstadosContent === 'function') origRenderEstadosContent(el);
  if (window.ESTADOS_TAB === 'envios') {
    renderEstadosEnvios(el);
  }
};
