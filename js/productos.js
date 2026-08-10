

let PROD_FILTER = '';
function renderProductos(el) {
  const list = DB.products.filter(p => smartMatch(PROD_FILTER, p.name, p.code));

  el.innerHTML = `
<div class="searchbar">
  <input id="prodSearch" placeholder="Buscar por nombre o código…" value="${esc(PROD_FILTER)}" oninput="filterAndRerender(v=>PROD_FILTER=v, this, renderProductos)">
  <button class="btn btn-gold" onclick="openProductForm()">+ Nuevo producto</button>
</div>
${list.length ? `
<div class="table-wrap">
  <table><thead><tr><th>Código</th><th>Producto</th><th>Costo (PB)</th>${PRICE_TIERS.map(t => `<th>${t.label}</th>`).join('')}<th>Existencia</th><th>Ubicación</th><th></th></tr></thead>
  <tbody>${list.map(p => `
    <tr>
      <td class="mono">${esc(p.code || '—')}</td>
      <td>${esc(p.name)}</td>
      <td class="amt">${money(p.cost, 'USD')}</td>
      ${PRICE_TIERS.map(t => `<td class="amt">${money(tierPrice(p, t.key), 'USD')}</td>`).join('')}

      <td class="amt">${(p.stock || 0) <= (p.minStock || 0) ? `<span class="tag tag-clay">${p.stock || 0}</span>` : (p.stock || 0)}</td>
      <td>${esc(p.location || '—')}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-gold btn-sm" ${(p.stock || 0) <= 0 ? 'disabled' : ''} onclick="addToCart('p','${p.id}'); toast('Agregado al carrito ✓')" title="Agregar al carrito">+ Carrito</button>
        <button class="btn btn-ghost btn-sm" onclick="openProductForm('${p.id}')">Editar</button>
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
  <div class="row-fields">
    <div class="field"><label>Existencia</label><input id="f_stock" type="number" value="${p.stock || 0}"></div>
    <div class="field"><label>Mínimo (alerta)</label><input id="f_min" type="number" value="${p.minStock || 0}"></div>
    <div class="field"><label>Ubicación</label><input id="f_loc" value="${esc(p.location || '')}"></div>
  </div>
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
  preview.innerHTML = PRICE_TIERS.map(t => `
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
    stock: Number(document.getElementById('f_stock').value) || 0,
    minStock: Number(document.getElementById('f_min').value) || 0,
    location: document.getElementById('f_loc').value.trim(),
    supplierId: document.getElementById('f_sup').value,
  };
  if (!data.name) { toast('El nombre es obligatorio', true); return; }
  if (id) { Object.assign(getProduct(id), data); }
  else { data.id = uid('prod'); DB.products.push(data); }
  await save('products');
  closeTopModal(); toast('Producto guardado ✓'); renderProductos(document.getElementById('content'));
}
async function deleteProduct(id) {
  DB.products = DB.products.filter(p => p.id !== id);
  await save('products'); closeTopModal(); toast('Producto eliminado'); renderProductos(document.getElementById('content'));
}



// Expose to global scope for inline HTML handlers
window.PROD_FILTER = PROD_FILTER;
window.deleteProduct = deleteProduct;
window.openProductForm = openProductForm;
window.renderProductos = renderProductos;
window.saveProduct = saveProduct;
window.updatePricePreview = updatePricePreview;
