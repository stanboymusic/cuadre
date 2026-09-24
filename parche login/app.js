

let VIEW = 'dashboard';
let modalStack = [];

const NAV = [
  {
    group: 'Operación', items: [
      { id: 'dashboard', label: 'Resumen', ic: '◆' },
      { id: 'ventas', label: 'Ventas', ic: '✦' },
      { id: 'cierre', label: 'Cierre de caja', ic: '▤' },
    ]
  },
  {
    group: 'Inventario', items: [
      { id: 'productos', label: 'Productos', ic: '▣' },
      { id: 'servicios', label: 'Servicios', ic: '✎' },
      { id: 'compras', label: 'Compras', ic: '⇩' },
      { id: 'ajustes', label: 'Ajustes de inventario', ic: '±' },
    ]
  },
  {
    group: 'Terceros', items: [
      { id: 'clientes', label: 'Clientes', ic: '☺' },
      { id: 'proveedores', label: 'Proveedores', ic: '⌂' },
      { id: 'egresos', label: 'Egresos', ic: '⇧' },
    ]
  },
  {
    group: 'Análisis', items: [
      { id: 'reportes', label: 'Reportes', ic: '▦' },
      { id: 'historial', label: 'Historial', ic: '☰' },
      { id: 'patrimonio', label: 'Patrimonio', ic: '♦' },
    ]
  },
  {
    group: 'Sistema', items: [
      { id: 'config', label: 'Configuración', ic: '⚙' },
    ]
  },
];
const LABELS = Object.fromEntries(NAV.flatMap(g => g.items).map(i => [i.id, i.label]));

function navigate(view) { VIEW = view; render(); window.scrollTo(0, 0); }

function toggleSidebar(force) {
  const sb = document.querySelector('.sidebar');
  const bd = document.querySelector('.sidebar-backdrop');
  const open = typeof force === 'boolean' ? force : !sb.classList.contains('open');
  sb.classList.toggle('open', open);
  bd.classList.toggle('open', open);
}



function render() {
  const app = document.getElementById('app');
  app.innerHTML = `
<div class="sidebar-backdrop no-print" onclick="toggleSidebar(false)"></div>
<div class="sidebar no-print">
  <div class="sidebar-brand">
    <img src="${LOGO_ICON}" alt="Mantente" class="brand-icon">
    <div class="mark">MANTENTE</div>
    <div class="sub">Decisiones claras, negocios rentables</div>
  </div>
  ${NAV.map(g => `
    <div class="nav-group">
      <div class="nav-group-label">${g.group}</div>
      ${g.items.map(i => `
        <div class="nav-item ${VIEW === i.id ? 'active' : ''}" onclick="navigate('${i.id}')">
          <span class="ic">${i.ic}</span><span>${i.label}</span>
        </div>`).join('')}
    </div>`).join('')}
  <div class="sidebar-foot">
    ${esc(DB.config.businessName)}<br>${todayFmt()}
    ${pb.authStore.record ? `<div style="margin-top:8px;opacity:.8;">${esc(pb.authStore.record.email || pb.authStore.record.username || '')}</div>` : ''}
    <div class="nav-item no-print" style="margin-top:6px;" onclick="logout()"><span class="ic">⏻</span><span>Cerrar sesión</span></div>
  </div>
</div>
<div class="main">
  <div class="topbar no-print">
    <h1><button class="menu-btn" onclick="toggleSidebar()" aria-label="Menú">☰</button>${LABELS[VIEW] || ''}</h1>
    <div class="rate-pill">◆ Tasa del día: <span class="mono">${DB.config.exchangeRate}</span> Bs./$${DB.config.exchangeRateCop ? ` · <span class="mono">${DB.config.exchangeRateCop}</span> COP/$` : ''}</div>
  </div>
  <div class="content" id="content"></div>
</div>
  `;
  const c = document.getElementById('content');
  const renderers = {
    dashboard: renderDashboard, ventas: renderVentas, cierre: renderCierre,
    productos: renderProductos, servicios: renderServicios, compras: renderCompras,
    ajustes: renderAjustes, clientes: renderClientes, proveedores: renderProveedores,
    egresos: renderEgresos, reportes: renderReportes, historial: renderHistorial, config: renderConfig,
    patrimonio: renderPatrimonio
  };
  (renderers[VIEW] || renderDashboard)(c);
}
function todayFmt() { const d = new Date(); return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }); }



function openModal(html, wide) {
  const wrap = document.createElement('div');
  wrap.className = 'overlay'; wrap.id = 'ov_' + Math.random().toString(36).slice(2, 8);
  wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}">${html}</div>`;
  wrap.addEventListener('click', e => { if (e.target === wrap) closeModal(wrap.id); });
  document.body.appendChild(wrap);
  modalStack.push(wrap.id);
  return wrap.id;
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
  modalStack = modalStack.filter(x => x !== id);
}
function closeTopModal() { if (modalStack.length) closeModal(modalStack[modalStack.length - 1]); }



// Expose to global scope for inline HTML handlers
window.LABELS = LABELS;
window.NAV = NAV;
window.VIEW = VIEW;
window.closeModal = closeModal;
window.closeTopModal = closeTopModal;
window.modalStack = modalStack;
window.navigate = navigate;
window.openModal = openModal;
window.render = render;
window.todayFmt = todayFmt;
window.toggleSidebar = toggleSidebar;
