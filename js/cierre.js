let CIERRE_DATE = null;

function calcularCierre(iso) {
  const methods = DB.config.paymentMethods.filter(m => m !== 'Crédito');
  const existing = DB.cashClosings.find(c => c.date === iso);
  // Sort descending to get the most recent closure before this date
  const prevClosing = [...DB.cashClosings]
    .filter(c => c.date < iso)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];

  const salesToday = salesOnDate(iso);
  const expensesToday = expensesOnDate(iso);
  
  const ingresosPorMetodo = {}; methods.forEach(m => ingresosPorMetodo[m] = 0);
  salesToday.forEach(s => s.payments.forEach(p => { 
    if (ingresosPorMetodo[p.method] != null) ingresosPorMetodo[p.method] += p.amountUsd; 
  }));
  
  const paymentsToday = DB.receivablePayments.filter(p => p.date === iso);
  paymentsToday.forEach(p => { 
    if (ingresosPorMetodo[p.method] != null) ingresosPorMetodo[p.method] += p.amount; 
  });

  const egresosPorMetodo = {}; methods.forEach(m => egresosPorMetodo[m] = 0);
  expensesToday.forEach(e => { 
    if (egresosPorMetodo[e.method] != null) egresosPorMetodo[e.method] += e.amountUsd; 
  });

  const cogs = salesToday.reduce((a, s) => a + s.items.reduce((x, it) => x + (it.cost || 0) * it.qty, 0), 0);
  const totalVentasUsd = salesToday.reduce((a, s) => a + s.totalUsd, 0);
  const totalEgresosUsd = expensesToday.reduce((a, e) => a + e.amountUsd, 0);
  
  const opening = {};
  const teorico = {};
  
  methods.forEach(m => {
    opening[m] = existing ? (existing.opening[m] || 0) : (prevClosing ? (prevClosing.real[m] || 0) : 0);
    teorico[m] = opening[m] + ingresosPorMetodo[m] - egresosPorMetodo[m];
  });

  return { ingresosPorMetodo, egresosPorMetodo, opening, teorico, cogs, totalVentasUsd, totalEgresosUsd, existing, methods };
}

function renderCierre(el) {
  const iso = CIERRE_DATE || todayISO();
  const { ingresosPorMetodo, egresosPorMetodo, opening, teorico, cogs, totalVentasUsd, totalEgresosUsd, existing, methods } = calcularCierre(iso);
  
  const utilidadBruta = totalVentasUsd - cogs;
  const utilidadNeta = utilidadBruta - totalEgresosUsd;

  el.innerHTML = `
<div class="searchbar">
  <label style="font-weight:600;font-size:13px;">Fecha:</label>
  <input type="date" value="${iso}" onchange="CIERRE_DATE=this.value; render()">
  <button class="btn" style="margin-left: 8px;" onclick="CIERRE_DATE=null; render()">Hoy</button>
  ${existing ? `<span class="tag tag-teal" style="margin-left: 8px;">Ya cerrada</span>` : ''}
  ${existing && existing.auto ? `<span class="tag" style="margin-left: 8px; background: var(--clay); color: #fff;">Cierre automático</span>` : ''}
</div>

<div class="grid grid-3" style="margin-bottom:18px;">
  <div class="stat pos"><div class="lbl">Utilidad bruta</div><div class="val amt">${money(utilidadBruta, 'USD')}</div></div>
  <div class="stat ${utilidadNeta < 0 ? 'neg' : 'pos'}"><div class="lbl">Utilidad neta</div><div class="val amt">${money(utilidadNeta, 'USD')}</div></div>
  <div class="stat"><div class="lbl">Egresos del día</div><div class="val amt">${money(totalEgresosUsd, 'USD')}</div></div>
</div>

<div class="table-wrap"><table><thead><tr><th>Método</th><th>Apertura</th><th>Ingresos</th><th>Egresos</th><th>Cierre teórico</th><th>Conteo real</th><th>Diferencia</th></tr></thead>
  <tbody>${methods.map(m => {
    const real = existing ? (existing.real[m] || 0) : teorico[m];
    const diff = real - teorico[m];
    return `<tr data-teorico="${teorico[m]}">
      <td>${esc(m)}</td>
      <td class="amt">${money(opening[m], 'USD')}</td>
      <td class="amt" style="color:var(--teal)">${money(ingresosPorMetodo[m], 'USD')}</td>
      <td class="amt" style="color:var(--clay)">${money(egresosPorMetodo[m], 'USD')}</td>
      <td class="amt">${money(teorico[m], 'USD')}</td>
      <td><input type="number" step="0.01" value="${real.toFixed(2)}" data-method="${esc(m)}" class="cierre-real" style="width:100px;padding:5px 7px;border:1px solid var(--line);border-radius:6px" ${existing ? 'disabled' : ''} oninput="updateCierrePreview(this)"></td>
      <td class="amt diff-cell" style="color:${diff < 0 ? 'var(--clay)' : diff > 0 ? 'var(--teal)' : 'var(--ink-soft)'}">${money(diff, 'USD')}</td>
    </tr>`;
  }).join('')}</tbody></table></div>

${!existing ? `<button class="btn btn-primary" style="margin-top:14px;" onclick="guardedRun(this,()=>finalizeCierre('${iso}'))">Cerrar caja del día</button>`
      : `<div class="hint" style="margin-top:10px;">Diferencia total del cierre: <b>${money(existing.diffUsd, 'USD')}</b></div>`}
  `;
}

function updateCierrePreview(input) {
  const row = input.closest('tr');
  const teorico = Number(row.dataset.teorico) || 0;
  const real = Number(input.value) || 0;
  const diff = real - teorico;
  const cell = row.querySelector('.diff-cell');
  cell.textContent = money(diff, 'USD');
  cell.style.color = diff < 0 ? 'var(--clay)' : diff > 0 ? 'var(--teal)' : 'var(--ink-soft)';
}

async function finalizeCierre(iso) {
  const { opening, teorico, methods } = calcularCierre(iso);
  const real = {}; let diffUsd = 0;
  methods.forEach(m => {
    const input = document.querySelector(`.cierre-real[data-method="${m.replace(/"/g, '')}"]`);
    real[m] = input ? Number(input.value) || 0 : teorico[m];
    diffUsd += (real[m] - teorico[m]);
  });
  DB.cashClosings.push({ id: uid('cierre'), date: iso, ts: Date.now(), opening, real, diffUsd });
  await save('cashClosings');
  toast('Caja cerrada ✓');
  render();
}

// Expose to global scope for inline HTML handlers
window.calcularCierre = calcularCierre;
window.finalizeCierre = finalizeCierre;
window.renderCierre = renderCierre;
window.updateCierrePreview = updateCierrePreview;
