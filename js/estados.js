// js/estados.js — Módulo "Estados" (Envíos a Estados) — Cuadre / Mantente
// Fase 1: pestaña Ubicaciones con CRUD completo.
// Fases 2-4: Envíos, Inventario, Ventas, Panel, Rendiciones (cada una en su fase).
//
// NO modifica el index.html más allá de un <script> y la entrada en NAV/renderers.
// Toda la lógica de ubicaciones usa pb.collection('ubicaciones') directamente
// (no pasa por el store central DB para no acoplar colecciones nuevas al boot).

let ESTADOS_TAB = 'ubicaciones';
let _ubicaciones = []; // caché local; se recarga al navegar y tras cada mutación

const ESTADOS_VE = [
  "Amazonas","Anzoátegui","Apure","Aragua","Barinas","Bolívar",
  "Carabobo","Cojedes","Delta Amacuro","Distrito Capital","Falcón",
  "Guárico","La Guaira","Lara","Mérida","Miranda","Monagas",
  "Nueva Esparta","Portuguesa","Sucre","Táchira","Trujillo","Yaracuy","Zulia"
];

// ── Carga de datos ─────────────────────────────────────────────────────────────

function _reloadUbicaciones() {
  return pb.collection('ubicaciones')
    .getFullList({ sort: 'tipo,nombre' })
    .then(data => { _ubicaciones = data; })
    .catch(err  => { console.error('estados: error cargando ubicaciones', err); });
}

// ── Renderizado principal (sincrónico; la carga async llama de vuelta) ─────────

function renderEstados(el) {
  const tabs = [
    { id: 'ubicaciones', label: '📍 Ubicaciones' },
    { id: 'envios',      label: '📦 Envíos'       },
    { id: 'inventario',  label: '📊 Inventario'   },
    { id: 'ventas_est',  label: '💰 Ventas'       },
    { id: 'panel',       label: '🗺️ Panel'         },
    { id: 'rendiciones', label: '💵 Rendiciones'   },
  ];

  el.innerHTML = `
<div class="tabs" style="margin-bottom:0;">
  ${tabs.map(t => `
    <div class="tab ${ESTADOS_TAB === t.id ? 'active' : ''}"
         onclick="setEstadosTab('${t.id}')" id="tab-est-${t.id}">
      ${t.label}
    </div>`).join('')}
</div>
<div id="est-content" style="margin-top:16px;"></div>
  `;

  const estContent = el.querySelector('#est-content');
  _renderEstadosContent(estContent);

  // Recarga en background y re-renderiza si el usuario sigue en este módulo
  _reloadUbicaciones().then(() => {
    if (VIEW !== 'estados') return;
    const c = document.getElementById('content');
    if (c) renderEstados(c);
  });
}

function _renderEstadosContent(el) {
  if (ESTADOS_TAB === 'ubicaciones') _renderUbicaciones(el);
  else {
    el.innerHTML = `
<div class="card card-pad" style="color:var(--ink-soft);text-align:center;padding:48px 20px;">
  <div style="font-size:32px;margin-bottom:12px;">🚧</div>
  <b>Esta sección se activa en la siguiente fase del parche</b>
  <div class="hint" style="margin-top:8px;">Completadas las fases anteriores, este módulo aparecerá aquí automáticamente.</div>
</div>`;
  }
}

function setEstadosTab(tab) {
  ESTADOS_TAB = tab;
  // Forzar recarga de datos al cambiar de pestaña
  _ubicaciones = [];
  const c = document.getElementById('content');
  if (c) renderEstados(c);
}

// ── Ubicaciones ────────────────────────────────────────────────────────────────

