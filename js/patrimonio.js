

function renderPatrimonio(el) {
  const inv = (DB.config && DB.config.initialInvestment > 0) ? Number(DB.config.initialInvestment) : 0;
  const invConfigurada = inv > 0;

  // Punto 3 — Inventario completo: Central + estados + en tránsito.
  // Si EstadosCalc está disponible (estados.js y estados-calc.js ya cargados),
  // usamos inventarioTotal para que despachar no baje el patrimonio.
  // Los datos de stock_ubicacion y envio_items se cargan async la primera vez.
  // Mientras llegan, usamos solo products.stock (mismo comportamiento que antes).
  let inventoryValue;
  if (typeof EstadosCalc !== 'undefined' && window._estadosPtData) {
    const { stockUb, envios, envioItems } = window._estadosPtData;
    inventoryValue = EstadosCalc.inventarioTotal({ products: DB.products, stockUb, envios, envioItems });
  } else {
    inventoryValue = DB.products.reduce((a, p) => a + (p.cost || 0) * (p.stock || 0), 0);
    // Cargar datos de estados en background y re-renderizar
    if (typeof EstadosCalc !== 'undefined' && !window._estadosPtLoading) {
      window._estadosPtLoading = true;
      Promise.all([
        pb.collection('stock_ubicacion').getFullList(),
        pb.collection('envios').getFullList({ filter: "estado = 'en_transito'" }),
        pb.collection('envio_items').getFullList(),
      ]).then(([stockUb, envios, envioItems]) => {
        window._estadosPtData = { stockUb, envios, envioItems };
        window._estadosPtLoading = false;
        const c = document.getElementById('content');
        if (c && VIEW === 'patrimonio') renderPatrimonio(c);
      }).catch(() => { window._estadosPtLoading = false; });
    }
  }
  const receivables = DB.clients.reduce((a, c) => a + Math.max(clientBalance(c.id), 0), 0);

  // Solo cuenta como caja el dinero que realmente entró (se excluye
  // cualquier fila de pago marcada como "Crédito" por error).
  // Si hay inversión inicial, se suma como capital; si no, la caja parte
  // desde el flujo operativo puro. Las dos formas son correctas y equivalentes
  // porque patrimonioNeto = patrimonioBruto - inv en ambos casos.
  const salesCashIn = DB.sales.reduce((a, s) =>
    a + (s.payments || []).filter(p => p.method !== 'Crédito').reduce((x, p) => x + (p.amountUsd || 0), 0), 0);
  const abonosCashIn = DB.receivablePayments.reduce((a, p) => a + (p.amount || 0), 0);
  const purchasesCashOut = DB.purchases.reduce((a, p) => a + (p.totalUsd || 0), 0);
  const expensesCashOut = DB.expenses.reduce((a, e) => a + (e.amountUsd || 0), 0);

  const cash = inv + salesCashIn + abonosCashIn - purchasesCashOut - expensesCashOut;
  const patrimonioBruto = cash + inventoryValue + receivables;
  // patrimonioNeto solo es significativo cuando hay inversión de referencia
  const patrimonioNeto = invConfigurada ? (patrimonioBruto - inv) : null;

  el.innerHTML = `
<div class="grid grid-2">
  <div class="card card-pad">
    <h3 style="margin-top:0;font-size:15px;">Inversión inicial <span class="tag tag-muted" style="font-size:10px;vertical-align:middle;">Opcional</span></h3>
    <div class="field"><label>Capital aportado (USD)</label><input id="pt_inv" type="number" step="0.01" value="${inv > 0 ? inv : ''}"></div>
    <button class="btn btn-primary" onclick="guardedRun(this, saveInvestment)">Guardar</button>
    <div class="hint" style="margin-top:8px;">Lo que aportaste tú (o los socios) para arrancar el negocio. Es referencia opcional para medir cuánto ha generado la operación. No toca existencias ni compras.</div>
  </div>
  <div class="card card-pad">
    <h3 style="margin-top:0;font-size:15px;">¿Cómo se calcula?</h3>
    <div class="hint">
      <b>Patrimonio bruto</b> = caja acumulada + inventario a costo + cuentas por cobrar.<br><br>
      <b>Patrimonio neto</b> = patrimonio bruto − inversión inicial. Solo aparece cuando configuraste la inversión inicial de referencia.
    </div>
  </div>
</div>

<div class="grid grid-4" style="margin-top:16px;">
  <div class="stat">
    <div class="lbl">Caja acumulada</div>
    <div class="val amt">${money(cash, 'USD')}</div>
    <div class="sub">${invConfigurada ? 'Inversión + cobros' : 'Cobros'} − compras − egresos</div>
  </div>
  <div class="stat">
    <div class="lbl">Inventario (a costo)</div>
    <div class="val amt">${money(inventoryValue, 'USD')}</div>
    <div class="sub">${DB.products.length} producto(s)</div>
  </div>
  <div class="stat">
    <div class="lbl">Cuentas por cobrar</div>
    <div class="val amt">${money(receivables, 'USD')}</div>
    <div class="sub">${DB.clients.filter(c => clientBalance(c.id) > 0).length} cliente(s) con saldo</div>
  </div>
  <div class="stat ${patrimonioBruto < 0 ? 'neg' : 'pos'}">
    <div class="lbl">Patrimonio bruto</div>
    <div class="val amt">${money(patrimonioBruto, 'USD')}</div>
    <div class="sub">Activos totales del negocio</div>
  </div>
</div>

<div class="section-title"><h2>Patrimonio neto</h2></div>
<div class="card card-pad">
${invConfigurada ? `
  <div class="stat ${patrimonioNeto < 0 ? 'neg' : 'pos'}" style="border:none;padding:0;">
    <div class="lbl">Valor generado por la operación</div>
    <div class="val amt" style="font-size:28px;">${money(patrimonioNeto, 'USD')}</div>
    <div class="sub">Patrimonio bruto (${money(patrimonioBruto, 'USD')}) − inversión inicial (${money(inv, 'USD')})</div>
  </div>
` : `
  <div style="display:flex;align-items:flex-start;gap:20px;flex-wrap:wrap;">
    <div class="val amt" style="font-size:32px;color:var(--ink-soft);line-height:1;padding-top:4px;">—</div>
    <div>
      <div style="font-weight:600;color:var(--ink-soft);margin-bottom:4px;">Configura tu inversión inicial (opcional) para ver esto</div>
      <div class="hint">El patrimonio neto mide cuánto ha generado el negocio por encima de lo que pusiste. Sin inversión inicial, todos tus activos se muestran en el patrimonio bruto de arriba.</div>
      <button class="btn btn-sm btn-gold" style="margin-top:10px;" onclick="document.getElementById('pt_inv').focus();document.getElementById('pt_inv').select()">Configurar ahora</button>
    </div>
  </div>
`}
</div>
  `;
}

async function saveInvestment() {
  const val = Number(document.getElementById('pt_inv').value) || 0;
  // NUNCA toca existencias ni compras — solo es un dato de referencia en config
  DB.config.initialInvestment = val;
  await save('config');
  toast('Inversión inicial guardada ✓');
  renderPatrimonio(document.getElementById('content'));
}

// Expose to global scope for inline HTML handlers
window.renderPatrimonio = renderPatrimonio;
window.saveInvestment = saveInvestment;
