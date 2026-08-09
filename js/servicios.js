

function renderServicios(el) {
  el.innerHTML = `
<div class="searchbar"><div style="flex:1"></div><button class="btn btn-gold" onclick="openServiceForm()">+ Nuevo servicio</button></div>
${DB.services.length ? `
<div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Precio</th><th></th></tr></thead>
  <tbody>${DB.services.map(s => `<tr><td>${esc(s.name)}</td><td class="amt">${money(s.price, 'USD')}</td>
    <td><button class="btn btn-ghost btn-sm" onclick="openServiceForm('${s.id}')">Editar</button></td></tr>`).join('')}</tbody></table>
</div>` : `<div class="empty"><div class="big">✎</div>Todavía no hay servicios registrados.</div>`}
  `;
}
function openServiceForm(id) {
  const s = id ? getService(id) : { name: '', price: 0 };
  const mid = openModal(`
<div class="modal-head"><h3>${id ? 'Editar' : 'Nuevo'} servicio</h3><button class="x-close">✕</button></div>
<div class="modal-body">
  <div class="field"><label>Nombre</label><input id="f_sname" value="${esc(s.name)}"></div>
  <div class="field"><label>Precio (USD)</label><input id="f_sprice" type="number" step="0.01" value="${s.price}"></div>
</div>
<div class="modal-foot">
  ${id ? `<button class="btn btn-clay" onclick="guardedRun(this,()=>deleteService('${id}'))">Eliminar</button>` : ''}
  <button class="btn" onclick="closeModal(MID)">Cancelar</button>
  <button class="btn btn-primary" onclick="guardedRun(this,()=>saveService('${id || ''}'))">Guardar</button>
</div>
  `);
  fixModal(mid);
}
async function saveService(id) {
  const name = document.getElementById('f_sname').value.trim();
  const price = Number(document.getElementById('f_sprice').value) || 0;
  if (!name) { toast('El nombre es obligatorio', true); return; }
  if (id) { Object.assign(getService(id), { name, price }); }
  else DB.services.push({ id: uid('serv'), name, price });
  await save('services'); closeTopModal(); toast('Servicio guardado ✓'); renderServicios(document.getElementById('content'));
}
async function deleteService(id) {
  DB.services = DB.services.filter(s => s.id !== id);
  await save('services'); closeTopModal(); toast('Servicio eliminado'); renderServicios(document.getElementById('content'));
}



// Expose to global scope for inline HTML handlers
window.deleteService = deleteService;
window.openServiceForm = openServiceForm;
window.renderServicios = renderServicios;
window.saveService = saveService;
