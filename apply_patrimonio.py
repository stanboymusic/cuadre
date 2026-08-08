#!/usr/bin/env python3
"""
Aplica el parche de Patrimonio Neto/Bruto al index.html
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HTML_FILE = "index.html"

with open(HTML_FILE, "r", encoding="utf-8") as f:
    content = f.read()

original_len = len(content)
changes = []

# ─────────────────────────────────────────────────────────────
# 1. NAV — agregar la pestaña "Patrimonio" después de historial
# Formato exacto encontrado: {id:'historial', label:'Historial', ic:'☰'},\n  ]},
# ─────────────────────────────────────────────────────────────
# Patrón exacto: "{id:'historial', label:'Historial', ic:'☰'},\n  ]},"
OLD1 = "{id:'historial', label:'Historial', ic:'\u2630'},\n  ]},"
NEW1 = "{id:'historial', label:'Historial', ic:'\u2630'},\n    {id:'patrimonio', label:'Patrimonio', ic:'\u2666'},\n  ]},"

if "{id:'patrimonio'" in content:
    changes.append("- NAV: pestaña Patrimonio ya existe, se omite")
elif OLD1 in content:
    content = content.replace(OLD1, NEW1, 1)
    changes.append("\u2713 NAV: pestaña Patrimonio agregada")
else:
    changes.append(f"\u2717 NAV: patrón no encontrado. Contexto alrededor de historial:")
    idx = content.find("historial")
    if idx >= 0:
        changes.append(f"  {repr(content[max(0,idx-40):idx+100])}")

# ─────────────────────────────────────────────────────────────
# 2. render() — registrar patrimonio: renderPatrimonio
#    Buscar el mapa de vistas
# ─────────────────────────────────────────────────────────────
# Patrón exacto: "historial: renderHistorial, config: renderConfig\n  };"
if "patrimonio: renderPatrimonio" in content or "patrimonio:renderPatrimonio" in content:
    changes.append("- render(): patrimonio ya registrado, se omite")
else:
    found_render = False
    for old_r, new_r in [
        ("historial: renderHistorial, config: renderConfig",
         "historial: renderHistorial, config: renderConfig,\n    patrimonio: renderPatrimonio"),
        ("renderHistorial, config: renderConfig",
         "renderHistorial, config: renderConfig,\n    patrimonio: renderPatrimonio"),
        ("renderHistorial,config:renderConfig",
         "renderHistorial,config:renderConfig,patrimonio:renderPatrimonio"),
    ]:
        if old_r in content:
            content = content.replace(old_r, new_r, 1)
            changes.append(f"\u2713 render(): patrimonio registrado")
            found_render = True
            break
    if not found_render:
        # Buscar el mapa completo para diagnóstico
        for kw in ["renderHistorial", "renderConfig", "renderReportes"]:
            idx = content.find(kw)
            if idx >= 0:
                changes.append(f"  Contexto de '{kw}': {repr(content[max(0,idx-30):idx+80])}")
                break
        changes.append("\u2717 render(): no se encontró el mapa de vistas")

# ─────────────────────────────────────────────────────────────
# 3. defaultConfig() — campo initialInvestment
# ─────────────────────────────────────────────────────────────
if "initialInvestment" in content:
    changes.append("- defaultConfig: initialInvestment ya existe, se omite")
else:
    found_cfg = False
    for old_d, new_d in [
        ("exchangeRate: 40, iva: 16,",
         "exchangeRate: 40, iva: 16, initialInvestment: 0,"),
        ("exchangeRate:40,iva:16,",
         "exchangeRate:40,iva:16,initialInvestment:0,"),
        ("exchangeRate: 40, iva: 16",
         "exchangeRate: 40, iva: 16, initialInvestment: 0"),
        ("exchangeRate:40,iva:16",
         "exchangeRate:40,iva:16,initialInvestment:0"),
    ]:
        if old_d in content:
            content = content.replace(old_d, new_d, 1)
            changes.append(f"✓ defaultConfig: initialInvestment añadido")
            found_cfg = True
            break
    if not found_cfg:
        for kw in ["exchangeRate", "iva: 16", "iva:16"]:
            idx = content.find(kw)
            if idx >= 0:
                changes.append(f"  Contexto de '{kw}': {repr(content[max(0,idx-20):idx+80])}")
                break
        changes.append("✗ defaultConfig: no se encontró el patrón exchangeRate/iva")

# ─────────────────────────────────────────────────────────────
# 4. Insertar función renderPatrimonio + saveInvestment
# ─────────────────────────────────────────────────────────────
PATRIMONIO_FN = r"""
/* ============================================================
   PATRIMONIO NETO / BRUTO
   ============================================================ */