function _renderUbicaciones(el) {
  if (!_ubicaciones.length) {
    // Primera carga o datos aún vacíos: mostrar spinner mientras llega la async
    el.innerHTML = `<div class="empty"><div style="font-size:28px;">⏳</div>Cargando ubicaciones…</div>`;
    return;
  }

  const central  = _ubicaciones.find(u => u.tipo === 'central');
  const estados  = _ubicaciones.filter(u => u.tipo === 'estado');

  el.innerHTML = `
<!-- Aviso Central -->
${central ? `
<div class="card card-pad" style="margin-bottom:16px;background:var(--teal-tint);border-color:var(--teal);display:flex;align-items:center;gap:14px;">
  <span style="font-size:22px;">🏪</span>
  <div>
    <b style="color:var(--teal);">${esc(central.nombre)} — Central</b>
    <div class="hint" style="margin-top:2px;">El inventario principal (products.stock) pertenece a la Central. No se puede eliminar.</div>
  </div>
</div>` : `
<div class="card card-pad" style="margin-bottom:16px;background:var(--clay-tint);border-color:var(--clay);">
  <b style="color:var(--clay);">⚠️ No se encontró la ubicación Central.</b>
  La migración debió crearla automáticamente. Revisa los logs de PocketBase.
</div>`}

<!-- Acciones -->
<div class="section-title">
  <h2>Puntos de venta en estados</h2>
  <button class="btn btn-gold" id="btn-nueva-ub" onclick="openUbicacionForm()">+ Nueva ubicación</button>
</div>

<!-- Tabla de estados -->
${estados.length ? `
<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th>Nombre</th>
        <th>Estado</th>
        <th>Ciudad</th>
        <th>Responsable</th>
        <th>Teléfono</th>
        <th>Comisión</th>
        <th>Estado</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      ${estados.map(u => `
      <tr>
        <td><b>${esc(u.nombre)}</b></td>
        <td>${esc(u.estado_ve || '—')}</td>
        <td>${esc(u.ciudad    || '—')}</td>
        <td>${esc(u.responsable || '—')}</td>
        <td>${esc(u.telefono   || '—')}</td>
        <td class="amt">${u.comision_pct || 0}%</td>
        <td>
          <span class="tag ${u.activa ? 'tag-teal' : 'tag-clay'}">
            ${u.activa ? 'Activa' : 'Inactiva'}
          </span>
        </td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="openUbicacionForm('${u.id}')">Editar</button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>
<div class="hint" style="margin-top:8px;">${estados.length} ubicacion(es) en estados registrada(s).</div>
` : `
<div class="empty">
  <div class="big">🗺️</div>
  Todavía no hay puntos de venta en estados.
  <div class="help-empty-cta">
    <button class="btn btn-gold" onclick="openUbicacionForm()">+ Agregar primera ubicación</button>
  </div>
</div>`}
  `;
}

// ── Modal de crear/editar ubicación ───────────────────────────────────────────

function openUbicacionForm(id) {
  const u = id ? _ubicaciones.find(x => x.id === id) : null;
  const mid = openModal(`
<div class="modal-head">
  <h3>${id ? 'Editar' : 'Nueva'} ubicación</h3>
  <button class="x-close" onclick="closeModal('${id ? '_ub_' + id : '_ub_new'}')">✕</button>
</div>
<div class="modal-body">
  <div class="field">
    <label>Nombre del punto de venta</label>
    <input id="ub_nombre" value="${esc(u?.nombre || '')}" placeholder="Ej. Zulia – Maracaibo">
  </div>
  <div class="row-fields">
    <div class="field">
      <label>Estado de Venezuela</label>
      <select id="ub_estado_ve">
        <option value="">— Selecciona —</option>
        ${ESTADOS_VE.map(ev => `<option ${(u?.estado_ve === ev) ? 'selected' : ''}>${esc(ev)}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label>Ciudad <span style="font-weight:400;color:var(--ink-soft);">(opcional)</span></label>
      <input id="ub_ciudad" value="${esc(u?.ciudad || '')}" placeholder="Ej. Maracaibo">
    </div>
  </div>
  <div class="field">
    <label>Responsable / Vendedor</label>
    <input id="ub_responsable" value="${esc(u?.responsable || '')}" placeholder="Nombre completo">
  </div>
  <div class="row-fields">
    <div class="field">
      <label>Teléfono <span style="font-weight:400;color:var(--ink-soft);">(opcional)</span></label>
      <input id="ub_telefono" value="${esc(u?.telefono || '')}" placeholder="04xx-xxxxxxx">
    </div>
    <div class="field">
      <label>Comisión del vendedor (%)</label>
      <input id="ub_comision" type="number" min="0" max="100" step="0.1" value="${u?.comision_pct || 0}">
      <div class="hint">0 si no aplica comisión.</div>
    </div>
  </div>
  <div class="field">
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
      <input type="checkbox" id="ub_activa" ${(!id || u?.activa) ? 'checked' : ''}>
      Ubicación activa
    </label>
    <div class="hint">Las ubicaciones inactivas no aparecen en el panel ni en el POS.</div>
  </div>
</div>
<div class="modal-foot">
  ${id ? `<button class="btn btn-clay" onclick="guardedRun(this, () => deleteUbicacion('${id}'))">Eliminar</button>` : ''}
  <button class="btn" onclick="closeTopModal()">Cancelar</button>
  <button class="btn btn-primary" onclick="guardedRun(this, () => saveUbicacion('${id || ''}'))">Guardar</button>
</div>
  `);
  // fixModal registra el cierre de la X con el id del modal
  if (typeof fixModal === 'function') fixModal(mid);
}

async function saveUbicacion(id) {
  const nombre = document.getElementById('ub_nombre').value.trim();
  if (!nombre) { toast('El nombre es obligatorio', true); return; }

  const data = {
    nombre,
    tipo:         'estado',
    estado_ve:    document.getElementById('ub_estado_ve').value,
    ciudad:       document.getElementById('ub_ciudad').value.trim(),
    responsable:  document.getElementById('ub_responsable').value.trim(),
    telefono:     document.getElementById('ub_telefono').value.trim(),
    comision_pct: Number(document.getElementById('ub_comision').value) || 0,
    activa:       document.getElementById('ub_activa').checked,
  };

  try {
    if (id) {
      await pb.collection('ubicaciones').update(id, data);
    } else {
      await pb.collection('ubicaciones').create(data);
    }
    closeTopModal();
    await _reloadUbicaciones();
    toast('Ubicación guardada ✓');
    const c = document.getElementById('content');
    if (c && VIEW === 'estados') renderEstados(c);
  } catch (err) {
    toast('Error al guardar: ' + (err?.message || String(err)), true);
  }
}

async function deleteUbicacion(id) {
  const u = _ubicaciones.find(x => x.id === id);
  if (!confirm(`¿Eliminar "${u?.nombre || 'esta ubicación'}"? Esta acción no se puede deshacer. Se perderán todos los datos de stock e historial de esa ubicación.`)) return;
  try {
    await pb.collection('ubicaciones').delete(id);
    closeTopModal();
    await _reloadUbicaciones();
    toast('Ubicación eliminada');
    const c = document.getElementById('content');
    if (c && VIEW === 'estados') renderEstados(c);
  } catch (err) {
    // PocketBase lanza error 400 si hay registros relacionados
    const msg = err?.data?.message || err?.message || String(err);
    toast('No se puede eliminar: tiene envíos, stock o rendiciones asociadas.', true);
    console.error('deleteUbicacion:', msg);
  }
}

// ── Exponer al scope global (requerido por el sistema de handlers inline) ──────
window.renderEstados    = renderEstados;
window.setEstadosTab    = setEstadosTab;
window.openUbicacionForm = openUbicacionForm;
window.saveUbicacion    = saveUbicacion;
window.deleteUbicacion  = deleteUbicacion;
