

let CART = { items: [], clientId: '', vendor: (DB.config && DB.config.vendors && DB.config.vendors[0]) || '', payments: [], lastTicket: null, priceTier: 'ami', showBs: false, showCop: false };

function renderVentas(el) {
  if (!CART.vendor) CART.vendor = DB.config.vendors[0] || '';
  const subtotalItemsUsd = CART.items.reduce((a, it) => a + it.priceUsd * it.qty, 0);
  const ivaPct = DB.config.iva || 0;
  const ivaUsd = subtotalItemsUsd * ivaPct / 100;
  const subtotalUsd = subtotalItemsUsd + ivaUsd; // Subtotal antes de descuento

  let discountUsd = 0;
  if (CART.discountType === 'percent') {
    discountUsd = Math.round(subtotalUsd * (Number(CART.discountVal) || 0) / 100 * 100) / 100;
  } else {
    discountUsd = Math.round((Number(CART.discountVal) || 0) * 100) / 100;
  }
  discountUsd = Math.min(discountUsd, subtotalUsd);

  const totalUsd = Math.max(0, subtotalUsd - discountUsd);
  const totalBs = totalUsd * DB.config.exchangeRate;
  const paidUsd = CART.payments.reduce((a, p) => a + Number(p.amountUsd || 0), 0);
  const balanceUsd = totalUsd - paidUsd;

  el.innerHTML = `
<div class="grid" style="grid-template-columns:1.5fr 1fr; align-items:start;">
  <div>
    <div class="card card-pad">
      <div class="searchbar">
        <select id="itemPicker" style="flex:1">
          <option value="">— Selecciona un producto o servicio —</option>
          <optgroup label="Productos">
            ${DB.products.map(p => `<option value="p:${p.id}" ${((p.stock || 0) <= 0) ? 'disabled' : ''}>${esc(p.name)} · ${money(tierPrice(p, CART.priceTier), 'USD')} · stock ${p.stock || 0}</option>`).join('')}
          </optgroup>
          <optgroup label="Servicios">
            ${DB.services.map(s => `<option value="s:${s.id}">${esc(s.name)} · ${money(s.price, 'USD')}</option>`).join('')}
          </optgroup>
        </select>
        <select id="tierSel" onchange="CART.priceTier=this.value; render()" style="max-width:180px" title="Nivel de precio a aplicar a los productos que agregues">
          ${PRICE_TIERS.map(t => `<option value="${t.key}" ${CART.priceTier === t.key ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>
        <button class="btn btn-gold" onclick="cartAddFromPicker()">+ Agregar</button>
      </div>
      ${CART.items.length ? `
        <div class="table-wrap" style="max-height:340px">
          <table><thead><tr><th>Ítem</th><th>Cant.</th><th>Nivel</th><th>Precio</th><th>Total</th><th></th></tr></thead>
          <tbody>${CART.items.map((it, idx) => `
            <tr>
              <td>${esc(it.name)} ${it.kind === 's' ? '<span class="tag tag-gold">Servicio</span>' : ''}</td>
              <td><input type="number" min="1" value="${it.qty}" style="width:60px;padding:4px 6px;border:1px solid var(--line);border-radius:6px" onchange="cartSetQty(${idx}, this.value)"></td>
              <td>${it.kind === 'p' ? `<select style="padding:4px 6px;border:1px solid var(--line);border-radius:6px;font-size:12px;" onchange="cartSetItemTier(${idx}, this.value)">
                ${PRICE_TIERS.map(t => `<option value="${t.key}" ${(it.tier || 'ami') === t.key ? 'selected' : ''}>${t.label}</option>`).join('')}
              </select>` : '—'}</td>
              <td class="amt">${money(it.priceUsd, 'USD')}</td>
              <td class="amt">${money(it.priceUsd * it.qty, 'USD')}</td>
              <td><button class="btn btn-ghost btn-sm" onclick="cartRemove(${idx})">✕</button></td>
            </tr>`).join('')}</tbody></table>
        </div>
      ` : `<div class="empty"><div class="big">🛒</div>Agrega productos o servicios al carrito.</div>`}
    </div>

    <div class="section-title"><h2>Cliente y vendedor</h2></div>
    <div class="card card-pad row-fields" style="grid-template-columns:1fr 1fr;">
      <div class="field" style="margin:0;">
        <label>Cliente</label>
        <select id="clientSel" onchange="CART.clientId=this.value; render()">
          <option value="">Cliente ocasional</option>
          ${DB.clients.map(c => `<option value="${c.id}" ${CART.clientId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field" style="margin:0;">
        <label>Vendedor</label>
        <select id="vendorSel" onchange="CART.vendor=this.value">
          ${DB.config.vendors.map(v => `<option ${CART.vendor === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}
        </select>
      </div>
    </div>
  </div>

  <div>
    <div class="card card-pad">
      <div class="line" style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Productos/Servicios</span><span class="amt">${money(subtotalItemsUsd, 'USD')}</span></div>
      ${ivaPct > 0 ? `<div class="line" style="display:flex;justify-content:space-between;margin-bottom:6px;color:var(--ink-soft)"><span>IVA (${ivaPct}%)</span><span class="amt">${money(ivaUsd, 'USD')}</span></div>` : ''}
      <div class="line" style="display:flex;justify-content:space-between;margin-bottom:6px;font-weight:600;"><span>Subtotal</span><span class="amt">${money(subtotalUsd, 'USD')}</span></div>

      <div class="field" style="display:flex; align-items:center; gap:8px; margin-bottom:6px; margin-top:8px;">
        <label style="margin:0; width:90px;">Descuento</label>
        <select style="width:70px; padding:4px 6px;" onchange="CART.discountType=this.value; render()">
          <option value="amount" ${CART.discountType === 'percent' ? '' : 'selected'}>$</option>
          <option value="percent" ${CART.discountType === 'percent' ? 'selected' : ''}>%</option>
        </select>
        <input type="number" step="0.01" min="0" style="flex:1; padding:4px 6px;" value="${CART.discountVal || 0}" onchange="CART.discountVal=this.value; render()">
      </div>
      ${discountUsd > 0 ? `<div class="line" style="display:flex;justify-content:space-between;margin-bottom:6px;color:var(--clay)"><span>Monto descontado</span><span class="amt">− ${money(discountUsd, 'USD')}</span></div>` : ''}

      <hr style="border:none;border-top:1px solid var(--line-soft);margin:10px 0">
      <div class="line" style="display:flex;justify-content:space-between;font-weight:700;font-size:16px;"><span>Total a cobrar</span><span class="amt">${money(totalUsd, 'USD')}</span></div>
      <div class="line" style="display:flex;justify-content:space-between;color:var(--ink-soft);font-size:12.5px;margin-top:2px;"><span>Equivalente</span><span class="amt">${money(totalBs, 'Bs')}</span></div>
      <div class="field" style="display:flex;gap:14px;margin:8px 0 0;">
        <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:400;"><input type="checkbox" ${CART.showBs ? 'checked' : ''} onchange="CART.showBs=this.checked; render()"> Incluir Bs. en la factura</label>
        ${DB.config.exchangeRateCop ? `<label style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:400;"><input type="checkbox" ${CART.showCop ? 'checked' : ''} onchange="CART.showCop=this.checked; render()"> Incluir COP en la factura</label>` : ''}
      </div>
      <div class="hint" style="font-size:11px;margin-top:2px;">El equivalente de arriba es solo referencia para ti al cobrar. Solo aparece en la factura impresa lo que marques aquí — el dólar es siempre la moneda principal.</div>

      <div class="section-title" style="margin:18px 0 8px 0;"><h2 style="font-size:14px;">Métodos de pago</h2></div>
      <div class="searchbar" style="margin-bottom:8px;">
        <select id="payMethodSel" style="flex:1">${DB.config.paymentMethods.map(m => `<option>${esc(m)}</option>`).join('')}</select>
        <button class="btn btn-sm" onclick="cartAddPaymentRow()">+ Añadir</button>
      </div>
      ${CART.payments.map((p, idx) => `
        <div class="pay-row">
          <div>${esc(p.method)}</div>
          <input type="number" step="0.01" value="${p.amountUsd}" style="padding:6px 8px;border:1px solid var(--line);border-radius:6px" onchange="cartSetPayment(${idx}, this.value)">
          <button class="btn btn-ghost btn-sm" onclick="cartRemovePayment(${idx})">✕</button>
        </div>`).join('')}
      <div class="hint" style="margin:6px 0 10px 0;">Montos de pago en dólares equivalentes (a la tasa del día).</div>

      <div class="line" style="display:flex;justify-content:space-between;font-weight:600;"><span>Pagado</span><span class="amt">${money(paidUsd, 'USD')}</span></div>
      <div class="line" style="display:flex;justify-content:space-between;font-weight:600;color:${balanceUsd > 0 ? 'var(--clay)' : 'var(--teal)'}"><span>${balanceUsd > 0 ? 'Falta / a crédito' : 'Cambio'}</span><span class="amt">${money(Math.abs(balanceUsd), 'USD')}</span></div>
      ${DB.config.exchangeRateCop ? `<div class="line" style="display:flex;justify-content:space-between;color:var(--ink-soft);font-size:12.5px;margin-top:-2px;"><span>Equivalente COP</span><span class="amt">${money(Math.abs(balanceUsd) * DB.config.exchangeRateCop, 'COP')}</span></div>` : ''}
      ${balanceUsd > 0 && !CART.clientId ? `<div class="hint" style="color:var(--clay)">Selecciona un cliente para dejar saldo a crédito.</div>` : ''}

      <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:14px;padding:11px;" ${!CART.items.length ? 'disabled' : ''} onclick="guardedRun(this,finalizeSale)">Registrar venta</button>
      <button class="btn btn-ghost" style="width:100%;justify-content:center;margin-top:6px;" onclick="cartClear()">Vaciar carrito</button>
    </div>
  </div>
</div>
  `;
}
function cartAddFromPicker() {
  const sel = document.getElementById('itemPicker').value;
  if (!sel) return;
  const [kind, id] = sel.split(':');
  addToCart(kind, id, CART.priceTier);
  render();
}
function addToCart(kind, id, tier) {
  tier = tier || CART.priceTier;
  if (kind === 'p') {
    const p = getProduct(id); if (!p) return;
    const existing = CART.items.find(it => it.kind === 'p' && it.refId === id && it.tier === tier);
    if (existing) existing.qty += 1;
    else CART.items.push({ kind: 'p', refId: id, name: p.name, tier, priceUsd: tierPrice(p, tier), cost: p.cost, qty: 1 });
  } else {
    const s = getService(id); if (!s) return;
    const existing = CART.items.find(it => it.kind === 's' && it.refId === id);
    if (existing) existing.qty += 1;
    else CART.items.push({ kind: 's', refId: id, name: s.name, priceUsd: s.price, cost: 0, qty: 1 });
  }
}
function cartSetItemTier(idx, tier) {
  const it = CART.items[idx];
  if (!it || it.kind !== 'p') return;
  const p = getProduct(it.refId); if (!p) return;
  it.tier = tier;
  it.priceUsd = tierPrice(p, tier);
  render();
}
function cartSetQty(idx, val) { CART.items[idx].qty = Math.max(1, Number(val) || 1); render(); }
function cartRemove(idx) { CART.items.splice(idx, 1); render(); }
function cartClear() { CART = { items: [], clientId: '', vendor: DB.config.vendors[0] || '', payments: [], lastTicket: null, priceTier: 'ami', showBs: false, showCop: false, discountType: 'amount', discountVal: 0 }; render(); }
function cartAddPaymentRow() {
  const method = document.getElementById('payMethodSel').value;
  CART.payments.push({ method, amountUsd: 0 });
  render();
}
function cartSetPayment(idx, val) { CART.payments[idx].amountUsd = Number(val) || 0; render(); }
function cartRemovePayment(idx) { CART.payments.splice(idx, 1); render(); }

async function finalizeSale() {
  if (!CART.items.length) return;
  const subtotalItemsUsd = CART.items.reduce((a, it) => a + it.priceUsd * it.qty, 0);
  const ivaPct = DB.config.iva || 0;
  const ivaUsd = subtotalItemsUsd * ivaPct / 100;
  const subtotalUsd = subtotalItemsUsd + ivaUsd;

  let discountUsd = 0;
  if (CART.discountType === 'percent') {
    discountUsd = Math.round(subtotalUsd * (Number(CART.discountVal) || 0) / 100 * 100) / 100;
  } else {
    discountUsd = Math.round((Number(CART.discountVal) || 0) * 100) / 100;
  }
  discountUsd = Math.min(discountUsd, subtotalUsd);

  const totalUsd = Math.max(0, subtotalUsd - discountUsd);
  const totalBs = totalUsd * DB.config.exchangeRate;
  const paidUsd = CART.payments.reduce((a, p) => a + Number(p.amountUsd || 0), 0);
  let creditAmount = 0, changeUsd = 0;
  if (paidUsd < totalUsd) {
    if (!CART.clientId) { toast('Selecciona un cliente para dejar saldo a crédito, o completa el pago.', true); return; }
    creditAmount = totalUsd - paidUsd;
  } else {
    changeUsd = paidUsd - totalUsd;
  }
  // stock check
  for (const it of CART.items) {
    if (it.kind === 'p') {
      const p = getProduct(it.refId);
      if (!p || (p.stock || 0) < it.qty) { toast(`Existencia insuficiente de "${it.name}".`, true); return; }
    }
  }
  const client = CART.clientId ? getClient(CART.clientId) : null;
  const ticketNo = (DB.sales.length + 1);
  const sale = {
    id: uid('venta'), ticketNo, date: todayISO(), ts: Date.now(),
    clientId: CART.clientId || '', clientName: client ? client.name : 'Cliente ocasional',
    vendor: CART.vendor, items: CART.items.map(it => ({ ...it })),
    subtotalUsd, discountUsd, discountNote: '', ivaUsd, totalUsd, totalBs, payments: CART.payments.map(p => ({ ...p })),
    changeUsd, creditAmount, exchangeRate: DB.config.exchangeRate, exchangeRateCop: DB.config.exchangeRateCop || 0,
    showBs: !!CART.showBs, showCop: !!(CART.showCop && DB.config.exchangeRateCop)
  };
  DB.sales.push(sale);
  CART.items.forEach(it => { if (it.kind === 'p') { const p = getProduct(it.refId); if (p) p.stock = (p.stock || 0) - it.qty; } });
  await save('sales'); await save('products');
  CART.lastTicket = sale;
  toast('Venta registrada ✓');
  showTicket(sale);
  CART = { items: [], clientId: '', vendor: CART.vendor, payments: [], lastTicket: null, priceTier: 'ami', showBs: false, showCop: false, discountType: 'amount', discountVal: 0 };
  render();
}
function showTicket(sale) {
  const cfg = DB.config;
  const mid = openModal(`
<div class="modal-head"><h3>Ticket de venta</h3><button class="x-close">✕</button></div>
<div class="modal-body">
  <div class="ticket-wrap"><div class="ticket" id="ticketPrint">
    <div class="biz">${esc(cfg.businessName)}</div>
    <div class="biz-sub">${cfg.rif ? ('RIF: ' + esc(cfg.rif) + ' · ') : ''}${esc(cfg.address || '')}</div>
    <hr>
    <div class="line"><span>Ticket N°</span><span>${sale.ticketNo}</span></div>
    <div class="line"><span>Fecha</span><span>${fmtDate(sale.date)}</span></div>
    <div class="line"><span>Vendedor</span><span>${esc(sale.vendor)}</span></div>
    <div class="line"><span>Cliente</span><span>${esc(sale.clientName)}</span></div>
    <hr>
    <div class="items">
      ${sale.items.map(it => `<div class="line"><span>${it.qty} x ${esc(it.name)}</span><span>${money(it.priceUsd * it.qty, 'USD')}</span></div>`).join('')}
    </div>
    <hr>
    ${(sale.ivaUsd > 0 || (sale.subtotalUsd - sale.ivaUsd) !== sale.subtotalUsd) ? `<div class="line"><span>Items</span><span>${money(sale.subtotalUsd - sale.ivaUsd, 'USD')}</span></div>` : ''}
    ${sale.ivaUsd > 0 ? `<div class="line"><span>IVA</span><span>${money(sale.ivaUsd, 'USD')}</span></div>` : ''}
    <div class="line"><span>Subtotal</span><span>${money(sale.subtotalUsd, 'USD')}</span></div>
    ${sale.discountUsd > 0 ? `<div class="line" style="color:var(--clay)"><span>Descuento</span><span>− ${money(sale.discountUsd, 'USD')}</span></div>` : ''}

    <div class="line tot"><span>TOTAL</span><span>${money(sale.totalUsd, 'USD')}</span></div>
    ${sale.showBs ? `<div class="line"><span>Equiv. Bs.</span><span>${money(sale.totalBs, 'Bs')}</span></div>` : ''}
    ${sale.showCop ? `<div class="line"><span>Equiv. COP</span><span>${money(sale.totalUsd * sale.exchangeRateCop, 'COP')}</span></div>` : ''}
    <hr>
    ${sale.payments.map(p => `<div class="line"><span>${esc(p.method)}</span><span>${money(p.amountUsd, 'USD')}</span></div>`).join('')}
    ${sale.changeUsd > 0 ? `<div class="line"><span>Cambio</span><span>${money(sale.changeUsd, 'USD')}</span></div>` : ''}
    ${sale.creditAmount > 0 ? `<div class="line"><span>A crédito</span><span>${money(sale.creditAmount, 'USD')}</span></div>` : ''}
    <div class="thanks">¡Gracias por su compra!</div>
  </div></div>
</div>
<div class="modal-foot"><button class="btn" onclick="printTicket()">Imprimir</button><button class="btn btn-primary" onclick="closeModal(MID)">Cerrar</button></div>
  `);
  fixModal(mid);
}
function printTicket() { window.print(); }



// Expose to global scope for inline HTML handlers
window.CART = CART;
window.addToCart = addToCart;
window.cartAddFromPicker = cartAddFromPicker;
window.cartAddPaymentRow = cartAddPaymentRow;
window.cartClear = cartClear;
window.cartRemove = cartRemove;
window.cartRemovePayment = cartRemovePayment;
window.cartSetItemTier = cartSetItemTier;
window.cartSetPayment = cartSetPayment;
window.cartSetQty = cartSetQty;
window.finalizeSale = finalizeSale;
window.printTicket = printTicket;
window.renderVentas = renderVentas;
window.showTicket = showTicket;
