

let PURCHASE_DRAFT = { supplierId: '', items: [] };
function renderCompras(el) {
  const totalUsd = PURCHASE_DRAFT.items.reduce((a, it) => a + it.unitCost * it.qty, 0);
  el.innerHTML = `
<div class="card card-pad">
  <div class="row-fields">
    <div class="field"><label>Proveedor</label>
      <select id="pu_sup" onchange="setPurchaseSupplier(this.value)">
        <option value="">— Selecciona —</option>
        ${DB.suppliers.map(s => `<option value="${s.id}" ${PURCHASE_DRAFT.supplierId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>Fecha</label><input value="${fmtDate(todayISO())}" disabled></div>
    <div class="field"><label>N° de compra</label><input value="C-${DB.purchases.length + 1}" disabled></div>
  </div>
  ${!DB.suppliers.length ? `<div class="hint">Aún no tienes proveedores. <a href="#" onclick="navigate('proveedores');return false;">Crea uno primero</a>.</div>` : ''}
  <div class="hint">También puedes activar el <b>Modo compra</b> desde Productos para ir agregando artículos al carrito directamente desde el catálogo.</div>
  <div class="section-title" style="margin:16px 0 8px 0;"><h2 style="font-size:14px;">Productos comprados</h2></div>
  <div class="searchbar">
    <select id="pu_prod" style="flex:1">
      <option value="">— Selecciona un producto —</option>
      ${DB.products.map(p => `<option value="${p.id}">${esc(p.name)} (costo actual ${money(p.cost, 'USD')})</option>`).join('')}
    </select>
    <input id="pu_qty" type="number" min="1" value="1" style="width:80px" placeholder="Cant.">
    <input id="pu_cost" type="number" step="0.01" style="width:100px" placeholder="Costo unit. $">
    <button class="btn btn-gold" onclick="addPurchaseLine()">+ Añadir</button>
  </div>
  ${PURCHASE_DRAFT.items.length ? `
    <div class="table-wrap"><table><thead><tr><th>Producto</th><th>Cant.</th><th>Costo unit.</th><th>Existencia previa</th><th>Costo previo</th><th>Nuevo costo prom.</th><th>Total</th><th></th></tr></thead>
      <tbody>${PURCHASE_DRAFT.items.map((it, idx) => {
    const p = getProduct(it.productId);
    const prevStock = p.stock || 0, prevCost = p.cost || 0;
    const newAvgCost = (prevStock + it.qty) > 0 ? ((prevStock * prevCost) + (it.qty * it.unitCost)) / (prevStock + it.qty) : it.unitCost;
    return `<tr><td>${esc(p.name)}</td><td class="amt">${it.qty}</td><td class="amt">${money(it.unitCost, 'USD')}</td>
          <td class="amt">${prevStock}</td><td class="amt">${money(prevCost, 'USD')}</td><td class="amt">${money(newAvgCost, 'USD')}</td>
          <td class="amt">${money(it.unitCost * it.qty, 'USD')}</td><td><button class="btn btn-ghost btn-sm" onclick="removePurchaseLine(${idx})">✕</button></td></tr>`;
  }).join('')}</tbody></table></div>
    <div style="text-align:right;margin-top:10px;font-weight:700;">Total compra: <span class="amt">${money(totalUsd, 'USD')}</span></div>
    <button class="btn btn-primary" style="margin-top:12px;" onclick="guardedRun(this,finalizePurchase)">Registrar compra</button>
  ` : `<div class="empty" style="padding:24px;"><div class="big">⇩</div>Añade productos para registrar la compra.</div>`}
</div>
  `;
}

// Cambia el proveedor de la compra en curso. Como una compra = una factura de
// un solo proveedor, si ya hay líneas en el carrito con otro proveedor distinto
// se avisa en vez de mezclar productos de dos proveedores en una misma factura.
function setPurchaseSupplier(supplierId) {
  if (PURCHASE_DRAFT.items.length && PURCHASE_DRAFT.supplierId && PURCHASE_DRAFT.supplierId !== supplierId) {
    toast('Ya tienes productos en el carrito de otro proveedor. Registra o vacía esa compra antes de cambiar de proveedor.', true);
    render();
    return;
  }
  PURCHASE_DRAFT.supplierId = supplierId;
  render();
}

// Agrega una línea al carrito de compra a partir de valores ya validados
// (usado tanto por el formulario de Compras como por el Modo compra en Productos).
function addPurchaseCartItem(productId, qty, unitCost) {
  if (!productId || !(qty > 0) || !(unitCost >= 0)) { toast('Completa producto, cantidad y costo', true); return false; }
  const existing = PURCHASE_DRAFT.items.find(it => it.productId === productId);
  if (existing) existing.qty += qty;
  else PURCHASE_DRAFT.items.push({ productId, qty, unitCost });
  return true;
}

function addPurchaseLine() {
  const productId = document.getElementById('pu_prod').value;
  const qty = Number(document.getElementById('pu_qty').value) || 0;
  const unitCost = Number(document.getElementById('pu_cost').value) || 0;
  if (addPurchaseCartItem(productId, qty, unitCost)) render();
}
function removePurchaseLine(idx) { PURCHASE_DRAFT.items.splice(idx, 1); render(); }

async function finalizePurchase() {
  if (!PURCHASE_DRAFT.supplierId) { toast('Selecciona un proveedor', true); return; }
  if (!PURCHASE_DRAFT.items.length) return;
  const totalUsd = PURCHASE_DRAFT.items.reduce((a, it) => a + it.unitCost * it.qty, 0);
  const purchase = {
    id: uid('compra'), purchaseNo: DB.purchases.length + 1, date: todayISO(), ts: Date.now(),
    supplierId: PURCHASE_DRAFT.supplierId, items: PURCHASE_DRAFT.items.map(it => ({ ...it })), totalUsd
  };
  PURCHASE_DRAFT.items.forEach(it => {
    const p = getProduct(it.productId);
    const prevStock = p.stock || 0, prevCost = p.cost || 0;
    const newAvgCost = (prevStock + it.qty) > 0 ? ((prevStock * prevCost) + (it.qty * it.unitCost)) / (prevStock + it.qty) : it.unitCost;
    p.stock = prevStock + it.qty;
    p.cost = Number(newAvgCost.toFixed(4));
  });
  DB.purchases.push(purchase);
  await save('purchases'); await save('products');
  // Se limpia el carrito MUTANDO el objeto (no reasignando PURCHASE_DRAFT),
  // porque window.PURCHASE_DRAFT guarda una referencia al mismo objeto: si se
  // reasigna aquí, esa referencia queda apuntando al carrito viejo y cualquier
  // pantalla que lo consulte (como Modo compra en Productos) deja de verse actualizada.
  PURCHASE_DRAFT.supplierId = '';
  PURCHASE_DRAFT.items = [];
  showPurchaseInvoice(purchase);
}

function showPurchaseInvoice(purchase) {
  const supplier = DB.suppliers.find(s => s.id === purchase.supplierId);
  const mid = openModal(`
<div class="modal-head"><h3>Factura de compra C-${purchase.purchaseNo}</h3><button class="x-close">✕</button></div>
<div class="modal-body" id="purchaseInvoiceBody">
  <div style="margin-bottom:10px;">
    <div><b>Proveedor:</b> ${esc(supplier ? supplier.name : '—')}</div>
    <div><b>Fecha:</b> ${fmtDate(purchase.date)}</div>
    <div><b>N° de compra:</b> C-${purchase.purchaseNo}</div>
  </div>
  <div class="table-wrap"><table><thead><tr><th>Producto</th><th>Cant.</th><th>Costo unit.</th><th>Total</th></tr></thead>
    <tbody>${purchase.items.map(it => {
    const p = getProduct(it.productId);
    return `<tr><td>${esc(p ? p.name : it.productId)}</td><td class="amt">${it.qty}</td><td class="amt">${money(it.unitCost, 'USD')}</td><td class="amt">${money(it.unitCost * it.qty, 'USD')}</td></tr>`;
  }).join('')}</tbody></table></div>
  <div style="text-align:right;margin-top:10px;font-weight:700;">Total compra: <span class="amt">${money(purchase.totalUsd, 'USD')}</span></div>
</div>
<div class="modal-foot"><button class="btn" onclick="printPurchaseInvoice()">Imprimir</button><button class="btn btn-primary" onclick="closeModal('${mid}'); render();">Cerrar</button></div>
  `);
  fixModal(mid);
}
function printPurchaseInvoice() { window.print(); }



// Expose to global scope for inline HTML handlers
window.PURCHASE_DRAFT = PURCHASE_DRAFT;
window.addPurchaseCartItem = addPurchaseCartItem;
window.addPurchaseLine = addPurchaseLine;
window.setPurchaseSupplier = setPurchaseSupplier;
window.finalizePurchase = finalizePurchase;
window.removePurchaseLine = removePurchaseLine;
window.renderCompras = renderCompras;
window.showPurchaseInvoice = showPurchaseInvoice;
window.printPurchaseInvoice = printPurchaseInvoice;
