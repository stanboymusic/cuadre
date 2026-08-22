
let PROD_FILTER = '';
// Modo compra: al activarlo, cada fila del catálogo muestra cantidad + costo
// unit. y un botón para ir sumando productos al carrito de compra (mismo
// PURCHASE_DRAFT que usa la sección Compras). PURCHASE_ROWS guarda, por
// producto, la cantidad/costo que el usuario está por agregar (no lo que ya
// está en el carrito).
let PURCHASE_MODE = false;
let PURCHASE_ROWS = {};

function togglePurchaseMode() {
  PURCHASE_MODE = !PURCHASE_MODE;
  render();
}
function purchaseRow(p) {
  if (!PURCHASE_ROWS[p.id]) PURCHASE_ROWS[p.id] = { qty: 1, unitCost: p.cost || 0 };
  return PURCHASE_ROWS[p.id];
}
function setPurchaseRowQty(id, val) { purchaseRow(getProduct(id)).qty = Number(val) || 0; }
function setPurchaseRowCost(id, val) { purchaseRow(getProduct(id)).unitCost = Number(val) || 0; }
function addProductToPurchaseCart(id) {
  const p = getProduct(id);
  const row = purchaseRow(p);
  if (addPurchaseCartItem(id, row.qty, row.unitCost)) {
    toast('Agregado a la compra ✓');
    PURCHASE_ROWS[id] = { qty: 1, unitCost: p.cost || 0 };
    render();
  }
}
async function finalizePurchaseFromProductos() {
  if (!PURCHASE_DRAFT.supplierId) { toast('Selecciona el proveedor de la compra', true); return; }
  if (!PURCHASE_DRAFT.items.length) { toast('Agrega al menos un producto al carrito de compra', true); return; }
  await finalizePurchase();
}

