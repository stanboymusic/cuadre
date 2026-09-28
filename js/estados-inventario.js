// js/estados-inventario.js
let _estInvFilterName = '';
let _estInvFilterLoc = '';

async function _loadPtData() {
  if (window._estadosPtData) return;
  if (window._estadosPtLoading) {
    while(window._estadosPtLoading) await new Promise(r => setTimeout(r, 100));
    return;
  }
  window._estadosPtLoading = true;
  try {
    const [stockUb, envios, envioItems] = await Promise.all([
      pb.collection('stock_ubicacion').getFullList(),
      pb.collection('envios').getFullList({ filter: "estado = 'en_transito'" }),
      pb.collection('envio_items').getFullList(),
    ]);
    window._estadosPtData = { stockUb, envios, envioItems };
  } finally {
    window._estadosPtLoading = false;
  }
}

async function renderEstadosInventario(el) {
  el.innerHTML = '<div class="empty">⏳ Cargando inventario...</div>';
  try {
    await _loadPtData();
  } catch (err) {
    toast('Error cargando datos de inventario', true);
    el.innerHTML = '<div class="empty">Error de red al cargar el inventario.</div>';
    return;
  }
  
  const estados = (window._ubicaciones || []).filter(u => u.tipo === 'estado' && u.activa);
  
  let html = `
    <div class="searchbar">
      <input placeholder="Buscar producto..." value="${esc(_estInvFilterName)}" oninput="_estInvFilterName=this.value; _renderInvTable()">
      <select onchange="_estInvFilterLoc=this.value; _renderInvTable(); _loadInvHistorial();">
        <option value="">Todas las ubicaciones</option>
        ${estados.map(u => `<option value="${u.id}" ${_estInvFilterLoc === u.id ? 'selected':''}>${esc(u.nombre)}</option>`).join('')}
      </select>
    </div>
    <div id="estInvTableWrap"></div>
    <div class="section-title" style="margin-top:30px;"><h2>Historial de Movimientos</h2></div>
    <div id="estInvHistorialWrap">⏳ Cargando historial...</div>
  `;
  el.innerHTML = html;
  
  _renderInvTable();
  _loadInvHistorial();
}

function _renderInvTable() {
  const wrap = document.getElementById('estInvTableWrap');
  if (!wrap) return;
  const { stockUb, envios, envioItems } = window._estadosPtData || {stockUb:[], envios:[], envioItems:[]};
  const estados = (window._ubicaciones || []).filter(u => u.tipo === 'estado' && u.activa);
  
  let products = DB.products.filter(p => smartMatch(_estInvFilterName, p.name, p.code));
  
  if (_estInvFilterLoc) {
    products = products.filter(p => {
      const s = stockUb.find(x => x.producto === p.id && x.ubicacion === _estInvFilterLoc);
      return s && s.cantidad > 0;
    });
  }

  if (!products.length) {
    wrap.innerHTML = `<div class="empty">No hay productos que coincidan.</div>`;
    return;
  }
  
  let thUbs = estados.map(u => `<th>${esc(u.nombre)}</th>`).join('');
  
  let trs = products.map(p => {
    const tot = EstadosCalc.totalProducto(p, stockUb, envios, envioItems);
    let tdUbs = estados.map(u => {
      const s = stockUb.find(x => x.producto === p.id && x.ubicacion === u.id);
      return `<td class="amt">${s ? s.cantidad : 0}</td>`;
    }).join('');
    return `<tr>
      <td>${esc(p.name)}</td>
      <td class="amt" style="color:var(--ink-soft)">${tot.central}</td>
      <td class="amt" style="color:var(--gold-deep)">${tot.en_transito}</td>
      ${tdUbs}
      <td class="amt" style="font-weight:bold;color:var(--ink)">${tot.total}</td>
    </tr>`;
  }).join('');
  
  wrap.innerHTML = `
    <div class="table-wrap" style="overflow-x:auto;">
      <table style="min-width:600px;">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Central</th>
            <th>En tránsito</th>
            ${thUbs}
            <th>Total Global</th>
          </tr>
        </thead>
        <tbody>${trs}</tbody>
      </table>
    </div>
  `;
}

async function _loadInvHistorial() {
  const wrap = document.getElementById('estInvHistorialWrap');
  if (!wrap) return;
  wrap.innerHTML = `⏳ Cargando...`;
  try {
    let filter = _estInvFilterLoc ? `ubicacion = '${_estInvFilterLoc}'` : '';
    const movs = await pb.collection('movimientos_inventario').getList(1, 50, {
      sort: '-created',
      filter: filter,
      expand: 'producto,ubicacion',
      $autoCancel: false
    });
    
    if (!movs.items.length) {
      wrap.innerHTML = `<div class="empty">No hay movimientos.</div>`;
      return;
    }
    
    let trs = movs.items.map(m => {
      const prodName = m.expand?.producto?.name || 'Producto';
      const ubName = m.expand?.ubicacion?.nombre || 'Central';
      const qty = m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad;
      const col = m.cantidad > 0 ? 'var(--teal)' : 'var(--clay)';
      return `<tr>
        <td>${fmtDate(m.created, true)}</td>
        <td>${esc(ubName)}</td>
        <td>${esc(prodName)}</td>
        <td><span class="tag tag-muted">${esc(m.tipo)}</span></td>
        <td class="amt" style="color:${col};font-weight:bold;">${qty}</td>
        <td>${esc(m.nota || m.refTipo || '')}</td>
      </tr>`;
    }).join('');
    
    wrap.innerHTML = `
      <div class="table-wrap" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Fecha</th><th>Ubicación</th><th>Producto</th><th>Tipo</th><th style="text-align:right">Cant.</th><th>Detalle</th></tr></thead>
          <tbody>${trs}</tbody>
        </table>
      </div>
    `;
  } catch (err) {
    console.error(err);
    toast('Error cargando historial de movimientos', true);
    wrap.innerHTML = `<div class="empty">Error de red</div>`;
  }
}
