/*  discounts.js — Parche descuentos en facturas (POS + CxC)
    Versión: 2026-09-28
    ----------------------------------------------------------------
    Punto de entrada único: applyDiscount(saleId, { amount|percent, note })
    - Usado desde el POS (en finalizeSale, antes de guardar)
    - Usado desde CxC (modal sobre una venta existente)
    ---------------------------------------------------------------- */

/**
 * Calcula el monto de descuento dado un subtotal y los parámetros del usuario.
 * @param {number} subtotal   Total antes del descuento (items + IVA).
 * @param {{ amount?: number, percent?: number }} opts
 * @returns {number} discountUsd redondeado a 2 decimales.
 */
function calcDiscountAmount(subtotal, opts) {
  if (opts.percent != null) {
    return Math.round(subtotal * opts.percent / 100 * 100) / 100;
  }
  return Math.round((opts.amount || 0) * 100) / 100;
}

/**
 * Aplica (o actualiza) un descuento a una venta existente en DB y PocketBase.
 * Válido para ventas contado y crédito.
 *
 * @param {string} saleId  ID de la venta en DB.sales
 * @param {{ amount?: number, percent?: number, note?: string }} opts
 *   amount  → monto fijo en USD
 *   percent → porcentaje (0-100); si se pasa, se convierte a monto antes de guardar
 *   note    → motivo opcional
 * @returns {Promise<{ok: boolean, sale: object|null, error?: string}>}
 */
async function applyDiscount(saleId, opts) {
  const sale = DB.sales.find(s => s.id === saleId);
  if (!sale) return { ok: false, sale: null, error: 'Venta no encontrada' };

  /* ── BACKFILL ──────────────────────────────────────────────────
     Ventas antiguas no tenían discountUsd. Las normalizamos aquí
     sin tocar datos reales:
       subtotalUsd (campo nuevo) = totalUsd original (era el total real)
       discountUsd = 0 (no tenían descuento)
  ────────────────────────────────────────────────────────────── */
  if (sale.discountUsd == null) {
    sale.discountUsd = 0;
    sale.discountNote = '';
    // En ventas viejas subtotalUsd era "suma de items". Lo migramos al total real (Items + IVA)
    sale.subtotalUsd = sale.totalUsd;
  }
  const subtotal = Number(sale.subtotalUsd) || 0;

  /* ── CALCULAR DESCUENTO ───────────────────────────────────────── */
  const discountUsd = calcDiscountAmount(subtotal, opts);

  /* ── VALIDACIONES ──────────────────────────────────────────────── */
  if (discountUsd < 0) return { ok: false, sale, error: 'El descuento no puede ser negativo.' };
  if (discountUsd > subtotal) return { ok: false, sale, error: `El descuento ($${discountUsd.toFixed(2)}) no puede superar el subtotal ($${subtotal.toFixed(2)}).` };

  const newTotal = Math.round((subtotal - discountUsd) * 100) / 100;

  // Para ventas a crédito: el nuevo total nunca puede quedar por debajo de lo ya abonado.
  const abonado = DB.receivablePayments
    .filter(p => p.clientId === sale.clientId && sale.clientId)
    .reduce((a, p) => a + (p.amount || 0), 0);

  // Calculamos los pagos directos de esta venta (no crédito)
  const pagadoEnVenta = (sale.payments || [])
    .filter(p => p.method !== 'Crédito')
    .reduce((a, p) => a + (p.amountUsd || 0), 0);

  if (sale.creditAmount > 0) {
    // La venta tiene porción a crédito: validar que el nuevo total >= lo ya cobrado
    const totalCobrado = pagadoEnVenta + abonado;
    if (newTotal < totalCobrado - 0.005) {
      return {
        ok: false, sale,
        error: `El nuevo total ($${newTotal.toFixed(2)}) quedaría por debajo de lo ya cobrado ($${totalCobrado.toFixed(2)}). Reduce el descuento.`
      };
    }
  }

  /* ── APLICAR ──────────────────────────────────────────────────── */
  sale.subtotalUsd = subtotal;   // asegurar que quede guardado
  sale.discountUsd = discountUsd;
  sale.discountNote = opts.note || '';
  sale.totalUsd = newTotal;
  sale.totalBs = Math.round(newTotal * (sale.exchangeRate || DB.config.exchangeRate) * 100) / 100;

  // Recalcular creditAmount:
  // creditAmount = max(0, totalUsd - pagado en la venta misma)
  const nuevoCreditAmount = Math.max(0, Math.round((newTotal - pagadoEnVenta) * 100) / 100);
  sale.creditAmount = nuevoCreditAmount;

  // Si tras el descuento el saldo global del cliente queda en 0 o negativo,
  // marcar la venta como pagada (creditAmount = 0).
  if (sale.clientId) {
    const nuevoSaldo = clientBalance(sale.clientId); // recalcula con el nuevo creditAmount
    if (nuevoSaldo <= 0.005) {
      sale.creditAmount = 0;
    }
  }

  /* ── PERSISTIR ───────────────────────────────────────────────── */
  try {
    await save('sales');
    return { ok: true, sale };
  } catch (e) {
    return { ok: false, sale, error: 'Error al guardar: ' + (e.message || e) };
  }
}

