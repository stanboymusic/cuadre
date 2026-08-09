

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
  <table><thead><tr><th>Código</th><th>Producto</th><th>Costo</th><th>Precio 1</th><th>Precio 2</th><th>Precio 3</th>${DB.config.useFictitiousRate ? `<th>Precio mostrador (+${(DB.config.cashDiscountPercent || 0)}%)</th>` : ''}<th>Existencia</th><th>Ubicación</th><th></th></tr></thead>
  <tbody>${list.map(p => `
    <tr>
      <td class="mono">${esc(p.code || '—')}</td>
      <td>${esc(p.name)}</td>
      <td class="amt">${money(p.cost, 'USD')}</td>
      <td class="amt">${money(p.price, 'USD')}</td>
      <td class="amt">${p.price2 ? money(p.price2, 'USD') : '—'}</td>
      <td class="amt">${p.price3 ? money(p.price3, 'USD') : '—'}</td>
      ${DB.config.useFictitiousRate ? `<td class="amt" style="font-weight:700;color:var(--gold);">${money(sellPrice(p.price), 'USD')}</td>` : ''}
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
  const p = id ? getProduct(id) : { id: '', code: '', name: '', cost: 0, price: 0, price2: 0, price3: 0, priceValue2: 0, priceValue3: 0, stock: 0, minStock: 0, location: '', supplierId: '', priceMethod: 'markup', priceValue: 30 };
  const mid = openModal(`
<div class="modal-head"><h3>${id ? 'Editar' : 'Nuevo'} producto</h3><button class="x-close">✕</button></div>
<div class="modal-body">
  <div class="row-fields">
    <div class="field"><label>Código</label><input id="f_code" value="${esc(p.code || '')}"></div>
    <div class="field" style="grid-column:span 2;"><label>Nombre</label><input id="f_name" value="${esc(p.name || '')}"></div>
  </div>
  <div class="field"><label>Costo (USD)</label><input id="f_cost" type="number" step="0.01" value="${p.cost || 0}" oninput="updatePricePreview()"></div>

  <div class="card card-pad" style="background:var(--paper);margin:10px 0;">
    <div style="font-weight:600;font-size:12.5px;margin-bottom:8px;">Calculadora de precio</div>
    <div class="row-fields">
      <div class="field" style="margin:0;">
        <label>Método</label>
        <select id="f_method" onchange="updatePricePreview()">
          <option value="markup" ${p.priceMethod === 'markup' ? 'selected' : ''}>% utilidad sobre el costo</option>
          <option value="margin" ${p.priceMethod === 'margin' ? 'selected' : ''}>% margen sobre el precio (utilidad bruta)</option>
          <option value="manual" ${p.priceMethod === 'manual' ? 'selected' : ''}>Precio manual (USD)</option>
        </select>
      </div>
      <div class="field" style="margin:0;">
        <label id="f_value_lbl">Valor</label>
        <input id="f_value" type="number" step="0.01" value="${p.priceValue || 0}" oninput="updatePricePreview()">
      </div>
    </div>
    <div class="hint" id="pricePreview" style="margin-top:6px;font-size:12.5px;"></div>
  </div>
  <div class="card card-pad" style="background:var(--paper);margin:10px 0;">
    <div style="font-weight:600;font-size:12.5px;margin-bottom:8px;">Precios adicionales (ofertas / clientes especiales)</div>
    <div class="row-fields">
      <div class="field" style="margin:0;"><label>Precio 2 — % ganancia</label><input id="f_value2" type="number" step="0.01" value="${p.priceValue2 || 0}" oninput="updatePricePreview()"></div>
      <div class="field" style="margin:0;"><label>Precio 2 (USD)</label><input id="f_price2" type="number" step="0.01" value="${p.price2 || 0}" readonly></div>
    </div>
    <div class="row-fields" style="margin-top:8px;">
      <div class="field" style="margin:0;"><label>Precio 3 — % ganancia</label><input id="f_value3" type="number" step="0.01" value="${p.priceValue3 || 0}" oninput="updatePricePreview()"></div>
      <div class="field" style="margin:0;"><label>Precio 3 (USD)</label><input id="f_price3" type="number" step="0.01" value="${p.price3 || 0}" readonly></div>
    </div>
  </div>
  <div class="row-fields">
    <div class="field"><label>Precio de venta final (USD)</label><input id="f_price" type="number" step="0.01" value="${p.price || 0}"></div>
    <div class="field"><label>Existencia</label><input id="f_stock" type="number" value="${p.stock || 0}"></div>
    <div class="field"><label>Mínimo (alerta)</label><input id="f_min" type="number" value="${p.minStock || 0}"></div>
  </div>
  <div class="row-fields">
    <div class="field"><label>Ubicación</label><input id="f_loc" value="${esc(p.location || '')}"></div>
    <div class="field"><label>Proveedor</label>
      <select id="f_sup"><option value="">—</option>${DB.suppliers.map(s => `<option value="${s.id}" ${p.supplierId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
    </div>
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
  const method = document.getElementById('f_method').value;
  const value = Number(document.getElementById('f_value').value) || 0;
  const lbl = document.getElementById('f_value_lbl');
  const preview = document.getElementById('pricePreview');

  const v2 = Number(document.getElementById('f_value2').value) || 0;
  const v3 = Number(document.getElementById('f_value3').value) || 0;
  document.getElementById('f_price2').value = calcPriceFromCost(cost, 'markup', v2).toFixed(2);
  document.getElementById('f_price3').value = calcPriceFromCost(cost, 'markup', v3).toFixed(2);

  if (method === 'manual') { lbl.textContent = '—'; document.getElementById('f_value').disabled = true; preview.textContent = ''; return; }
  document.getElementById('f_value').disabled = false;
  lbl.textContent = method === 'markup' ? '% sobre el costo' : '% margen sobre el precio';
  const price = calcPriceFromCost(cost, method, value);
  document.getElementById('f_price').value = price.toFixed(2);
  preview.innerHTML = `Precio sugerido: <b>${money(price, 'USD')}</b> · equivale a <b>${money(price * DB.config.exchangeRate, 'Bs')}</b> a la tasa del día.`;
}
async function saveProduct(id) {
  const data = {
    code: document.getElementById('f_code').value.trim(),
    name: document.getElementById('f_name').value.trim(),
    cost: Number(document.getElementById('f_cost').value) || 0,
    priceMethod: document.getElementById('f_method').value,
    priceValue: Number(document.getElementById('f_value').value) || 0,
    price: Number(document.getElementById('f_price').value) || 0,
    priceValue2: Number(document.getElementById('f_value2').value) || 0,
    price2: Number(document.getElementById('f_price2').value) || 0,
    priceValue3: Number(document.getElementById('f_value3').value) || 0,
    price3: Number(document.getElementById('f_price3').value) || 0,
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