function renderPatrimonio(el){
  const inv = DB.config.initialInvestment || 0;

  const inventoryValue = DB.products.reduce((a,p)=>a + (p.cost||0)*(p.stock||0), 0);
  const receivables = DB.clients.reduce((a,c)=>a + Math.max(clientBalance(c.id),0), 0);

  // Solo cuenta como caja el dinero que realmente entró (se excluye
  // cualquier fila de pago marcada como "Crédito" por error).
  const salesCashIn = DB.sales.reduce((a,s)=>
    a + (s.payments||[]).filter(p=>p.method!=='Crédito').reduce((x,p)=>x+(p.amountUsd||0),0), 0);
  const abonosCashIn = DB.receivablePayments.reduce((a,p)=>a+(p.amount||0), 0);
  const purchasesCashOut = DB.purchases.reduce((a,p)=>a+(p.totalUsd||0), 0);
  const expensesCashOut = DB.expenses.reduce((a,e)=>a+(e.amountUsd||0), 0);

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
      <div class="stat"><div class="lbl">Caja acumulada</div><div class="val amt">${money(cash,'USD')}</div><div class="sub">Inversión + cobros − compras − egresos</div></div>
      <div class="stat"><div class="lbl">Inventario (a costo)</div><div class="val amt">${money(inventoryValue,'USD')}</div><div class="sub">${DB.products.length} producto(s)</div></div>
      <div class="stat"><div class="lbl">Cuentas por cobrar</div><div class="val amt">${money(receivables,'USD')}</div><div class="sub">${DB.clients.filter(c=>clientBalance(c.id)>0).length} cliente(s) con saldo</div></div>
      <div class="stat ${patrimonioBruto<0?'neg':'pos'}"><div class="lbl">Patrimonio bruto</div><div class="val amt">${money(patrimonioBruto,'USD')}</div><div class="sub">Activos totales del negocio</div></div>
    </div>

    <div class="section-title"><h2>Patrimonio neto</h2></div>
    <div class="card card-pad">
      <div class="stat ${patrimonioNeto<0?'neg':'pos'}" style="border:none;padding:0;">
        <div class="lbl">Valor generado por la operación</div>
        <div class="val amt" style="font-size:28px;">${money(patrimonioNeto,'USD')}</div>
        <div class="sub">Patrimonio bruto (${money(patrimonioBruto,'USD')}) − inversión inicial (${money(inv,'USD')})</div>
      </div>
    </div>
  `;
}
async function saveInvestment(){
  DB.config.initialInvestment = Number(document.getElementById('pt_inv').value)||0;
  await save('config');
  toast('Inversión inicial guardada ✓');
  renderPatrimonio(document.getElementById('content'));
}
"""

if "function renderPatrimonio" in content:
    changes.append("- renderPatrimonio: función ya existe, se omite")
else:
    # Buscar marcador de inserción: justo antes del bloque INIT
    MARKERS = [
        "(async function init(",
        "async function init(",
        "// ── INIT",
        "//── INIT",
        "// INIT",
        "/* INIT */",
        "//INIT",
        "function init()",
        "window.addEventListener('load'",
        "window.onload",
        "document.addEventListener('DOMContentLoaded'",
    ]
    inserted = False
    for marker in MARKERS:
        if marker in content:
            content = content.replace(marker, PATRIMONIO_FN + "\n" + marker, 1)
            changes.append(f"✓ renderPatrimonio: insertada antes de '{marker}'")
            inserted = True
            break
    if not inserted:
        # Como último recurso, buscar renderConfig y añadir después
        idx = content.rfind("function renderConfig")
        if idx >= 0:
            # Encontrar el cierre de esta función: buscar el siguiente 'function ' después
            next_fn = content.find("\nfunction ", idx + 20)
            if next_fn < 0:
                next_fn = content.find("\nasync function ", idx + 20)
            if next_fn > 0:
                content = content[:next_fn] + "\n" + PATRIMONIO_FN + content[next_fn:]
                changes.append("✓ renderPatrimonio: insertada después de renderConfig")
                inserted = True
        if not inserted:
            changes.append("✗ renderPatrimonio: no se encontró punto de inserción")

# ─────────────────────────────────────────────────────────────
# Guardar y reportar
# ─────────────────────────────────────────────────────────────
if any(c.startswith("✓") for c in changes):
    with open(HTML_FILE, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Archivo guardado ({len(content):,} bytes, era {original_len:,})")
else:
    print("No se hicieron cambios al archivo.")

print("\n=== RESULTADO ===")
for c in changes:
    print(c)

# Verificación final
print("\n=== VERIFICACIÓN ===")
with open(HTML_FILE, "r", encoding="utf-8") as f:
    final = f.read()
print("'patrimonio' en NAV:", "{id:'patrimonio'" in final)
print("patrimonio en render map:", "patrimonio" in final and ("renderPatrimonio" in final))
print("initialInvestment en config:", "initialInvestment" in final)
print("function renderPatrimonio:", "function renderPatrimonio" in final)
print("function saveInvestment:", "function saveInvestment" in final)