function renderProductos(el) {
  const list = DB.products.filter(p => smartMatch(PROD_FILTER, p.name, p.code));
  const cartCount = PURCHASE_DRAFT.items.length;

  el.innerHTML = `
<div class="searchbar">
  <input id="prodSearch" placeholder="Buscar por nombre o código…" value="${esc(PROD_FILTER)}" oninput="filterAndRerender(v=>PROD_FILTER=v, this, renderProductos)">
  <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;white-space:nowrap;">
    <input type="checkbox" ${PURCHASE_MODE ? 'checked' : ''} onchange="togglePurchaseMode()"> Modo compra
  </label>
  ${PURCHASE_MODE ? `
    <select id="pm_sup" style="max-width:200px" onchange="setPurchaseSupplier(this.value)">
      <option value="">— Proveedor —</option>
      ${DB.suppliers.map(s => `<option value="${s.id}" ${PURCHASE_DRAFT.supplierId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
    </select>
    <button class="btn btn-primary" ${!cartCount ? 'disabled' : ''} onclick="guardedRun(this,finalizePurchaseFromProductos)">Finalizar compra ${cartCount ? `(${cartCount})` : ''}</button>
  ` : `<button class="btn btn-gold" onclick="openProductForm()">+ Nuevo producto</button>`}
</div>
${!DB.suppliers.length && PURCHASE_MODE ? `<div class="hint">Aún no tienes proveedores. <a href="#" onclick="navigate('proveedores');return false;">Crea uno primero</a>.</div>` : ''}
${list.length ? `
<div class="table-wrap">
  <table><thead><tr><th>Código</th><th>Producto</th><th>Costo (PB)</th>${PRICE_TIERS.map(t => `<th>${t.label}</th>`).join('')}<th>Existencia</th><th>Ubicación</th>${PURCHASE_MODE ? `<th>Cant.</th><th>Costo unit.</th>` : ''}<th></th></tr></thead>
  <tbody>${list.map(p => `
    <tr>
      <td class="mono">${esc(p.code || '—')}</td>
      <td>${esc(p.name)}</td>
      <td class="amt">${money(p.cost, 'USD')}</td>
      ${PRICE_TIERS.map(t => `<td class="amt">${money(tierPrice(p, t.key), 'USD')}</td>`).join('')}

      <td class="amt">${(p.stock || 0) <= (p.minStock || 0) ? `<span class="tag tag-clay">${p.stock || 0}</span>` : (p.stock || 0)}</td>
      <td>${esc(p.location || '—')}</td>
      ${PURCHASE_MODE ? `
        <td><input type="number" min="1" value="${purchaseRow(p).qty}" style="width:64px;padding:4px 6px;border:1px solid var(--line);border-radius:6px" onchange="setPurchaseRowQty('${p.id}', this.value)"></td>
        <td><input type="number" step="0.01" value="${purchaseRow(p).unitCost}" style="width:84px;padding:4px 6px;border:1px solid var(--line);border-radius:6px" onchange="setPurchaseRowCost('${p.id}', this.value)"></td>
      ` : ''}
      <td style="white-space:nowrap;">
        ${PURCHASE_MODE
      ? `<button class="btn btn-gold btn-sm" onclick="addProductToPurchaseCart('${p.id}')" title="Agregar a la compra">+ Carrito</button>`
      : `<button class="btn btn-gold btn-sm" ${(p.stock || 0) <= 0 ? 'disabled' : ''} onclick="addToCart('p','${p.id}'); toast('Agregado al carrito ✓')" title="Agregar a la venta">+ Carrito</button>
         <button class="btn btn-ghost btn-sm" onclick="openProductForm('${p.id}')">Editar</button>`}
      </td>
    </tr>`).join('')}</tbody></table>
</div>` : `<div class="empty"><div class="big">▣</div>No hay productos que coincidan. <div class="help-empty-cta"><button class="btn btn-gold" onclick="openProductForm()">+ Nuevo producto</button></div></div>`}
  `;
}
function openProductForm(id) {
  const p = id ? getProduct(id) : { id: '', code: '', name: '', cost: 0, stock: 0, minStock: 0, location: '', supplierId: '' };
  const mid = openModal(`
<div class="modal-head"><h3>${id ? 'Editar' : 'Nuevo'} producto</h3><button class="x-close">✕</button></div>
<div class="modal-body">
  <div class="row-fields">
    <div class="field"><label>Código</label><input id="f_code" value="${esc(p.code || '')}"></div>
    <div class="field" style="grid-column:span 2;"><label>Nombre</label><input id="f_name" value="${esc(p.name || '')}"></div>
  </div>
  <div class="field"><label>Precio base — PB (costo del producto, USD)</label><input id="f_cost" type="number" step="0.01" value="${p.cost || 0}" oninput="updatePricePreview()"></div>

  <div class="card card-pad" style="background:var(--paper);margin:10px 0;">
    <div style="font-weight:600;font-size:12.5px;margin-bottom:8px;">Precios oficiales (se calculan solos a partir del PB)</div>
    <div id="pricePreview" class="row-fields" style="grid-template-columns:repeat(5,1fr);"></div>
  </div>
  <div class="field"><label>Precio personalizado (USD) — opcional</label><input id="f_customPrice" type="number" step="0.01" value="${p.price || 0}"></div>
  <div class="hint" style="margin:-6px 0 10px 0;">Se escribe a mano, no se recalcula con el PB. Si lo dejas en 0, ese nivel se verá en $0,00 en Ventas — no lo selecciones ahí hasta ponerle un valor.</div>
  <div class="row-fields">
    ${id ? `<div class="field"><label>Existencia actual</label><input value="${p.stock || 0}" disabled title="La existencia solo se actualiza registrando una compra en Compras."></div>` : ''}
    <div class="field"><label>Mínimo (alerta)</label><input id="f_min" type="number" value="${p.minStock || 0}"></div>
    <div class="field"><label>Ubicación</label><input id="f_loc" value="${esc(p.location || '')}"></div>
  </div>
  ${!id ? `<div class="hint">El producto se crea con existencia 0. Para agregar unidades, regístralo en Compras o desde el Modo compra del catálogo.</div>` : ''}
  <div class="field"><label>Proveedor</label>
    <select id="f_sup"><option value="">—</option>${DB.suppliers.map(s => `<option value="${s.id}" ${p.supplierId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
  </div>
</div>
<div class="modal-foot">
  ${id ? `<button class="btn btn-clay" onclick="guardedRun(this,()=>deleteProduct('${id}'))">Eliminar</button>` : ''}
  <button class="btn" onclick="closeModal(MID)">Cancelar</button>
  <button class="btn btn-primary" onclick="guardedRun(this,()=>saveProduct('${id || ''}'))">Guardar</button>
</div>
  `);
  fixModal(mid);
  updatePricePreview();
}
function updatePricePreview() {
  const cost = Number(document.getElementById('f_cost').value) || 0;
  const preview = document.getElementById('pricePreview');
  if (!preview) return;
  preview.innerHTML = PRICE_TIERS.filter(t => t.key !== 'custom').map(t => `
    <div class="field" style="margin:0;">
      <label>${t.label} (${t.margin}%)</label>
      <input value="${money(tierPrice({ cost }, t.key), 'USD')}" readonly>
    </div>`).join('');
}
async function saveProduct(id) {
  const data = {
    code: document.getElementById('f_code').value.trim(),
    name: document.getElementById('f_name').value.trim(),
    cost: Number(document.getElementById('f_cost').value) || 0,
    price: Number(document.getElementById('f_customPrice').value) || 0,
    minStock: Number(document.getElementById('f_min').value) || 0,
    location: document.getElementById('f_loc').value.trim(),
    supplierId: document.getElementById('f_sup').value,
  };
  if (!data.name) { toast('El nombre es obligatorio', true); return; }
  // La existencia NUNCA se fija a mano: un producto nuevo entra con stock 0
  // y a partir de ahí solo cambia por Compras (entradas) o Ventas (salidas).
  // Esto evita que quien crea el producto duplique el patrimonio al cargar
  // de una vez el stock inicial Y luego registrar la compra que lo originó.
  if (id) { Object.assign(getProduct(id), data); }
  else { data.id = uid('prod'); data.stock = 0; DB.products.push(data); }
  await save('products');
  closeTopModal(); toast('Producto guardado ✓'); renderProductos(document.getElementById('content'));
}
async function deleteProduct(id) {
  DB.products = DB.products.filter(p => p.id !== id);
  await save('products'); closeTopModal(); toast('Producto eliminado'); renderProductos(document.getElementById('content'));
}



// Expose to global scope for inline HTML handlers
window.PROD_FILTER = PROD_FILTER;
window.PURCHASE_MODE = PURCHASE_MODE;
window.togglePurchaseMode = togglePurchaseMode;
window.setPurchaseRowQty = setPurchaseRowQty;
window.setPurchaseRowCost = setPurchaseRowCost;
window.addProductToPurchaseCart = addProductToPurchaseCart;
window.finalizePurchaseFromProductos = finalizePurchaseFromProductos;
window.deleteProduct = deleteProduct;
window.openProductForm = openProductForm;
window.renderProductos = renderProductos;
window.saveProduct = saveProduct;
window.updatePricePreview = updatePricePreview;
