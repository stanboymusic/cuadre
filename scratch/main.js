
    const LOGO_ICON = "/logo.png";

    /* ============================================================
       DATA LAYER
       ============================================================ */
    const STORE_KEYS = ['config', 'products', 'services', 'clients', 'suppliers', 'sales', 'purchases', 'expenses', 'cashClosings', 'receivablePayments', 'inventoryAdjustments'];
    let DB = {
      config: null, products: [], services: [], clients: [], suppliers: [],
      sales: [], purchases: [], expenses: [], cashClosings: [], receivablePayments: [], inventoryAdjustments: []
    };

    function uid(prefix) { return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }
    function todayISO() { return new Date().toISOString().slice(0, 10); }
    function fmtDate(iso) { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
    function money(n, cur) {
      n = Number(n) || 0;
      const s = n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (cur === 'USD') return '$ ' + s;
      if (cur === 'COP') return 'COP$ ' + s;
      return 'Bs. ' + s;
    }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    const pb = new PocketBase('https://fragrant-sandbar-3808.fly.dev');


    // Campos que se guardan como texto JSON en PocketBase
    const JSON_TEXT_FIELDS = {
      config: ['paymentMethods', 'expenseTypes', 'vendors'],
      sales: ['items', 'payments'],
      purchases: ['items'],
      cashClosings: ['opening', 'real']
    };

    function parseRecord(key, record) {
      if (!record) return record;
      const fields = JSON_TEXT_FIELDS[key] || [];
      const out = { ...record };
      for (const f of fields) {
        if (typeof out[f] === 'string') {
          try { out[f] = JSON.parse(out[f]); } catch (e) { out[f] = []; }
        }
        if (out[f] == null) out[f] = Array.isArray(out[f]) ? [] : out[f];
      }
      return out;
    }

    function serializeRecord(key, record) {
      const fields = JSON_TEXT_FIELDS[key] || [];
      const out = { ...record };
      for (const f of fields) {
        if (out[f] !== undefined && typeof out[f] !== 'string') {
          out[f] = JSON.stringify(out[f]);
        }
      }
      return out;
    }

    async function loadDB() {
      const results = await Promise.all(STORE_KEYS.map(async k => {
        try {
          if (k === 'config') {
            const records = await pb.collection(k).getFullList();
            if (records.length === 0) return [k, null];
            const parsed = parseRecord(k, records[0]);
            parsed.exchangeRateCop = parsed.cop || 0;
            return [k, parsed];
          }
          const records = await pb.collection(k).getFullList();
          return [k, records.length > 0 ? records.map(r => parseRecord(k, r)) : []];
        }
        catch (e) { console.error(e); return [k, null]; }
      }));
      results.forEach(([k, v]) => { if (v != null) DB[k] = v; });
      if (!DB.config) DB.config = defaultConfig();
    }

    async function save(key) {
      try {
        if (key === 'config') {
          const existing = await pb.collection(key).getFullList();
          const data = serializeRecord(key, DB.config);
          data.cop = DB.config.exchangeRateCop || 0;
          delete data.exchangeRateCop;
          if (existing.length > 0) {
            await pb.collection(key).update(existing[0].id, data);
          } else {
            await pb.collection(key).create(data);
          }
          return;
        }

        const pbRecords = await pb.collection(key).getFullList();
        const pbMap = new Map(pbRecords.map(r => [r.id, r]));

        const ops = [];
        for (const item of DB[key]) {
          const data = serializeRecord(key, item);
          if (pbMap.has(item.id)) {
            ops.push(pb.collection(key).update(item.id, data));
            pbMap.delete(item.id);
          } else {
            const d = { ...data };
            delete d.id;
            ops.push(pb.collection(key).create(d).then(created => { item.id = created.id; }));
          }
        }

        for (const [id] of pbMap) {
          ops.push(pb.collection(key).delete(id));
        }

        await Promise.all(ops);

      } catch (e) { console.error(e); toast('Error guardando datos', true); }
    }

    /* Evita doble envío: deshabilita el botón mientras la acción está en curso
       y lo reactiva siempre al terminar (éxito o error). */
    async function guardedRun(btn, fn) {
      if (!btn || btn.disabled) return;
      btn.disabled = true;
      try { await fn(); }
      finally { if (btn) btn.disabled = false; }
    }

    /* Los buscadores re-renderizan toda la vista en cada letra (innerHTML),
       lo que destruye y recrea el <input>, perdiendo el foco. Esto restaura
       el foco y la posición del cursor después de re-renderizar. */
    function filterAndRerender(setFilter, inputEl, renderFn) {
      setFilter(inputEl.value);
      const pos = inputEl.selectionStart;
      const id = inputEl.id;
      renderFn(document.getElementById('content'));
      const newInput = document.getElementById(id);
      if (newInput) {
        newInput.focus();
        try { newInput.setSelectionRange(pos, pos); } catch (e) { }
      }
    }

    /* Búsqueda más flexible: ignora may/min y acentos, y exige que TODAS
       las palabras escritas aparezcan en alguno de los campos (en cualquier orden). */
    function norm(s) {
      return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    }
    function smartMatch(query, ...fields) {
      const words = norm(query).split(/\s+/).filter(Boolean);
      if (!words.length) return true;
      const haystack = fields.map(norm).join(' ');
      return words.every(w => haystack.includes(w));
    }
    function defaultConfig() {
      return {
        businessName: 'Mi Negocio', rif: '', address: '', phone: '',
        exchangeRate: 40, exchangeRateCop: 0, iva: 16, initialInvestment: 0,
        paymentMethods: ['Efectivo Bs.', 'Pago Móvil', 'Punto de Venta', 'Biopago', 'Zelle ($)', 'Binance ($)', 'PayPal ($)', 'Efectivo ($)', 'Crédito'],
        expenseTypes: ['Sueldos', 'Alquiler', 'Agua', 'Electricidad', 'Gas', 'Publicidad', 'Delivery', 'Otros egresos'],
        vendors: ['Vendedor 1']
      };
    }
    function toast(msg, isError) {
      const t = document.getElementById('toast');
      t.textContent = msg; t.style.background = isError ? 'var(--clay)' : 'var(--ink)';
      t.classList.add('show');
      clearTimeout(window._toastT);
      window._toastT = setTimeout(() => t.classList.remove('show'), 2400);
    }

    /* ============================================================
       PRICING CALC
       ============================================================ */
    function calcPriceFromCost(cost, method, value) {
      cost = Number(cost) || 0; value = Number(value) || 0;
      if (method === 'markup') return cost * (1 + value / 100);           // % utilidad respecto al costo
      if (method === 'margin') return value >= 100 ? cost : cost / (1 - value / 100); // margen de contribución / utilidad bruta
      return cost;
    }

    /* ============================================================
       DERIVED HELPERS
       ============================================================ */
    function getProduct(id) { return DB.products.find(p => p.id === id); }
    function getService(id) { return DB.services.find(s => s.id === id); }
    function getClient(id) { return DB.clients.find(c => c.id === id); }
    function getSupplier(id) { return DB.suppliers.find(s => s.id === id); }
    function clientBalance(clientId) {
      const c = getClient(clientId); if (!c) return 0;
      let bal = c.openingBalance || 0;
      DB.sales.forEach(s => { if (s.clientId === clientId) bal += (s.creditAmount || 0); });
      DB.receivablePayments.forEach(p => { if (p.clientId === clientId) bal -= p.amount; });
      DB.clients.filter(() => false); // noop
      return bal;
    }
    function salesOnDate(iso) { return DB.sales.filter(s => s.date === iso); }
    function expensesOnDate(iso) { return DB.expenses.filter(e => e.date === iso); }

    /* ============================================================
       ROUTER / STATE
       ============================================================ */
    let VIEW = 'dashboard';
    let modalStack = [];

    const NAV = [
      {
        group: 'Operación', items: [
          { id: 'dashboard', label: 'Resumen', ic: '◆' },
          { id: 'ventas', label: 'Ventas', ic: '✦' },
          { id: 'cierre', label: 'Cierre de caja', ic: '▤' },
        ]
      },
      {
        group: 'Inventario', items: [
          { id: 'productos', label: 'Productos', ic: '▣' },
          { id: 'servicios', label: 'Servicios', ic: '✎' },
          { id: 'compras', label: 'Compras', ic: '⇩' },
          { id: 'ajustes', label: 'Ajustes de inventario', ic: '±' },
        ]
      },
      {
        group: 'Terceros', items: [
          { id: 'clientes', label: 'Clientes', ic: '☺' },
          { id: 'proveedores', label: 'Proveedores', ic: '⌂' },
          { id: 'egresos', label: 'Egresos', ic: '⇧' },
        ]
      },
      {
        group: 'Análisis', items: [
          { id: 'reportes', label: 'Reportes', ic: '▦' },
          { id: 'historial', label: 'Historial', ic: '☰' },
          { id: 'patrimonio', label: 'Patrimonio', ic: '♦' },
        ]
      },
      {
        group: 'Sistema', items: [
          { id: 'config', label: 'Configuración', ic: '⚙' },
        ]
      },
    ];
    const LABELS = Object.fromEntries(NAV.flatMap(g => g.items).map(i => [i.id, i.label]));

    function navigate(view) { VIEW = view; render(); window.scrollTo(0, 0); }

    function toggleSidebar(force) {
      const sb = document.querySelector('.sidebar');
      const bd = document.querySelector('.sidebar-backdrop');
      const open = typeof force === 'boolean' ? force : !sb.classList.contains('open');
      sb.classList.toggle('open', open);
      bd.classList.toggle('open', open);
    }

    /* ============================================================
       RENDER SHELL
       ============================================================ */
    function render() {
      const app = document.getElementById('app');
      app.innerHTML = `
    <div class="sidebar-backdrop no-print" onclick="toggleSidebar(false)"></div>
    <div class="sidebar no-print">
      <div class="sidebar-brand">
        <img src="${LOGO_ICON}" alt="Mantente" class="brand-icon">
        <div class="mark">MANTENTE</div>
        <div class="sub">Decisiones claras, negocios rentables</div>
      </div>
      ${NAV.map(g => `
        <div class="nav-group">
          <div class="nav-group-label">${g.group}</div>
          ${g.items.map(i => `
            <div class="nav-item ${VIEW === i.id ? 'active' : ''}" onclick="navigate('${i.id}')">
              <span class="ic">${i.ic}</span><span>${i.label}</span>
            </div>`).join('')}
        </div>`).join('')}
      <div class="sidebar-foot">${esc(DB.config.businessName)}<br>${todayFmt()}</div>
    </div>
    <div class="main">
      <div class="topbar no-print">
        <h1><button class="menu-btn" onclick="toggleSidebar()" aria-label="Menú">☰</button>${LABELS[VIEW] || ''}</h1>
        <div class="rate-pill">◆ Tasa del día: <span class="mono">${DB.config.exchangeRate}</span> Bs./$${DB.config.exchangeRateCop ? ` · <span class="mono">${DB.config.exchangeRateCop}</span> COP/$` : ''}</div>
      </div>
      <div class="content" id="content"></div>
    </div>
  `;
      const c = document.getElementById('content');
      const renderers = {
        dashboard: renderDashboard, ventas: renderVentas, cierre: renderCierre,
        productos: renderProductos, servicios: renderServicios, compras: renderCompras,
        ajustes: renderAjustes, clientes: renderClientes, proveedores: renderProveedores,
        egresos: renderEgresos, reportes: renderReportes, historial: renderHistorial, config: renderConfig,
        patrimonio: renderPatrimonio
      };
      (renderers[VIEW] || renderDashboard)(c);
    }
    function todayFmt() { const d = new Date(); return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }); }

    /* ============================================================
       MODAL HELPERS
       ============================================================ */
    function openModal(html, wide) {
      const wrap = document.createElement('div');
      wrap.className = 'overlay'; wrap.id = 'ov_' + Math.random().toString(36).slice(2, 8);
      wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}">${html}</div>`;
      wrap.addEventListener('click', e => { if (e.target === wrap) closeModal(wrap.id); });
      document.body.appendChild(wrap);
      modalStack.push(wrap.id);
      return wrap.id;
    }
    function closeModal(id) {
      const el = document.getElementById(id);
      if (el) el.remove();
      modalStack = modalStack.filter(x => x !== id);
    }
    function closeTopModal() { if (modalStack.length) closeModal(modalStack[modalStack.length - 1]); }

    /* ============================================================
       DASHBOARD
       ============================================================ */
    function renderDashboard(el) {
      const today = todayISO();
      const tSales = salesOnDate(today);
      const tExpenses = expensesOnDate(today);
      const totalVentasBs = tSales.reduce((a, s) => a + s.totalBs, 0);
      const totalVentasUsd = tSales.reduce((a, s) => a + s.totalUsd, 0);
      const cogs = tSales.reduce((a, s) => a + s.items.reduce((x, it) => x + (it.cost || 0) * it.qty, 0), 0);
      const totalEgresosUsd = tExpenses.reduce((a, e) => a + (e.amountUsd || 0), 0);
      const utilidadBruta = totalVentasUsd - cogs;
      const utilidadNeta = utilidadBruta - totalEgresosUsd;
      const lowStock = DB.products.filter(p => (p.stock || 0) <= (p.minStock || 0));
      const receivables = DB.clients.reduce((a, c) => a + Math.max(clientBalance(c.id), 0), 0);

      el.innerHTML = `
    <div class="grid grid-4">
      <div class="stat"><div class="lbl">Ventas de hoy</div><div class="val amt">${money(totalVentasBs, 'Bs')}</div><div class="sub">${money(totalVentasUsd, 'USD')} · ${tSales.length} venta(s)</div></div>
      <div class="stat pos"><div class="lbl">Utilidad bruta hoy</div><div class="val amt">${money(utilidadBruta, 'USD')}</div><div class="sub">Ventas − costo de mercancía</div></div>
      <div class="stat ${utilidadNeta < 0 ? 'neg' : 'pos'}"><div class="lbl">Utilidad neta hoy</div><div class="val amt">${money(utilidadNeta, 'USD')}</div><div class="sub">− ${money(totalEgresosUsd, 'USD')} en egresos</div></div>
      <div class="stat"><div class="lbl">Cuentas por cobrar</div><div class="val amt">${money(receivables, 'USD')}</div><div class="sub">${DB.clients.filter(c => clientBalance(c.id) > 0).length} cliente(s) con saldo</div></div>
    </div>

    <div class="section-title"><h2>Accesos rápidos</h2></div>
    <div class="grid grid-4">
      <div class="card card-pad" style="cursor:pointer" onclick="navigate('ventas')"><b>✦ Registrar venta</b><div class="hint" style="margin-top:6px;color:var(--ink-soft)">Nueva venta de productos o servicios</div></div>
      <div class="card card-pad" style="cursor:pointer" onclick="navigate('compras')"><b>⇩ Registrar compra</b><div class="hint" style="margin-top:6px;color:var(--ink-soft)">Entrada de mercancía y proveedores</div></div>
      <div class="card card-pad" style="cursor:pointer" onclick="navigate('egresos')"><b>⇧ Registrar egreso</b><div class="hint" style="margin-top:6px;color:var(--ink-soft)">Sueldos, alquiler, servicios…</div></div>
      <div class="card card-pad" style="cursor:pointer" onclick="navigate('cierre')"><b>▤ Cierre de caja</b><div class="hint" style="margin-top:6px;color:var(--ink-soft)">Cuadrar el efectivo del día</div></div>
    </div>

    <div class="section-title"><h2>Inventario bajo mínimo</h2></div>
    ${lowStock.length ? `
      <div class="table-wrap"><table><thead><tr><th>Producto</th><th>Existencia</th><th>Mínimo</th></tr></thead>
      <tbody>${lowStock.map(p => `<tr><td>${esc(p.name)}</td><td class="amt">${p.stock || 0}</td><td class="amt">${p.minStock || 0}</td></tr>`).join('')}</tbody></table></div>
    ` : `<div class="card card-pad" style="color:var(--ink-soft)">Todo el inventario está por encima del mínimo configurado.</div>`}

    <div class="section-title"><h2>Últimos movimientos</h2></div>
    ${renderMiniHistorial()}
  `;
    }
    function renderMiniHistorial() {
      const rows = unifiedHistory().slice(0, 8);
      if (!rows.length) return `<div class="empty"><div class="big">🗒️</div>Todavía no hay movimientos registrados.</div>`;
      return `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th style="text-align:right">Monto</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${fmtDate(r.date)}</td><td>${histTag(r.type)}</td><td>${esc(r.detail)}</td><td class="amt" style="text-align:right">${r.amountLabel}</td></tr>`).join('')}</tbody></table></div>`;
    }
    function histTag(type) {
      const map = { venta: ['Venta', 'tag-teal'], compra: ['Compra', 'tag-gold'], egreso: ['Egreso', 'tag-clay'], ajuste: ['Ajuste', 'tag-muted'], cierre: ['Cierre', 'tag-muted'], abono: ['Abono', 'tag-teal'] };
      const [label, cls] = map[type] || [type, 'tag-muted'];
      return `<span class="tag ${cls}">${label}</span>`;
    }
    function unifiedHistory() {
      const rows = [];
      DB.sales.forEach(s => rows.push({ date: s.date, ts: s.ts, type: 'venta', detail: `Venta #${s.ticketNo} — ${s.clientName || 'Cliente ocasional'}`, amountLabel: money(s.totalBs, 'Bs') }));
      DB.purchases.forEach(p => rows.push({ date: p.date, ts: p.ts, type: 'compra', detail: `Compra #${p.purchaseNo} — ${getSupplier(p.supplierId)?.name || 'Proveedor'}`, amountLabel: money(p.totalUsd, 'USD') }));
      DB.expenses.forEach(e => rows.push({ date: e.date, ts: e.ts, type: 'egreso', detail: `${e.type}${e.note ? ' — ' + e.note : ''}`, amountLabel: money(e.amountUsd, 'USD') }));
      DB.inventoryAdjustments.forEach(a => rows.push({ date: a.date, ts: a.ts, type: 'ajuste', detail: `${getProduct(a.productId)?.name || 'Producto'} · ${a.qty > 0 ? '+' : ''}${a.qty} (${a.reason})`, amountLabel: '' }));
      DB.cashClosings.forEach(c => rows.push({ date: c.date, ts: c.ts, type: 'cierre', detail: `Cierre de caja del ${fmtDate(c.date)}`, amountLabel: money(c.diffUsd || 0, 'USD') }));
      DB.receivablePayments.forEach(p => rows.push({ date: p.date, ts: p.ts, type: 'abono', detail: `Abono de ${getClient(p.clientId)?.name || 'cliente'}`, amountLabel: money(p.amount, 'USD') }));
      return rows.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    }

    /* ============================================================
       VENTAS (POS)
       ============================================================ */
    let CART = { items: [], clientId: '', vendor: (DB.config && DB.config.vendors && DB.config.vendors[0]) || '', payments: [], lastTicket: null, priceTier: 'price', showBs: false, showCop: false };

    function renderVentas(el) {
      if (!CART.vendor) CART.vendor = DB.config.vendors[0] || '';
      const subtotalUsd = CART.items.reduce((a, it) => a + it.priceUsd * it.qty, 0);
      const ivaPct = DB.config.iva || 0;
      const ivaUsd = subtotalUsd * ivaPct / 100;
      const totalUsd = subtotalUsd + ivaUsd;
      const totalBs = totalUsd * DB.config.exchangeRate;
      const paidUsd = CART.payments.reduce((a, p) => a + Number(p.amountUsd || 0), 0);
      const balanceUsd = totalUsd - paidUsd;

      el.innerHTML = `
    <div class="grid" style="grid-template-columns:1.5fr 1fr; align-items:start;">
      <div>
        <div class="card card-pad">
          <div class="searchbar">
            <select id="itemPicker" style="flex:1">
              <option value="">— Selecciona un producto o servicio —</option>
              <optgroup label="Productos">
                ${DB.products.map(p => `<option value="p:${p.id}" ${((p.stock || 0) <= 0) ? 'disabled' : ''}>${esc(p.name)} · ${money(p[CART.priceTier] || p.price, 'USD')} · stock ${p.stock || 0}</option>`).join('')}
              </optgroup>
              <optgroup label="Servicios">
                ${DB.services.map(s => `<option value="s:${s.id}">${esc(s.name)} · ${money(s.price, 'USD')}</option>`).join('')}
              </optgroup>
            </select>
            <select id="tierSel" onchange="CART.priceTier=this.value; render()" style="max-width:180px" title="Nivel de precio a aplicar a los productos que agregues">
              <option value="price" ${CART.priceTier === 'price' ? 'selected' : ''}>Precio regular</option>
              <option value="price2" ${CART.priceTier === 'price2' ? 'selected' : ''}>Precio 2</option>
              <option value="price3" ${CART.priceTier === 'price3' ? 'selected' : ''}>Precio 3</option>
            </select>
            <button class="btn btn-gold" onclick="cartAddFromPicker()">+ Agregar</button>
          </div>
          ${CART.items.length ? `
            <div class="table-wrap" style="max-height:340px">
              <table><thead><tr><th>Ítem</th><th>Cant.</th><th>Precio</th><th>Total</th><th></th></tr></thead>
              <tbody>${CART.items.map((it, idx) => `
                <tr>
                  <td>${esc(it.name)} ${it.kind === 's' ? '<span class="tag tag-gold">Servicio</span>' : ''}</td>
                  <td><input type="number" min="1" value="${it.qty}" style="width:60px;padding:4px 6px;border:1px solid var(--line);border-radius:6px" onchange="cartSetQty(${idx}, this.value)"></td>
                  <td class="amt">${money(it.priceUsd, 'USD')}</td>
                  <td class="amt">${money(it.priceUsd * it.qty, 'USD')}</td>
                  <td><button class="btn btn-ghost btn-sm" onclick="cartRemove(${idx})">✕</button></td>
                </tr>`).join('')}</tbody></table>
            </div>
          ` : `<div class="empty"><div class="big">🛒</div>Agrega productos o servicios al carrito.</div>`}
        </div>

        <div class="section-title"><h2>Cliente y vendedor</h2></div>
        <div class="card card-pad row-fields" style="grid-template-columns:1fr 1fr;">
          <div class="field" style="margin:0;">
            <label>Cliente</label>
            <select id="clientSel" onchange="CART.clientId=this.value; render()">
              <option value="">Cliente ocasional</option>
              ${DB.clients.map(c => `<option value="${c.id}" ${CART.clientId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field" style="margin:0;">
            <label>Vendedor</label>
            <select id="vendorSel" onchange="CART.vendor=this.value">
              ${DB.config.vendors.map(v => `<option ${CART.vendor === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div>
        <div class="card card-pad">
          <div class="line" style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Subtotal</span><span class="amt">${money(subtotalUsd, 'USD')}</span></div>
          <div class="line" style="display:flex;justify-content:space-between;margin-bottom:6px;color:var(--ink-soft)"><span>IVA (${ivaPct}%)</span><span class="amt">${money(ivaUsd, 'USD')}</span></div>
          <hr style="border:none;border-top:1px solid var(--line-soft);margin:10px 0">
          <div class="line" style="display:flex;justify-content:space-between;font-weight:700;font-size:16px;"><span>Total</span><span class="amt">${money(totalUsd, 'USD')}</span></div>
          <div class="line" style="display:flex;justify-content:space-between;color:var(--ink-soft);font-size:12.5px;margin-top:2px;"><span>Equivalente</span><span class="amt">${money(totalBs, 'Bs')}</span></div>
          <div class="field" style="display:flex;gap:14px;margin:8px 0 0;">
            <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:400;"><input type="checkbox" ${CART.showBs ? 'checked' : ''} onchange="CART.showBs=this.checked; render()"> Incluir Bs. en la factura</label>
            ${DB.config.exchangeRateCop ? `<label style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:400;"><input type="checkbox" ${CART.showCop ? 'checked' : ''} onchange="CART.showCop=this.checked; render()"> Incluir COP en la factura</label>` : ''}
          </div>
          <div class="hint" style="font-size:11px;margin-top:2px;">El equivalente de arriba es solo referencia para ti al cobrar. Solo aparece en la factura impresa lo que marques aquí — el dólar es siempre la moneda principal.</div>

          <div class="section-title" style="margin:18px 0 8px 0;"><h2 style="font-size:14px;">Métodos de pago</h2></div>
          <div class="searchbar" style="margin-bottom:8px;">
            <select id="payMethodSel" style="flex:1">${DB.config.paymentMethods.map(m => `<option>${esc(m)}</option>`).join('')}</select>
            <button class="btn btn-sm" onclick="cartAddPaymentRow()">+ Añadir</button>
          </div>
          ${CART.payments.map((p, idx) => `
            <div class="pay-row">
              <div>${esc(p.method)}</div>
              <input type="number" step="0.01" value="${p.amountUsd}" style="padding:6px 8px;border:1px solid var(--line);border-radius:6px" onchange="cartSetPayment(${idx}, this.value)">
              <button class="btn btn-ghost btn-sm" onclick="cartRemovePayment(${idx})">✕</button>
            </div>`).join('')}
          <div class="hint" style="margin:6px 0 10px 0;">Montos de pago en dólares equivalentes (a la tasa del día).</div>

          <div class="line" style="display:flex;justify-content:space-between;font-weight:600;"><span>Pagado</span><span class="amt">${money(paidUsd, 'USD')}</span></div>
          <div class="line" style="display:flex;justify-content:space-between;font-weight:600;color:${balanceUsd > 0 ? 'var(--clay)' : 'var(--teal)'}"><span>${balanceUsd > 0 ? 'Falta / a crédito' : 'Cambio'}</span><span class="amt">${money(Math.abs(balanceUsd), 'USD')}</span></div>
          ${balanceUsd > 0 && !CART.clientId ? `<div class="hint" style="color:var(--clay)">Selecciona un cliente para dejar saldo a crédito.</div>` : ''}

          <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:14px;padding:11px;" ${!CART.items.length ? 'disabled' : ''} onclick="guardedRun(this,finalizeSale)">Registrar venta</button>
          <button class="btn btn-ghost" style="width:100%;justify-content:center;margin-top:6px;" onclick="cartClear()">Vaciar carrito</button>
        </div>
      </div>
    </div>
  `;
    }
    function cartAddFromPicker() {
      const sel = document.getElementById('itemPicker').value;
      if (!sel) return;
      const [kind, id] = sel.split(':');
      if (kind === 'p') {
        const p = getProduct(id); if (!p) return;
        const existing = CART.items.find(it => it.kind === 'p' && it.refId === id);
        if (existing) existing.qty += 1;
        else CART.items.push({ kind: 'p', refId: id, name: p.name, priceUsd: (p[CART.priceTier] || p.price), cost: p.cost, qty: 1 });
      } else {
        const s = getService(id); if (!s) return;
        const existing = CART.items.find(it => it.kind === 's' && it.refId === id);
        if (existing) existing.qty += 1;
        else CART.items.push({ kind: 's', refId: id, name: s.name, priceUsd: s.price, cost: 0, qty: 1 });
      }
      render();
    }
    function cartSetQty(idx, val) { CART.items[idx].qty = Math.max(1, Number(val) || 1); render(); }
    function cartRemove(idx) { CART.items.splice(idx, 1); render(); }
    function cartClear() { CART = { items: [], clientId: '', vendor: DB.config.vendors[0] || '', payments: [], lastTicket: null, priceTier: 'price', showBs: false, showCop: false }; render(); }
    function cartAddPaymentRow() {
      const method = document.getElementById('payMethodSel').value;
      CART.payments.push({ method, amountUsd: 0 });
      render();
    }
    function cartSetPayment(idx, val) { CART.payments[idx].amountUsd = Number(val) || 0; render(); }
    function cartRemovePayment(idx) { CART.payments.splice(idx, 1); render(); }

    async function finalizeSale() {
      if (!CART.items.length) return;
      const subtotalUsd = CART.items.reduce((a, it) => a + it.priceUsd * it.qty, 0);
      const ivaPct = DB.config.iva || 0;
      const ivaUsd = subtotalUsd * ivaPct / 100;
      const totalUsd = subtotalUsd + ivaUsd;
      const totalBs = totalUsd * DB.config.exchangeRate;
      const paidUsd = CART.payments.reduce((a, p) => a + Number(p.amountUsd || 0), 0);
      let creditAmount = 0, changeUsd = 0;
      if (paidUsd < totalUsd) {
        if (!CART.clientId) { toast('Selecciona un cliente para dejar saldo a crédito, o completa el pago.', true); return; }
        creditAmount = totalUsd - paidUsd;
      } else {
        changeUsd = paidUsd - totalUsd;
      }
      // stock check
      for (const it of CART.items) {
        if (it.kind === 'p') {
          const p = getProduct(it.refId);
          if (!p || (p.stock || 0) < it.qty) { toast(`Existencia insuficiente de "${it.name}".`, true); return; }
        }
      }
      const client = CART.clientId ? getClient(CART.clientId) : null;
      const ticketNo = (DB.sales.length + 1);
      const sale = {
        id: uid('venta'), ticketNo, date: todayISO(), ts: Date.now(),
        clientId: CART.clientId || '', clientName: client ? client.name : 'Cliente ocasional',
        vendor: CART.vendor, items: CART.items.map(it => ({ ...it })),
        subtotalUsd, ivaUsd, totalUsd, totalBs, payments: CART.payments.map(p => ({ ...p })),
        changeUsd, creditAmount, exchangeRate: DB.config.exchangeRate, exchangeRateCop: DB.config.exchangeRateCop || 0,
        showBs: !!CART.showBs, showCop: !!(CART.showCop && DB.config.exchangeRateCop)
      };
      DB.sales.push(sale);
      CART.items.forEach(it => { if (it.kind === 'p') { const p = getProduct(it.refId); if (p) p.stock = (p.stock || 0) - it.qty; } });
      await save('sales'); await save('products');
      CART.lastTicket = sale;
      toast('Venta registrada ✓');
      showTicket(sale);
      CART = { items: [], clientId: '', vendor: CART.vendor, payments: [], lastTicket: null, priceTier: 'price', showBs: false, showCop: false };
      render();
    }
    function showTicket(sale) {
      const cfg = DB.config;
      const mid = openModal(`
    <div class="modal-head"><h3>Ticket de venta</h3><button class="x-close">✕</button></div>
    <div class="modal-body">
      <div class="ticket-wrap"><div class="ticket" id="ticketPrint">
        <div class="biz">${esc(cfg.businessName)}</div>
        <div class="biz-sub">${cfg.rif ? ('RIF: ' + esc(cfg.rif) + ' · ') : ''}${esc(cfg.address || '')}</div>
        <hr>
        <div class="line"><span>Ticket N°</span><span>${sale.ticketNo}</span></div>
        <div class="line"><span>Fecha</span><span>${fmtDate(sale.date)}</span></div>
        <div class="line"><span>Vendedor</span><span>${esc(sale.vendor)}</span></div>
        <div class="line"><span>Cliente</span><span>${esc(sale.clientName)}</span></div>
        <hr>
        <div class="items">
          ${sale.items.map(it => `<div class="line"><span>${it.qty} x ${esc(it.name)}</span><span>${money(it.priceUsd * it.qty, 'USD')}</span></div>`).join('')}
        </div>
        <hr>
        <div class="line"><span>Subtotal</span><span>${money(sale.subtotalUsd, 'USD')}</span></div>
        <div class="line"><span>IVA</span><span>${money(sale.ivaUsd, 'USD')}</span></div>
        <div class="line tot"><span>TOTAL</span><span>${money(sale.totalUsd, 'USD')}</span></div>
        ${sale.showBs ? `<div class="line"><span>Equiv. Bs.</span><span>${money(sale.totalBs, 'Bs')}</span></div>` : ''}
        ${sale.showCop ? `<div class="line"><span>Equiv. COP</span><span>${money(sale.totalUsd * sale.exchangeRateCop, 'COP')}</span></div>` : ''}
        <hr>
        ${sale.payments.map(p => `<div class="line"><span>${esc(p.method)}</span><span>${money(p.amountUsd, 'USD')}</span></div>`).join('')}
        ${sale.changeUsd > 0 ? `<div class="line"><span>Cambio</span><span>${money(sale.changeUsd, 'USD')}</span></div>` : ''}
        ${sale.creditAmount > 0 ? `<div class="line"><span>A crédito</span><span>${money(sale.creditAmount, 'USD')}</span></div>` : ''}
        <div class="thanks">¡Gracias por su compra!</div>
      </div></div>
    </div>
    <div class="modal-foot"><button class="btn" onclick="printTicket()">Imprimir</button><button class="btn btn-primary" onclick="closeModal(MID)">Cerrar</button></div>
  `);
      fixModal(mid);
    }
    function printTicket() { window.print(); }

    /* ============================================================
       PRODUCTOS
       ============================================================ */
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
      <table><thead><tr><th>Código</th><th>Producto</th><th>Costo</th><th>Precio 1</th><th>Precio 2</th><th>Precio 3</th><th>Existencia</th><th>Ubicación</th><th></th></tr></thead>
      <tbody>${list.map(p => `
        <tr>
          <td class="mono">${esc(p.code || '—')}</td>
          <td>${esc(p.name)}</td>
          <td class="amt">${money(p.cost, 'USD')}</td>
          <td class="amt">${money(p.price, 'USD')}</td>
          <td class="amt">${p.price2 ? money(p.price2, 'USD') : '—'}</td>
          <td class="amt">${p.price3 ? money(p.price3, 'USD') : '—'}</td>
          <td class="amt">${(p.stock || 0) <= (p.minStock || 0) ? `<span class="tag tag-clay">${p.stock || 0}</span>` : (p.stock || 0)}</td>
          <td>${esc(p.location || '—')}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="openProductForm('${p.id}')">Editar</button></td>
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

    /* ============================================================
       SERVICIOS
       ============================================================ */
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

    /* ============================================================
       PROVEEDORES
       ============================================================ */
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

    /* ============================================================
       COMPRAS
       ============================================================ */
    let PURCHASE_DRAFT = { supplierId: '', items: [] };
    function renderCompras(el) {
      const totalUsd = PURCHASE_DRAFT.items.reduce((a, it) => a + it.unitCost * it.qty, 0);
      el.innerHTML = `
    <div class="card card-pad">
      <div class="row-fields">
        <div class="field"><label>Proveedor</label>
          <select id="pu_sup" onchange="PURCHASE_DRAFT.supplierId=this.value">
            <option value="">— Selecciona —</option>
            ${DB.suppliers.map(s => `<option value="${s.id}" ${PURCHASE_DRAFT.supplierId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Fecha</label><input value="${fmtDate(todayISO())}" disabled></div>
        <div class="field"><label>N° de compra</label><input value="C-${DB.purchases.length + 1}" disabled></div>
      </div>
      ${!DB.suppliers.length ? `<div class="hint">Aún no tienes proveedores. <a href="#" onclick="navigate('proveedores');return false;">Crea uno primero</a>.</div>` : ''}
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
    function addPurchaseLine() {
      const productId = document.getElementById('pu_prod').value;
      const qty = Number(document.getElementById('pu_qty').value) || 0;
      const unitCost = Number(document.getElementById('pu_cost').value) || 0;
      if (!productId || qty <= 0 || unitCost < 0) { toast('Completa producto, cantidad y costo', true); return; }
      PURCHASE_DRAFT.items.push({ productId, qty, unitCost });
      render();
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
      toast('Compra registrada ✓ — inventario y costo actualizados');
      PURCHASE_DRAFT = { supplierId: '', items: [] };
      render();
    }

    /* ============================================================
       AJUSTES DE INVENTARIO
       ============================================================ */
    function renderAjustes(el) {
      el.innerHTML = `
    <div class="card card-pad">
      <div class="row-fields">
        <div class="field"><label>Producto</label>
          <select id="aj_prod"><option value="">— Selecciona —</option>${DB.products.map(p => `<option value="${p.id}">${esc(p.name)} (existencia: ${p.stock || 0})</option>`).join('')}</select>
        </div>
        <div class="field"><label>Cantidad (+ entra / − sale)</label><input id="aj_qty" type="number" placeholder="Ej: -2 o 5"></div>
        <div class="field"><label>Motivo</label>
          <select id="aj_reason"><option>Conteo físico</option><option>Producto dañado</option><option>Vencimiento</option><option>Merma</option><option>Corrección de registro</option><option>Otro</option></select>
        </div>
      </div>
      <button class="btn btn-primary" onclick="guardedRun(this,registerAdjustment)">Registrar ajuste</button>
    </div>
    <div class="section-title"><h2>Historial de ajustes</h2></div>
    ${DB.inventoryAdjustments.length ? `
    <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Producto</th><th>Cantidad</th><th>Motivo</th></tr></thead>
      <tbody>${[...DB.inventoryAdjustments].reverse().map(a => `<tr><td>${fmtDate(a.date)}</td><td>${esc(getProduct(a.productId)?.name || '—')}</td>
        <td class="amt" style="color:${a.qty < 0 ? 'var(--clay)' : 'var(--teal)'}">${a.qty > 0 ? '+' : ''}${a.qty}</td><td>${esc(a.reason)}</td></tr>`).join('')}</tbody></table></div>
    ` : `<div class="empty"><div class="big">±</div>Sin ajustes registrados todavía.</div>`}
  `;
    }
    async function registerAdjustment() {
      const productId = document.getElementById('aj_prod').value;
      const qty = Number(document.getElementById('aj_qty').value);
      const reason = document.getElementById('aj_reason').value;
      if (!productId || !qty) { toast('Selecciona producto y cantidad', true); return; }
      const p = getProduct(productId);
      p.stock = (p.stock || 0) + qty;
      DB.inventoryAdjustments.push({ id: uid('adj'), productId, qty, reason, date: todayISO(), ts: Date.now() });
      await save('products'); await save('inventoryAdjustments');
      toast('Ajuste registrado ✓');
      render();
    }

    /* ============================================================
       CLIENTES
       ============================================================ */
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

    /* ============================================================
       EGRESOS
       ============================================================ */
    function renderEgresos(el) {
      const today = todayISO();
      const todays = expensesOnDate(today);
      el.innerHTML = `
    <div class="card card-pad">
      <div class="row-fields">
        <div class="field"><label>Tipo de egreso</label>
          <select id="eg_type">
            ${DB.config.expenseTypes.map(t => `<option>${esc(t)}</option>`).join('')}
            ${DB.config.expenseTypes.includes('Sueldos') ? '' : ''}
          </select>
        </div>
        <div class="field" id="eg_vendor_wrap" style="display:none;"><label>Vendedor</label>
          <select id="eg_vendor">${DB.config.vendors.map(v => `<option>${esc(v)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Monto (USD)</label><input id="eg_amount" type="number" step="0.01"></div>
        <div class="field"><label>Método de pago</label><select id="eg_method">${DB.config.paymentMethods.filter(m => m !== 'Crédito').map(m => `<option>${esc(m)}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Nota (opcional)</label><input id="eg_note" placeholder="Detalle del egreso"></div>
      <button class="btn btn-primary" onclick="guardedRun(this,registerExpense)">Registrar egreso</button>
    </div>
    <div class="section-title"><h2>Egresos de hoy</h2></div>
    ${todays.length ? `
    <div class="table-wrap"><table><thead><tr><th>Tipo</th><th>Nota</th><th>Método</th><th style="text-align:right">Monto</th></tr></thead>
      <tbody>${todays.map(e => `<tr><td>${esc(e.type)}</td><td>${esc(e.note || '—')}</td><td>${esc(e.method)}</td><td class="amt" style="text-align:right">${money(e.amountUsd, 'USD')}</td></tr>`).join('')}</tbody></table></div>
    ` : `<div class="empty"><div class="big">⇧</div>Sin egresos registrados hoy.</div>`}
  `;
      document.getElementById('eg_type').addEventListener('change', toggleVendorWrap);
      toggleVendorWrap();
      function toggleVendorWrap() {
        document.getElementById('eg_vendor_wrap').style.display = document.getElementById('eg_type').value === 'Sueldos' ? '' : 'none';
      }
    }
    async function registerExpense() {
      const type = document.getElementById('eg_type').value;
      const amountUsd = Number(document.getElementById('eg_amount').value) || 0;
      const method = document.getElementById('eg_method').value;
      const vendor = document.getElementById('eg_vendor_wrap').style.display !== 'none' ? document.getElementById('eg_vendor').value : '';
      const note = document.getElementById('eg_note').value.trim() || (vendor ? ('Sueldo — ' + vendor) : '');
      if (amountUsd <= 0) { toast('Ingresa un monto válido', true); return; }
      DB.expenses.push({ id: uid('egr'), type, amountUsd, method, note, date: todayISO(), ts: Date.now() });
      await save('expenses');
      toast('Egreso registrado ✓');
      render();
    }

    /* ============================================================
       CIERRE DE CAJA
       ============================================================ */
    let CIERRE_DATE = todayISO();
    function renderCierre(el) {
      const iso = CIERRE_DATE;
      const methods = DB.config.paymentMethods.filter(m => m !== 'Crédito');
      const existing = DB.cashClosings.find(c => c.date === iso);
      const prevClosing = [...DB.cashClosings].filter(c => c.date < iso).sort((a, b) => a.date < b.date ? 1 : -1)[0];

      const salesToday = salesOnDate(iso);
      const expensesToday = expensesOnDate(iso);
      const ingresosPorMetodo = {}; methods.forEach(m => ingresosPorMetodo[m] = 0);
      salesToday.forEach(s => s.payments.forEach(p => { if (ingresosPorMetodo[p.method] != null) ingresosPorMetodo[p.method] += p.amountUsd; }));
      const egresosPorMetodo = {}; methods.forEach(m => egresosPorMetodo[m] = 0);
      expensesToday.forEach(e => { if (egresosPorMetodo[e.method] != null) egresosPorMetodo[e.method] += e.amountUsd; });

      const cogs = salesToday.reduce((a, s) => a + s.items.reduce((x, it) => x + (it.cost || 0) * it.qty, 0), 0);
      const totalVentasUsd = salesToday.reduce((a, s) => a + s.totalUsd, 0);
      const totalEgresosUsd = expensesToday.reduce((a, e) => a + e.amountUsd, 0);
      const utilidadBruta = totalVentasUsd - cogs;
      const utilidadNeta = utilidadBruta - totalEgresosUsd;

      el.innerHTML = `
    <div class="searchbar">
      <label style="font-weight:600;font-size:13px;">Fecha:</label>
      <input type="date" value="${iso}" onchange="CIERRE_DATE=this.value; render()">
      ${existing ? `<span class="tag tag-teal">Ya cerrada</span>` : ''}
    </div>

    <div class="grid grid-3" style="margin-bottom:18px;">
      <div class="stat pos"><div class="lbl">Utilidad bruta</div><div class="val amt">${money(utilidadBruta, 'USD')}</div></div>
      <div class="stat ${utilidadNeta < 0 ? 'neg' : 'pos'}"><div class="lbl">Utilidad neta</div><div class="val amt">${money(utilidadNeta, 'USD')}</div></div>
      <div class="stat"><div class="lbl">Egresos del día</div><div class="val amt">${money(totalEgresosUsd, 'USD')}</div></div>
    </div>

    <div class="table-wrap"><table><thead><tr><th>Método</th><th>Apertura</th><th>Ingresos</th><th>Egresos</th><th>Cierre teórico</th><th>Conteo real</th><th>Diferencia</th></tr></thead>
      <tbody>${methods.map(m => {
        const apertura = existing ? (existing.opening[m] || 0) : (prevClosing ? (prevClosing.real[m] || 0) : 0);
        const teorico = apertura + ingresosPorMetodo[m] - egresosPorMetodo[m];
        const real = existing ? (existing.real[m] || 0) : teorico;
        const diff = real - teorico;
        return `<tr data-teorico="${teorico}">
          <td>${esc(m)}</td>
          <td class="amt">${money(apertura, 'USD')}</td>
          <td class="amt" style="color:var(--teal)">${money(ingresosPorMetodo[m], 'USD')}</td>
          <td class="amt" style="color:var(--clay)">${money(egresosPorMetodo[m], 'USD')}</td>
          <td class="amt">${money(teorico, 'USD')}</td>
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
      const methods = DB.config.paymentMethods.filter(m => m !== 'Crédito');
      const salesToday = salesOnDate(iso);
      const expensesToday = expensesOnDate(iso);
      const prevClosing = [...DB.cashClosings].filter(c => c.date < iso).sort((a, b) => a.date < b.date ? 1 : -1)[0];
      const ingresosPorMetodo = {}; methods.forEach(m => ingresosPorMetodo[m] = 0);
      salesToday.forEach(s => s.payments.forEach(p => { if (ingresosPorMetodo[p.method] != null) ingresosPorMetodo[p.method] += p.amountUsd; }));
      const egresosPorMetodo = {}; methods.forEach(m => egresosPorMetodo[m] = 0);
      expensesToday.forEach(e => { if (egresosPorMetodo[e.method] != null) egresosPorMetodo[e.method] += e.amountUsd; });

      const opening = {}, real = {}; let diffUsd = 0;
      methods.forEach(m => {
        opening[m] = prevClosing ? (prevClosing.real[m] || 0) : 0;
        const input = document.querySelector(`.cierre-real[data-method="${m.replace(/"/g, '')}"]`);
        real[m] = input ? Number(input.value) || 0 : (opening[m] + ingresosPorMetodo[m] - egresosPorMetodo[m]);
        const teorico = opening[m] + ingresosPorMetodo[m] - egresosPorMetodo[m];
        diffUsd += (real[m] - teorico);
      });
      DB.cashClosings.push({ id: uid('cierre'), date: iso, ts: Date.now(), opening, real, diffUsd });
      await save('cashClosings');
      toast('Caja cerrada ✓');
      render();
    }

    /* ============================================================
       REPORTES
       ============================================================ */
    let REP_TAB = 'general', REP_FROM = todayISO(), REP_TO = todayISO(), REP_VENDOR = '';
    function renderReportes(el) {
      el.innerHTML = `
    <div class="tabs">
      ${['general', 'productos', 'clientes', 'vendedor'].map(t => `<div class="tab ${REP_TAB === t ? 'active' : ''}" onclick="REP_TAB='${t}'; render()">${({ general: 'General', productos: 'Por producto', clientes: 'Por cliente', vendedor: 'Por vendedor' })[t]}</div>`).join('')}
    </div>
    <div class="searchbar">
      <label style="font-size:12.5px;">Desde</label><input type="date" value="${REP_FROM}" onchange="REP_FROM=this.value; render()">
      <label style="font-size:12.5px;">Hasta</label><input type="date" value="${REP_TO}" onchange="REP_TO=this.value; render()">
      ${REP_TAB === 'vendedor' ? `<select onchange="REP_VENDOR=this.value; render()"><option value="">Todos los vendedores</option>${DB.config.vendors.map(v => `<option ${REP_VENDOR === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>` : ''}
    </div>
    <div id="repBody">${REP_TAB === 'general' ? repGeneral() : REP_TAB === 'productos' ? repProductos() : REP_TAB === 'clientes' ? repClientes() : repVendedor()
        }</div>
  `;
    }
    function salesInRange() { return DB.sales.filter(s => s.date >= REP_FROM && s.date <= REP_TO); }
    function repGeneral() {
      const sales = salesInRange();
      const purchases = DB.purchases.filter(p => p.date >= REP_FROM && p.date <= REP_TO);
      const expenses = DB.expenses.filter(e => e.date >= REP_FROM && e.date <= REP_TO);
      const ingresos = sales.reduce((a, s) => a + s.totalUsd, 0);
      const cogs = sales.reduce((a, s) => a + s.items.reduce((x, it) => x + (it.cost || 0) * it.qty, 0), 0);
      const comprasUsd = purchases.reduce((a, p) => a + p.totalUsd, 0);
      const egresosUsd = expenses.reduce((a, e) => a + e.amountUsd, 0);
      const utilidadBruta = ingresos - cogs, utilidadNeta = utilidadBruta - egresosUsd;
      return `
    <div class="grid grid-4">
      <div class="stat"><div class="lbl">Ingresos por ventas</div><div class="val amt">${money(ingresos, 'USD')}</div><div class="sub">${sales.length} venta(s)</div></div>
      <div class="stat"><div class="lbl">Compras</div><div class="val amt">${money(comprasUsd, 'USD')}</div></div>
      <div class="stat neg"><div class="lbl">Egresos</div><div class="val amt">${money(egresosUsd, 'USD')}</div></div>
      <div class="stat ${utilidadNeta < 0 ? 'neg' : 'pos'}"><div class="lbl">Utilidad neta</div><div class="val amt">${money(utilidadNeta, 'USD')}</div><div class="sub">Bruta: ${money(utilidadBruta, 'USD')}</div></div>
    </div>`;
    }
    function repProductos() {
      const sales = salesInRange();
      const agg = {};
      sales.forEach(s => s.items.forEach(it => {
        if (it.kind !== 'p') return;
        if (!agg[it.refId]) agg[it.refId] = { name: it.name, qty: 0, revenue: 0, profit: 0 };
        agg[it.refId].qty += it.qty;
        agg[it.refId].revenue += it.priceUsd * it.qty;
        agg[it.refId].profit += (it.priceUsd - (it.cost || 0)) * it.qty;
      }));
      const rows = Object.values(agg);
      const topQty = [...rows].sort((a, b) => b.qty - a.qty).slice(0, 5);
      const topRev = [...rows].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
      const topProfit = [...rows].sort((a, b) => b.profit - a.profit).slice(0, 5);
      const block = (title, arr, key, cur) => `
    <div class="section-title"><h2 style="font-size:14px;">${title}</h2></div>
    ${arr.length ? `<div class="table-wrap"><table><thead><tr><th>Producto</th><th style="text-align:right">${title.includes('vendidos') ? 'Cantidad' : 'Monto'}</th></tr></thead>
      <tbody>${arr.map(r => `<tr><td>${esc(r.name)}</td><td class="amt" style="text-align:right">${key === 'qty' ? r.qty : money(r[key], cur || 'USD')}</td></tr>`).join('')}</tbody></table></div>`
          : `<div class="empty">Sin datos en el rango.</div>`}`;
      return block('Top 5 más vendidos', topQty, 'qty') + block('Top 5 en facturación', topRev, 'revenue') + block('Top 5 en ganancia', topProfit, 'profit');
    }
    function repClientes() {
      const sales = salesInRange();
      const agg = {};
      sales.forEach(s => {
        const key = s.clientId || 'occ';
        if (!agg[key]) agg[key] = { name: s.clientName, total: 0, count: 0 };
        agg[key].total += s.totalUsd; agg[key].count += 1;
      });
      const rows = Object.values(agg).sort((a, b) => b.total - a.total);
      return rows.length ? `<div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Ventas</th><th style="text-align:right">Total comprado</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${esc(r.name)}</td><td class="amt">${r.count}</td><td class="amt" style="text-align:right">${money(r.total, 'USD')}</td></tr>`).join('')}</tbody></table></div>`
        : `<div class="empty">Sin ventas en el rango.</div>`;
    }
    function repVendedor() {
      let sales = salesInRange();
      if (REP_VENDOR) sales = sales.filter(s => s.vendor === REP_VENDOR);
      const agg = {};
      sales.forEach(s => {
        if (!agg[s.vendor]) agg[s.vendor] = { total: 0, count: 0 };
        agg[s.vendor].total += s.totalUsd; agg[s.vendor].count += 1;
      });
      const rows = Object.entries(agg).map(([vendor, v]) => ({ vendor, ...v })).sort((a, b) => b.total - a.total);
      return rows.length ? `<div class="table-wrap"><table><thead><tr><th>Vendedor</th><th>Ventas</th><th style="text-align:right">Total vendido</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${esc(r.vendor)}</td><td class="amt">${r.count}</td><td class="amt" style="text-align:right">${money(r.total, 'USD')}</td></tr>`).join('')}</tbody></table></div>`
        : `<div class="empty">Sin ventas en el rango.</div>`;
    }

    /* ============================================================
       HISTORIAL
       ============================================================ */
    let HIST_TYPE = '';
    function renderHistorial(el) {
      let rows = unifiedHistory();
      if (HIST_TYPE) rows = rows.filter(r => r.type === HIST_TYPE);
      el.innerHTML = `
    <div class="searchbar">
      <select onchange="HIST_TYPE=this.value; render()">
        <option value="">Todos los movimientos</option>
        <option value="venta" ${HIST_TYPE === 'venta' ? 'selected' : ''}>Ventas</option>
        <option value="compra" ${HIST_TYPE === 'compra' ? 'selected' : ''}>Compras (proveedores)</option>
        <option value="egreso" ${HIST_TYPE === 'egreso' ? 'selected' : ''}>Egresos</option>
        <option value="ajuste" ${HIST_TYPE === 'ajuste' ? 'selected' : ''}>Ajustes de inventario</option>
        <option value="cierre" ${HIST_TYPE === 'cierre' ? 'selected' : ''}>Cierres de caja (aperturas)</option>
        <option value="abono" ${HIST_TYPE === 'abono' ? 'selected' : ''}>Abonos</option>
      </select>
    </div>
    ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th style="text-align:right">Monto</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td>${fmtDate(r.date)}</td><td>${histTag(r.type)}</td><td>${esc(r.detail)}</td><td class="amt" style="text-align:right">${r.amountLabel}</td></tr>`).join('')}</tbody></table></div>`
          : `<div class="empty"><div class="big">☰</div>Sin movimientos para este filtro.</div>`}
  `;
    }

    /* ============================================================
       CONFIG
       ============================================================ */
    function renderConfig(el) {
      const c = DB.config;
      el.innerHTML = `
    <div class="grid grid-2">
      <div class="card card-pad">
        <h3 style="margin-top:0;font-size:15px;">Datos del negocio</h3>
        <div class="field"><label>Nombre del negocio</label><input id="cf_name" value="${esc(c.businessName)}"></div>
        <div class="field"><label>RIF</label><input id="cf_rif" value="${esc(c.rif || '')}"></div>
        <div class="field"><label>Dirección</label><input id="cf_addr" value="${esc(c.address || '')}"></div>
        <div class="field"><label>Teléfono</label><input id="cf_phone" value="${esc(c.phone || '')}"></div>
        <div class="row-fields">
          <div class="field"><label>Tasa del día (Bs./$)</label><input id="cf_rate" type="number" step="0.01" value="${c.exchangeRate}"></div>
          <div class="field"><label>IVA (%)</label><input id="cf_iva" type="number" step="0.01" value="${c.iva}"></div>
        </div>
        <div class="field"><label>Tasa COP/$ (opcional — deja en 0 si no la usas)</label><input id="cf_rate_cop" type="number" step="0.01" value="${c.exchangeRateCop || 0}"></div>
        <button class="btn btn-primary" onclick="guardedRun(this,saveBizConfig)">Guardar</button>
      </div>

      <div class="card card-pad">
        <h3 style="margin-top:0;font-size:15px;">Métodos de pago</h3>
        ${listEditor('paymentMethods', c.paymentMethods)}
      </div>
    </div>

    <div class="grid grid-2" style="margin-top:16px;">
      <div class="card card-pad">
        <h3 style="margin-top:0;font-size:15px;">Tipos de egreso</h3>
        ${listEditor('expenseTypes', c.expenseTypes)}
      </div>
      <div class="card card-pad">
        <h3 style="margin-top:0;font-size:15px;">Vendedores</h3>
        ${listEditor('vendors', c.vendors)}
      </div>
    </div>
  `;
    }
    function listEditor(key, arr) {
      return `
    <div class="chip-list">${arr.map((v, i) => `<span class="chip">${esc(v)}<button onclick="removeConfigItem('${key}',${i})">✕</button></span>`).join('')}</div>
    <div class="searchbar" style="margin-top:10px;">
      <input id="ci_${key}" placeholder="Añadir…" onkeydown="if(event.key==='Enter'){addConfigItem('${key}')}">
      <button class="btn btn-sm" onclick="addConfigItem('${key}')">+ Añadir</button>
    </div>`;
    }
    async function addConfigItem(key) {
      const input = document.getElementById('ci_' + key);
      const val = input.value.trim();
      if (!val) return;
      DB.config[key].push(val);
      await save('config');
      renderConfig(document.getElementById('content'));
    }
    async function removeConfigItem(key, idx) {
      DB.config[key].splice(idx, 1);
      await save('config');
      renderConfig(document.getElementById('content'));
    }
    async function saveBizConfig() {
      DB.config.businessName = document.getElementById('cf_name').value.trim() || 'Mi Negocio';
      DB.config.rif = document.getElementById('cf_rif').value.trim();
      DB.config.address = document.getElementById('cf_addr').value.trim();
      DB.config.phone = document.getElementById('cf_phone').value.trim();
      DB.config.exchangeRate = Number(document.getElementById('cf_rate').value) || 1;
      DB.config.exchangeRateCop = Number(document.getElementById('cf_rate_cop').value) || 0;
      DB.config.iva = Number(document.getElementById('cf_iva').value) || 0;
      await save('config');
      toast('Configuración guardada ✓');
      render();
    }

    /* ============================================================ INIT ============================================================ */

    /* ============================================================
       PATRIMONIO NETO / BRUTO
       ============================================================ */
    function renderPatrimonio(el) {
      const inv = DB.config.initialInvestment || 0;

      const inventoryValue = DB.products.reduce((a, p) => a + (p.cost || 0) * (p.stock || 0), 0);
      const receivables = DB.clients.reduce((a, c) => a + Math.max(clientBalance(c.id), 0), 0);

      // Solo cuenta como caja el dinero que realmente entró (se excluye
      // cualquier fila de pago marcada como "Crédito" por error).
      const salesCashIn = DB.sales.reduce((a, s) =>
        a + (s.payments || []).filter(p => p.method !== 'Crédito').reduce((x, p) => x + (p.amountUsd || 0), 0), 0);
      const abonosCashIn = DB.receivablePayments.reduce((a, p) => a + (p.amount || 0), 0);
      const purchasesCashOut = DB.purchases.reduce((a, p) => a + (p.totalUsd || 0), 0);
      const expensesCashOut = DB.expenses.reduce((a, e) => a + (e.amountUsd || 0), 0);

      const cash = inv + salesCashIn + abonosCashIn - purchasesCashOut - expensesCashOut;
      const patrimonioBruto = cash + inventoryValue + receivables;
      const patrimonioNeto = patrimonioBruto - inv;

      el.innerHTML = `
    <div class="grid grid-2">
      <div class="card card-pad">
        <h3 style="margin-top:0;font-size:15px;">Inversión inicial</h3>
        <div class="field"><label>Capital aportado (USD)</label><input id="pt_inv" type="number" step="0.01" value="${inv}"></div>
        <button class="btn btn-primary" onclick="guardedRun(this, saveInvestment)">Guardar</button>
        <div class="hint" style="margin-top:8px;">Lo que aportaste tú (o los socios) para arrancar el negocio. Es la referencia para medir cuánto valor ha generado la operación desde entonces.</div>
      </div>
      <div class="card card-pad">
        <h3 style="margin-top:0;font-size:15px;">¿Cómo se calcula?</h3>
        <div class="hint">
          <b>Patrimonio bruto</b> = caja acumulada + inventario a costo + cuentas por cobrar.<br><br>
          <b>Patrimonio neto</b> = patrimonio bruto − inversión inicial. Es lo que el negocio ha generado por sí mismo, además de lo que pusiste tú.
        </div>
      </div>
    </div>

    <div class="grid grid-4" style="margin-top:16px;">
      <div class="stat"><div class="lbl">Caja acumulada</div><div class="val amt">${money(cash, 'USD')}</div><div class="sub">Inversión + cobros − compras − egresos</div></div>
      <div class="stat"><div class="lbl">Inventario (a costo)</div><div class="val amt">${money(inventoryValue, 'USD')}</div><div class="sub">${DB.products.length} producto(s)</div></div>
      <div class="stat"><div class="lbl">Cuentas por cobrar</div><div class="val amt">${money(receivables, 'USD')}</div><div class="sub">${DB.clients.filter(c => clientBalance(c.id) > 0).length} cliente(s) con saldo</div></div>
      <div class="stat ${patrimonioBruto < 0 ? 'neg' : 'pos'}"><div class="lbl">Patrimonio bruto</div><div class="val amt">${money(patrimonioBruto, 'USD')}</div><div class="sub">Activos totales del negocio</div></div>
    </div>

    <div class="section-title"><h2>Patrimonio neto</h2></div>
    <div class="card card-pad">
      <div class="stat ${patrimonioNeto < 0 ? 'neg' : 'pos'}" style="border:none;padding:0;">
        <div class="lbl">Valor generado por la operación</div>
        <div class="val amt" style="font-size:28px;">${money(patrimonioNeto, 'USD')}</div>
        <div class="sub">Patrimonio bruto (${money(patrimonioBruto, 'USD')}) − inversión inicial (${money(inv, 'USD')})</div>
      </div>
    </div>
  `;
    }
    async function saveInvestment() {
      DB.config.initialInvestment = Number(document.getElementById('pt_inv').value) || 0;
      await save('config');
      toast('Inversión inicial guardada ✓');
      renderPatrimonio(document.getElementById('content'));
    }

    (async function init() {
      const favicon = document.createElement('link');
      favicon.rel = 'icon'; favicon.href = LOGO_ICON;
      document.head.appendChild(favicon);
      await loadDB();
      render();
    })();
  