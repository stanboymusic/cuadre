

let CLIENT_FILTER = '';
function renderClientes(el) {
  const list = DB.clients.filter(c => smartMatch(CLIENT_FILTER, c.name, c.cedula));
  const totalCxC = DB.clients.reduce((a, c) => a + Math.max(clientBalance(c.id), 0), 0);
  el.innerHTML = `
<div class="grid grid-3" style="margin-bottom:18px;">
  <div class="stat"><div class="lbl">Clientes registrados</div><div class="val amt">${DB.clients.length}</div></div>
  <div class="stat neg"><div class="lbl">Total cuentas por cobrar</div><div class="val amt">${money(totalCxC, 'USD')}</div></div>
  <div class="stat"><div class="lbl">Con saldo pendiente</div><div class="val amt">${DB.clients.filter(c => clientBalance(c.id) > 0).length}</div></div>
</div>
<div class="searchbar">
  <input id="clientSearch" placeholder="Buscar por nombre o cédula/RIF…" value="${esc(CLIENT_FILTER)}" oninput="filterAndRerender(v=>CLIENT_FILTER=v, this, renderClientes)">
  <button class="btn btn-gold" onclick="openClientForm()">+ Nuevo cliente</button>
</div>
${list.length ? `
<div class="table-wrap"><table><thead><tr><th>Cédula/RIF</th><th>Nombre</th><th>Teléfono</th><th>Saldo</th><th></th></tr></thead>
  <tbody>${list.map(c => {
    const bal = clientBalance(c.id);
    return `<tr><td class="mono">${esc(c.cedula || '—')}</td><td>${esc(c.name)}</td><td>${esc(c.phone || '—')}</td>
    <td class="amt" style="color:${bal > 0 ? 'var(--clay)' : 'var(--teal)'}">${money(bal, 'USD')}</td>
    <td>
      <button class="btn btn-ghost btn-sm" onclick="openClientForm('${c.id}')">Editar</button>
      ${bal > 0 ? `<button class="btn btn-ghost btn-sm" onclick="openAbonoForm('${c.id}')">Registrar abono</button>` : ''}
    </td></tr>`;
  }).join('')}</tbody></table></div>
` : `<div class="empty"><div class="big">☺</div>No hay clientes que coincidan.</div>`}
  `;
}
function openClientForm(id) {
  const c = id ? getClient(id) : { name: '', cedula: '', phone: '', address: '', openingBalance: 0 };
  const mid = openModal(`
<div class="modal-head"><h3>${id ? 'Editar' : 'Nuevo'} cliente</h3><button class="x-close">✕</button></div>
<div class="modal-body">
  <div class="row-fields">
    <div class="field"><label>Cédula / RIF</label><input id="f_ced" value="${esc(c.cedula || '')}"></div>
    <div class="field" style="grid-column:span 2;"><label>Nombre</label><input id="f_cname" value="${esc(c.name)}"></div>
  </div>
  <div class="row-fields">
    <div class="field"><label>Teléfono</label><input id="f_cphone" value="${esc(c.phone || '')}"></div>
    <div class="field"><label>Dirección</label><input id="f_caddr" value="${esc(c.address || '')}"></div>
  </div>
  ${!id ? `<div class="field"><label>Saldo inicial pendiente (USD, opcional)</label><input id="f_cbal" type="number" step="0.01" value="0"></div>` : ''}
</div>
<div class="modal-foot">
  ${id ? `<button class="btn btn-clay" onclick="guardedRun(this,()=>deleteClient('${id}'))">Eliminar</button>` : ''}
  <button class="btn" onclick="closeModal(MID)">Cancelar</button>
  <button class="btn btn-primary" onclick="guardedRun(this,()=>saveClient('${id || ''}'))">Guardar</button>
</div>
  `);
  fixModal(mid);
}
async function saveClient(id) {
  const name = document.getElementById('f_cname').value.trim();
  if (!name) { toast('El nombre es obligatorio', true); return; }
  const data = { name, cedula: document.getElementById('f_ced').value.trim(), phone: document.getElementById('f_cphone').value.trim(), address: document.getElementById('f_caddr').value.trim() };
  if (id) { Object.assign(getClient(id), data); }
  else { data.id = uid('cli'); data.openingBalance = Number(document.getElementById('f_cbal')?.value) || 0; DB.clients.push(data); }
  await save('clients'); closeTopModal(); toast('Cliente guardado ✓'); renderClientes(document.getElementById('content'));
}
async function deleteClient(id) {
  DB.clients = DB.clients.filter(c => c.id !== id);
  await save('clients'); closeTopModal(); toast('Cliente eliminado'); renderClientes(document.getElementById('content'));
}
function openAbonoForm(clientId) {
  const c = getClient(clientId); const bal = clientBalance(clientId);
  const mid = openModal(`
<div class="modal-head"><h3>Registrar abono — ${esc(c.name)}</h3><button class="x-close">✕</button></div>
<div class="modal-body">
  <div class="hint" style="margin-bottom:10px;">Saldo pendiente actual: <b>${money(bal, 'USD')}</b></div>
  <div class="row-fields">
    <div class="field"><label>Monto del abono (USD)</label><input id="f_abmonto" type="number" step="0.01" max="${bal}" value="${bal.toFixed(2)}"></div>
    <div class="field"><label>Método de pago</label><select id="f_abmethod">${DB.config.paymentMethods.filter(m => m !== 'Crédito').map(m => `<option>${esc(m)}</option>`).join('')}</select></div>
  </div>
</div>
<div class="modal-foot"><button class="btn" onclick="closeModal(MID)">Cancelar</button><button class="btn btn-primary" onclick="guardedRun(this,()=>saveAbono('${clientId}'))">Registrar</button></div>
  `);
  fixModal(mid);
}
async function saveAbono(clientId) {
  const amount = Number(document.getElementById('f_abmonto').value) || 0;
  const method = document.getElementById('f_abmethod').value;
  if (amount <= 0) { toast('Ingresa un monto válido', true); return; }

  const balBefore = clientBalance(clientId);
  const receiptNo = DB.receivablePayments.length + 1;
  const payment = { id: uid('abono'), receiptNo, clientId, amount, method, date: todayISO(), ts: Date.now() };
  DB.receivablePayments.push(payment);
  await save('receivablePayments');
  closeTopModal();

  const balAfter = clientBalance(clientId);
  toast(balAfter <= 0.005 ? 'Crédito saldado ✓' : 'Abono registrado ✓');
  showAbonoReceipt(payment, getClient(clientId), balBefore, balAfter);
  renderClientes(document.getElementById('content'));
}