/**
 * Abre el modal "Aplicar descuento" para una venta existente (CxC).
 * @param {string} saleId
 */
function openDiscountModal(saleId) {
  const sale = DB.sales.find(s => s.id === saleId);
  if (!sale) { toast('Venta no encontrada', true); return; }

  if (sale.discountUsd == null) {
    sale.subtotalUsd = sale.totalUsd;
    sale.discountUsd = 0;
  }
  const subtotal = Number(sale.subtotalUsd) || 0;
  const currentDiscount = Number(sale.discountUsd) || 0;
  const currentTotal = Number(sale.totalUsd) || 0;

  // Saldo pendiente del cliente
  const balanceActual = sale.clientId ? Math.max(clientBalance(sale.clientId), 0) : 0;

  const mid = openModal(`
<div class="modal-head"><h3>Aplicar descuento — Factura #${sale.ticketNo || sale.id.substring(0,6)}</h3><button class="x-close">✕</button></div>
<div class="modal-body">
  <div style="background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:13px;">
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Cliente</span><b>${esc(sale.clientName || '—')}</b></div>
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Subtotal (antes del descuento)</span><span class="amt">${money(subtotal, 'USD')}</span></div>
    ${currentDiscount > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:4px;color:var(--clay);"><span>Descuento aplicado actualmente</span><span class="amt">− ${money(currentDiscount, 'USD')}</span></div>` : ''}
    <div style="display:flex;justify-content:space-between;font-weight:700;border-top:1px solid var(--line-soft);padding-top:6px;margin-top:4px;"><span>Total actual</span><span class="amt">${money(currentTotal, 'USD')}</span></div>
    ${sale.creditAmount > 0 ? `<div style="display:flex;justify-content:space-between;margin-top:4px;color:var(--clay);"><span>Saldo pendiente actual</span><span class="amt">${money(balanceActual, 'USD')}</span></div>` : ''}
  </div>

  <div class="row-fields" style="grid-template-columns:auto 1fr; align-items:end; gap:10px; margin-bottom:14px;">
    <div class="field" style="margin:0;">
      <label>Tipo</label>
      <select id="disc_type" onchange="updateDiscountPreview('${saleId}')">
        <option value="amount">Monto fijo ($)</option>
        <option value="percent">Porcentaje (%)</option>
      </select>
    </div>
    <div class="field" style="margin:0;">
      <label id="disc_val_label">Descuento (USD)</label>
      <input id="disc_val" type="number" step="0.01" min="0" value="${currentDiscount.toFixed(2)}"
        oninput="updateDiscountPreview('${saleId}')"
        style="font-size:16px;font-weight:600;font-family:var(--mono);">
    </div>
  </div>

  <div class="field">
    <label>Motivo (opcional)</label>
    <input id="disc_note" type="text" placeholder="Ej. cliente especial, pronto pago…" value="${esc(sale.discountNote || '')}">
  </div>

  <div id="disc_preview" style="margin-top:14px;padding:12px 14px;border-radius:8px;background:var(--teal-tint);border:1px solid var(--teal);font-size:13px;display:none;">
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Subtotal</span><span id="dp_subtotal" class="amt"></span></div>
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;color:var(--clay);"><span>− Descuento</span><span id="dp_discount" class="amt"></span></div>
    <div style="display:flex;justify-content:space-between;font-weight:700;border-top:1px solid rgba(47,111,98,.2);padding-top:6px;margin-top:4px;"><span>Nuevo total</span><span id="dp_total" class="amt"></span></div>
    ${sale.creditAmount > 0 ? `<div style="display:flex;justify-content:space-between;margin-top:4px;color:var(--clay);font-weight:600;"><span>Nuevo saldo pendiente</span><span id="dp_balance" class="amt"></span></div>` : ''}
    <div id="dp_warn" style="color:var(--clay);margin-top:6px;font-size:12px;display:none;"></div>
  </div>
</div>
<div class="modal-foot">
  <button class="btn" onclick="closeModal(MID)">Cancelar</button>
  <button class="btn btn-primary" id="disc_confirm_btn" onclick="guardedRun(this, () => confirmDiscount('${saleId}'))">Confirmar descuento</button>
</div>
  `);
  fixModal(mid);

  // Inicializar preview
  updateDiscountPreview(saleId);
}

/** Actualiza la vista previa del descuento en tiempo real */
function updateDiscountPreview(saleId) {
  const typeEl = document.getElementById('disc_type');
  const valEl = document.getElementById('disc_val');
  const labelEl = document.getElementById('disc_val_label');
  const previewEl = document.getElementById('disc_preview');
  const warnEl = document.getElementById('dp_warn');
  const confirmBtn = document.getElementById('disc_confirm_btn');
  if (!typeEl || !valEl) return;

  const type = typeEl.value;
  labelEl.textContent = type === 'percent' ? 'Descuento (%)' : 'Descuento (USD)';

  const rawVal = parseFloat(valEl.value) || 0;
  if (rawVal <= 0) { previewEl.style.display = 'none'; confirmBtn.disabled = false; return; }

  const sale = DB.sales.find(s => s.id === saleId);
  if (!sale) return;

  if (sale.discountUsd == null) {
    sale.subtotalUsd = sale.totalUsd;
    sale.discountUsd = 0;
  }
  const subtotal = Number(sale.subtotalUsd) || 0;
  const discountUsd = calcDiscountAmount(subtotal, type === 'percent' ? { percent: rawVal } : { amount: rawVal });
  const newTotal = Math.max(0, subtotal - discountUsd);

  // Saldo nuevo
  const pagadoEnVenta = (sale.payments || [])
    .filter(p => p.method !== 'Crédito')
    .reduce((a, p) => a + (p.amountUsd || 0), 0);
  const abonado = DB.receivablePayments
    .filter(p => p.clientId === sale.clientId && sale.clientId)
    .reduce((a, p) => a + (p.amount || 0), 0);
  const newBalance = Math.max(0, newTotal - pagadoEnVenta - abonado);

  document.getElementById('dp_subtotal').textContent = money(subtotal, 'USD');
  document.getElementById('dp_discount').textContent = money(discountUsd, 'USD');
  document.getElementById('dp_total').textContent = money(newTotal, 'USD');
  const dpBal = document.getElementById('dp_balance');
  if (dpBal) dpBal.textContent = money(newBalance, 'USD');

  // Advertencia si descuento > subtotal
  let warn = '';
  if (discountUsd > subtotal) {
    warn = `⚠ El descuento supera el subtotal ($ ${subtotal.toFixed(2)}).`;
  } else {
    const totalCobrado = pagadoEnVenta + abonado;
    if (sale.creditAmount > 0 && newTotal < totalCobrado - 0.005) {
      warn = `⚠ El nuevo total quedaría por debajo de lo ya cobrado ($ ${totalCobrado.toFixed(2)}).`;
    }
  }
  warnEl.textContent = warn;
  warnEl.style.display = warn ? '' : 'none';
  confirmBtn.disabled = !!warn;
  previewEl.style.display = '';
}

/** Ejecuta el descuento al confirmar desde el modal CxC */
async function confirmDiscount(saleId) {
  const typeEl = document.getElementById('disc_type');
  const valEl = document.getElementById('disc_val');
  const noteEl = document.getElementById('disc_note');
  if (!typeEl || !valEl) return;

  const type = typeEl.value;
  const rawVal = parseFloat(valEl.value) || 0;
  const note = noteEl ? noteEl.value.trim() : '';

  const opts = type === 'percent' ? { percent: rawVal, note } : { amount: rawVal, note };
  const result = await applyDiscount(saleId, opts);

  if (!result.ok) {
    toast(result.error || 'Error aplicando descuento', true);
    return;
  }

  closeTopModal();
  toast('Descuento aplicado ✓');
  render();
}

// ── Exponer al scope global ──────────────────────────────────────────────────
window.applyDiscount = applyDiscount;
window.calcDiscountAmount = calcDiscountAmount;
window.confirmDiscount = confirmDiscount;
window.openDiscountModal = openDiscountModal;
window.updateDiscountPreview = updateDiscountPreview;
