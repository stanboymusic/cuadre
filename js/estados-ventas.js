// js/estados-ventas.js
let _estVentLoc = '';
let _estVentDesde = todayISO();
let _estVentHasta = todayISO();

async function renderEstadosVentas(el) {
  const estados = (window._ubicaciones || []).filter(u => u.tipo === 'estado' && u.activa);
  
  if (!_estVentLoc && estados.length) _estVentLoc = estados[0].id;

  el.innerHTML = `
    <div class="searchbar">
      <select onchange="_estVentLoc=this.value; _loadEstadosVentas()">
        ${estados.map(u => `<option value="${u.id}" ${_estVentLoc === u.id ? 'selected':''}>${esc(u.nombre)}</option>`).join('')}
      </select>
      <input type="date" value="${_estVentDesde}" onchange="_estVentDesde=this.value; _loadEstadosVentas()">
      <input type="date" value="${_estVentHasta}" onchange="_estVentHasta=this.value; _loadEstadosVentas()">
    </div>
    <div id="estVentWrap">⏳ Cargando ventas...</div>
  `;
  _loadEstadosVentas();
}

async function _loadEstadosVentas() {
  const wrap = document.getElementById('estVentWrap');
  if (!wrap) return;
  if (!_estVentLoc) {
    wrap.innerHTML = `<div class="empty">Selecciona una ubicación.</div>`;
    return;
  }
  
  try {
    const filter = `ubicacion = '${_estVentLoc}' && date >= '${_estVentDesde}' && date <= '${_estVentHasta}'`;
    const sales = await pb.collection('sales').getFullList({ filter, sort: '-ts', $autoCancel: false });
    
    let totalUsd = 0;
    let totalDscto = 0;
    sales.forEach(s => {
      totalUsd += (s.totalUsd || 0);
      totalDscto += (s.discountUsd || 0);
    });
    
    let html = `
      <div class="grid grid-3" style="margin-bottom:20px;">
        <div class="stat"><div class="lbl">Total Vendido</div><div class="val amt" style="color:var(--teal)">${money(totalUsd, 'USD')}</div></div>
        <div class="stat"><div class="lbl">Descuentos</div><div class="val amt">${money(totalDscto, 'USD')}</div></div>
        <div class="stat"><div class="lbl">Operaciones</div><div class="val amt">${sales.length}</div></div>
      </div>
    `;
    
    if (!sales.length) {
      html += `<div class="empty">No hay ventas en este período.</div>`;
    } else {
      let trs = sales.map(s => {
        const dsc = s.discountUsd ? `<br><small class="tag tag-clay">-${money(s.discountUsd,'USD')}</small>` : '';
        const items = s.items.map(i => `${i.qty}x ${esc(i.name)}`).join('<br>');
        return `<tr>
          <td>#${s.ticketNo} - ${fmtDate(s.date)}</td>
          <td>${esc(s.clientName)}</td>
          <td style="font-size:12px;line-height:1.4;">${items}</td>
          <td class="amt" style="color:var(--ink)">${money(s.totalUsd, 'USD')} ${dsc}</td>
        </tr>`;
      }).join('');
      html += `
        <div class="table-wrap" style="overflow-x:auto;">
          <table>
            <thead><tr><th>Ticket</th><th>Cliente</th><th>Productos</th><th style="text-align:right">Total</th></tr></thead>
            <tbody>${trs}</tbody>
          </table>
        </div>
      `;
    }
    wrap.innerHTML = html;
  } catch(err) {
    console.error(err);
    toast('Error cargando ventas', true);
    wrap.innerHTML = `<div class="empty">Error de conexión</div>`;
  }
}