function showAbonoReceipt(payment, client, balBefore, balAfter) {
  const cfg = DB.config;
  const isFinal = balAfter <= 0.005;
  const mid = openModal(`
<div class="modal-head"><h3>${isFinal ? 'Factura de cierre de crédito' : 'Recibo de abono'}</h3><button class="x-close">✕</button></div>
<div class="modal-body">
  <div class="ticket-wrap"><div class="ticket" id="ticketPrint">
    <div class="biz">${esc(cfg.businessName)}</div>
    <div class="biz-sub">${cfg.rif ? ('RIF: ' + esc(cfg.rif) + ' · ') : ''}${esc(cfg.address || '')}</div>
    <hr>
    <div class="line"><span>${isFinal ? 'Factura N°' : 'Recibo N°'}</span><span>${payment.receiptNo}</span></div>
    <div class="line"><span>Fecha</span><span>${fmtDate(payment.date)}</span></div>
    <div class="line"><span>Cliente</span><span>${esc(client.name)}</span></div>
    <hr>
    <div class="line"><span>Saldo anterior</span><span>${money(balBefore, 'USD')}</span></div>
    <div class="line"><span>Abono (${esc(payment.method)})</span><span>${money(payment.amount, 'USD')}</span></div>
    <div class="line tot"><span>Saldo restante</span><span>${money(Math.max(balAfter, 0), 'USD')}</span></div>
    <hr>
    ${isFinal ? '<div class=\"thanks\">✔ CRÉDITO SALDADO EN SU TOTALIDAD<br>Gracias por su pago.</div>' : '<div class=\"thanks\">Gracias por su abono.</div>'}
  </div></div>
</div>
<div class="modal-foot"><button class="btn" onclick="printTicket()">Imprimir</button><button class="btn btn-primary" onclick="closeModal(MID)">Cerrar</button></div>
  `);
  fixModal(mid);
}



// Expose to global scope for inline HTML handlers
window.CLIENT_FILTER = CLIENT_FILTER;
window.deleteClient = deleteClient;
window.openAbonoForm = openAbonoForm;
window.openClientForm = openClientForm;
window.renderClientes = renderClientes;
window.saveAbono = saveAbono;
window.saveClient = saveClient;
window.showAbonoReceipt = showAbonoReceipt;
