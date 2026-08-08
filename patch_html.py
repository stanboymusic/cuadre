import io

file_path = 'index.html'

with io.open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = """async function saveAbono(clientId){
  const amount = Number(document.getElementById('f_abmonto').value)||0;
  const method = document.getElementById('f_abmethod').value;
  if(amount<=0){ toast('Ingresa un monto válido', true); return; }
  DB.receivablePayments.push({id:uid('abono'), clientId, amount, method, date:todayISO(), ts:Date.now()});
  await save('receivablePayments');
  closeTopModal(); toast('Abono registrado ✓'); renderClientes(document.getElementById('content'));
}"""

replacement = """async function saveAbono(clientId){
  const amount = Number(document.getElementById('f_abmonto').value)||0;
  const method = document.getElementById('f_abmethod').value;
  if(amount<=0){ toast('Ingresa un monto válido', true); return; }

  const balBefore = clientBalance(clientId);
  const receiptNo = DB.receivablePayments.length + 1;
  const payment = {id:uid('abono'), receiptNo, clientId, amount, method, date:todayISO(), ts:Date.now()};
  DB.receivablePayments.push(payment);
  await save('receivablePayments');
  closeTopModal();

  const balAfter = clientBalance(clientId);
  toast(balAfter<=0.005 ? 'Crédito saldado ✓' : 'Abono registrado ✓');
  showAbonoReceipt(payment, getClient(clientId), balBefore, balAfter);
  renderClientes(document.getElementById('content'));
}

function showAbonoReceipt(payment, client, balBefore, balAfter){
  const cfg = DB.config;
  const isFinal = balAfter <= 0.005;
  const mid = openModal(`
    <div class="modal-head"><h3>${isFinal?'Factura de cierre de crédito':'Recibo de abono'}</h3><button class="x-close">✕</button></div>
    <div class="modal-body">
      <div class="ticket-wrap"><div class="ticket" id="ticketPrint">
        <div class="biz">${esc(cfg.businessName)}</div>
        <div class="biz-sub">${cfg.rif?('RIF: '+esc(cfg.rif)+' · '):''}${esc(cfg.address||'')}</div>
        <hr>
        <div class="line"><span>${isFinal?'Factura N°':'Recibo N°'}</span><span>${payment.receiptNo}</span></div>
        <div class="line"><span>Fecha</span><span>${fmtDate(payment.date)}</span></div>
        <div class="line"><span>Cliente</span><span>${esc(client.name)}</span></div>
        <hr>
        <div class="line"><span>Saldo anterior</span><span>${money(balBefore,'USD')}</span></div>
        <div class="line"><span>Abono (${esc(payment.method)})</span><span>${money(payment.amount,'USD')}</span></div>
        <div class="line tot"><span>Saldo restante</span><span>${money(Math.max(balAfter,0),'USD')}</span></div>
        <hr>
        ${isFinal ? \`<div class="thanks">✔ CRÉDITO SALDADO EN SU TOTALIDAD<br>Gracias por su pago.</div>\` : \`<div class="thanks">Gracias por su abono.</div>\`}
      </div></div>
    </div>
    <div class="modal-foot"><button class="btn" onclick="printTicket()">Imprimir</button><button class="btn btn-primary" onclick="closeModal(MID)">Cerrar</button></div>
  `);
  fixModal(mid);
}"""

if target in content:
    content = content.replace(target, replacement)
    with io.open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Reemplazo exitoso.")
else:
    print("No se encontró el texto objetivo.")
