

function renderProveedores(el) {
  el.innerHTML = `
<div class="searchbar"><div style="flex:1"></div><button class="btn btn-gold" onclick="openSupplierForm()">+ Nuevo proveedor</button></div>
${DB.suppliers.length ? `
<div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Contacto</th><th>Teléfono</th><th></th></tr></thead>
  <tbody>${DB.suppliers.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(s.contact || '—')}</td><td>${esc(s.phone || '—')}</td>
    <td><button class="btn btn-ghost btn-sm" onclick="openSupplierForm('${s.id}')">Editar</button></td></tr>`).join('')}</tbody></table>
</div>` : `<div class="empty"><div class="big">⌂</div>Todavía no hay proveedores registrados.</div>`}
  `;
}
function openSupplierForm(id) {
  const s = id ? getSupplier(id) : { name: '', contact: '', phone: '' };
  const mid = openModal(`
<div class="modal-head"><h3>${id ? 'Editar' : 'Nuevo'} proveedor</h3><button class="x-close">✕</button></div>
<div class="modal-body">
  <div class="field"><label>Nombre</label><input id="f_pname" value="${esc(s.name)}"></div>
  <div class="field"><label>Persona de contacto</label><input id="f_pcontact" value="${esc(s.contact || '')}"></div>
  <div class="field"><label>Teléfono</label><input id="f_pphone" value="${esc(s.phone || '')}"></div>
</div>
<div class="modal-foot">
  ${id ? `<button class="btn btn-clay" onclick="guardedRun(this,()=>deleteSupplier('${id}'))">Eliminar</button>` : ''}
  <button class="btn" onclick="closeModal(MID)">Cancelar</button>
  <button class="btn btn-primary" onclick="guardedRun(this,()=>saveSupplier('${id || ''}'))">Guardar</button>
</div>
  `);
  fixModal(mid);
}
async function saveSupplier(id) {
  const name = document.getElementById('f_pname').value.trim();
  if (!name) { toast('El nombre es obligatorio', true); return; }
  const data = { name, contact: document.getElementById('f_pcontact').value.trim(), phone: document.getElementById('f_pphone').value.trim() };
  if (id) { Object.assign(getSupplier(id), data); }
  else { data.id = uid('sup'); DB.suppliers.push(data); }
  await save('suppliers'); closeTopModal(); toast('Proveedor guardado ✓'); renderProveedores(document.getElementById('content'));
}
async function deleteSupplier(id) {
  DB.suppliers = DB.suppliers.filter(s => s.id !== id);
  await save('suppliers'); closeTopModal(); toast('Proveedor eliminado'); renderProveedores(document.getElementById('content'));
}

/* helper: modal ids referenced as MID inside their own onclicks */
function fixModal(mid) {
  const modal = document.getElementById(mid);
  if (!modal) return;
  modal.querySelectorAll('[onclick*="MID"]').forEach(elm => {
    elm.setAttribute('onclick', elm.getAttribute('onclick').replaceAll('MID', `'${mid}'`));
  });
  modal.querySelectorAll('.x-close').forEach(b => b.onclick = () => closeModal(mid));
}



// Expose to global scope for inline HTML handlers
window.deleteSupplier = deleteSupplier;
window.fixModal = fixModal;
window.openSupplierForm = openSupplierForm;
window.renderProveedores = renderProveedores;
window.saveSupplier = saveSupplier;
