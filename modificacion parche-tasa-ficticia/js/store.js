
const LOGO_ICON = "/logo.png";



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
  config: ['paymentMethods', 'expenseTypes', 'vendors', 'divisaCashMethods'],
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
  else {
    const d = defaultConfig();
    for (const key of ['useFictitiousRate', 'cashDiscountPercent', 'divisaCashMethods']) {
      if (DB.config[key] == null || (Array.isArray(d[key]) && !Array.isArray(DB.config[key]))) DB.config[key] = d[key];
    }
  }
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
    vendors: ['Vendedor 1'],
    useFictitiousRate: false, cashDiscountPercent: 20,
    divisaCashMethods: ['Zelle ($)', 'Binance ($)', 'PayPal ($)', 'Efectivo ($)']
  };
}
function toast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.background = isError ? 'var(--clay)' : 'var(--ink)';
  t.classList.add('show');
  clearTimeout(window._toastT);
  window._toastT = setTimeout(() => t.classList.remove('show'), 2400);
}



/* Tasa ficticia: si está activa, todo lo que se vende sube por el
   multiplicador necesario para poder ofrecer cashDiscountPercent de
   "descuento" a quien pague en divisas y aun así cuadrar con el precio
   base real. Ej: 20% de descuento => multiplicador 1.25 (100/80). */
function fictitiousMultiplier() {
  const c = DB.config;
  if (!c || !c.useFictitiousRate) return 1;
  const d = Number(c.cashDiscountPercent) || 0;
  if (d <= 0 || d >= 100) return 1;
  return 1 / (1 - d / 100);
}
function fictitiousRateCop() {
  const c = DB.config;
  return (c && c.exchangeRateCop) ? c.exchangeRateCop * fictitiousMultiplier() : 0;
}
function sellPrice(basePrice) { return (Number(basePrice) || 0) * fictitiousMultiplier(); }
function isDivisaCashMethod(method) {
  const c = DB.config;
  return !!(c && c.useFictitiousRate && Array.isArray(c.divisaCashMethods) && c.divisaCashMethods.includes(method));
}

function calcPriceFromCost(cost, method, value) {
  cost = Number(cost) || 0; value = Number(value) || 0;
  if (method === 'markup') return cost * (1 + value / 100);           // % utilidad respecto al costo
  if (method === 'margin') return value >= 100 ? cost : cost / (1 - value / 100); // margen de contribución / utilidad bruta
  return cost;
}



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



// Expose to global scope for inline HTML handlers
window.DB = DB;
window.JSON_TEXT_FIELDS = JSON_TEXT_FIELDS;
window.LOGO_ICON = LOGO_ICON;
window.STORE_KEYS = STORE_KEYS;
window.calcPriceFromCost = calcPriceFromCost;
window.clientBalance = clientBalance;
window.defaultConfig = defaultConfig;
window.esc = esc;
window.expensesOnDate = expensesOnDate;
window.filterAndRerender = filterAndRerender;
window.fictitiousMultiplier = fictitiousMultiplier;
window.fictitiousRateCop = fictitiousRateCop;
window.sellPrice = sellPrice;
window.isDivisaCashMethod = isDivisaCashMethod;
window.fmtDate = fmtDate;
window.getClient = getClient;
window.getProduct = getProduct;
window.getService = getService;
window.getSupplier = getSupplier;
window.guardedRun = guardedRun;
window.loadDB = loadDB;
window.money = money;
window.norm = norm;
window.parseRecord = parseRecord;
window.pb = pb;
window.salesOnDate = salesOnDate;
window.save = save;
window.serializeRecord = serializeRecord;
window.smartMatch = smartMatch;
window.toast = toast;
window.todayISO = todayISO;
window.uid = uid;
