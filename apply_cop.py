#!/usr/bin/env python3
"""
Aplica el parche COP/USD (9 cambios) al index.html
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HTML_FILE = "index.html"

with open(HTML_FILE, "r", encoding="utf-8") as f:
    content = f.read()

original_len = len(content)
changes = []

def patch(name, old, new, allow_missing=False):
    global content
    if old in content:
        if new in content and old not in content:
            changes.append(f"- {name}: ya aplicado, se omite")
            return
        content = content.replace(old, new, 1)
        changes.append(f"✓ {name}")
    else:
        if allow_missing:
            changes.append(f"- {name}: patrón no encontrado (puede ya estar aplicado)")
        else:
            changes.append(f"✗ {name}: PATRÓN NO ENCONTRADO")


# ── 1. function money — soporte COP ─────────────────────────────────────────
patch(
    "1. money(): soporte COP",
    "function money(n, cur){\n  n = Number(n)||0;\n  const s = n.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2});\n  return (cur==='USD' ? '$' : 'Bs.') + ' ' + s;\n}",
    "function money(n, cur){\n  n = Number(n)||0;\n  const s = n.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2});\n  if(cur==='USD') return '$ ' + s;\n  if(cur==='COP') return 'COP$ ' + s;\n  return 'Bs. ' + s;\n}"
)

# ── 2. defaultConfig() — nuevo campo exchangeRateCop ────────────────────────
if "exchangeRateCop" in content:
    changes.append("- 2. defaultConfig: exchangeRateCop ya existe, se omite")
else:
    patch(
        "2. defaultConfig(): exchangeRateCop: 0",
        "exchangeRate: 40, iva: 16, initialInvestment: 0,",
        "exchangeRate: 40, exchangeRateCop: 0, iva: 16, initialInvestment: 0,"
    )
    if "✗" in changes[-1]:
        # Intentar sin initialInvestment (en caso de que el parche de patrimonio no se haya aplicado)
        patch(
            "2. defaultConfig(): exchangeRateCop: 0 (alt)",
            "exchangeRate: 40, iva: 16,",
            "exchangeRate: 40, exchangeRateCop: 0, iva: 16,"
        )

# ── 3. Barra superior — tasa COP ────────────────────────────────────────────
patch(
    "3. rate-pill: tasa COP",
    '<div class="rate-pill">◆ Tasa del día: <span class="mono">${DB.config.exchangeRate}</span> Bs./$</div>',
    '<div class="rate-pill">◆ Tasa del día: <span class="mono">${DB.config.exchangeRate}</span> Bs./$${DB.config.exchangeRateCop ? ` · <span class="mono">${DB.config.exchangeRateCop}</span> COP/$` : \'\'}</div>'
)

# ── 4. Formulario configuración — campo tasa COP ────────────────────────────
OLD4 = '<div class="field"><label>Tasa del día (Bs./$)</label><input id="cf_rate" type="number" step="0.01" value="${c.exchangeRate}"></div>\n          <div class="field"><label>IVA (%)</label><input id="cf_iva" type="number" step="0.01" value="${c.iva}"></div>\n        </div>'
NEW4 = '<div class="field"><label>Tasa del día (Bs./$)</label><input id="cf_rate" type="number" step="0.01" value="${c.exchangeRate}"></div>\n          <div class="field"><label>IVA (%)</label><input id="cf_iva" type="number" step="0.01" value="${c.iva}"></div>\n        </div>\n        <div class="field"><label>Tasa COP/$ (opcional — deja en 0 si no la usas)</label><input id="cf_rate_cop" type="number" step="0.01" value="${c.exchangeRateCop||0}"></div>'

if "cf_rate_cop" in content:
    changes.append("- 4. Formulario config: cf_rate_cop ya existe, se omite")
else:
    patch("4. Formulario config: campo tasa COP", OLD4, NEW4)

# ── 5. saveBizConfig() — guardar tasa COP ───────────────────────────────────
OLD5 = "DB.config.exchangeRate = Number(document.getElementById('cf_rate').value)||1;"
NEW5 = "DB.config.exchangeRate = Number(document.getElementById('cf_rate').value)||1;\n  DB.config.exchangeRateCop = Number(document.getElementById('cf_rate_cop').value)||0;"

if "exchangeRateCop = Number" in content:
    changes.append("- 5. saveBizConfig: ya guarda exchangeRateCop, se omite")
else:
    patch("5. saveBizConfig(): guardar exchangeRateCop", OLD5, NEW5)

# ── 6. Resumen de venta (carrito) — equivalente COP ─────────────────────────
OLD6 = "<div class=\"line\" style=\"display:flex;justify-content:space-between;color:var(--ink-soft);font-size:12.5px;margin-top:2px;\"><span>Equivalente</span><span class=\"amt\">${money(totalBs,'Bs')}</span></div>"
NEW6 = "<div class=\"line\" style=\"display:flex;justify-content:space-between;color:var(--ink-soft);font-size:12.5px;margin-top:2px;\"><span>Equivalente</span><span class=\"amt\">${money(totalBs,'Bs')}</span></div>\n          ${DB.config.exchangeRateCop ? `<div class=\"line\" style=\"display:flex;justify-content:space-between;color:var(--ink-soft);font-size:12.5px;\"><span>Equivalente</span><span class=\"amt\">${money(totalUsd*DB.config.exchangeRateCop,'COP')}</span></div>` : ''}"

# Buscar la versión exacta con escapes que encontramos en el diagnóstico
OLD6_ESCAPED = "<div class=\"line\" style=\"display:flex;justify-content:space-between;color:var(--ink-soft);font-size:12.5px;margin-top:2px;\"><span>Equivalente</span><span class=\"amt\">${money(totalBs,\\'Bs\\')}</span></div>"

if "totalUsd*DB.config.exchangeRateCop" in content:
    changes.append("- 6. Carrito COP: ya existe, se omite")
elif OLD6 in content:
    patch("6. Carrito: equivalente COP", OLD6, NEW6)
elif OLD6_ESCAPED in content:
    NEW6_ESCAPED = OLD6_ESCAPED + "\n          ${DB.config.exchangeRateCop ? `<div class=\"line\" style=\"display:flex;justify-content:space-between;color:var(--ink-soft);font-size:12.5px;\"><span>Equivalente</span><span class=\"amt\">${money(totalUsd*DB.config.exchangeRateCop,'COP')}</span></div>` : ''}"
    content = content.replace(OLD6_ESCAPED, NEW6_ESCAPED, 1)
    changes.append("✓ 6. Carrito: equivalente COP (con escapes)")
else:
    # Buscar con la cadena que vimos en el diagnóstico
    # "money(totalBs,'Bs')" aparece escapado como "money(totalBs,\'Bs\')"
    idx = content.find("money(totalBs,\\'Bs\\')")
    if idx >= 0:
        snippet = content[max(0,idx-150):idx+80]
        if 'margin-top:2px' in snippet:
            # Encontrar el límite del div
            start = content.rfind('<div class="line"', 0, idx)
            if start >= 0:
                end = content.find('</div>', idx) + 6
                old_snippet = content[start:end]
                new_snippet = old_snippet + "\n          ${DB.config.exchangeRateCop ? `<div class=\"line\" style=\"display:flex;justify-content:space-between;color:var(--ink-soft);font-size:12.5px;\"><span>Equivalente</span><span class=\"amt\">${money(totalUsd*DB.config.exchangeRateCop,'COP')}</span></div>` : ''}"
                content = content.replace(old_snippet, new_snippet, 1)
                changes.append("✓ 6. Carrito: equivalente COP (búsqueda dinámica)")
    else:
        changes.append("✗ 6. Carrito: patrón totalBs no encontrado")

# ── 7. finalizeSale() — guardar tasa COP ────────────────────────────────────
if "exchangeRateCop: DB.config.exchangeRateCop" in content:
    changes.append("- 7. finalizeSale: exchangeRateCop ya incluido, se omite")
else:
    patch(
        "7. finalizeSale(): guardar exchangeRateCop",
        "changeUsd, creditAmount, exchangeRate: DB.config.exchangeRate",
        "changeUsd, creditAmount, exchangeRate: DB.config.exchangeRate, exchangeRateCop: DB.config.exchangeRateCop||0"
    )

# ── 8. Ticket de venta — equivalente COP ────────────────────────────────────
OLD8 = "<div class=\"line\"><span>Equiv. Bs.</span><span>${money(sale.totalBs,'Bs')}</span></div>"
OLD8_ESCAPED = "<div class=\"line\"><span>Equiv. Bs.</span><span>${money(sale.totalBs,\\'Bs\\')}</span></div>"
NEW8_SUFFIX = "\n        ${sale.exchangeRateCop ? `<div class=\"line\"><span>Equiv. COP</span><span>${money(sale.totalUsd*sale.exchangeRateCop,'COP')}</span></div>` : ''}"

if "Equiv. COP" in content:
    changes.append("- 8. Ticket COP: ya existe, se omite")
elif OLD8 in content:
    content = content.replace(OLD8, OLD8 + NEW8_SUFFIX, 1)
    changes.append("✓ 8. Ticket: Equiv. COP añadido")
elif OLD8_ESCAPED in content:
    content = content.replace(OLD8_ESCAPED, OLD8_ESCAPED + NEW8_SUFFIX, 1)
    changes.append("✓ 8. Ticket: Equiv. COP añadido (con escapes)")
else:
    changes.append("✗ 8. Ticket: patrón sale.totalBs no encontrado")

# ── 9. Calculadora de precio — equivalente COP ──────────────────────────────
OLD9 = "preview.innerHTML = `Precio sugerido: <b>${money(price,'USD')}</b> · equivale a <b>${money(price*DB.config.exchangeRate,'Bs')}</b> a la tasa del día.`;"
NEW9 = "preview.innerHTML = `Precio sugerido: <b>${money(price,'USD')}</b> · equivale a <b>${money(price*DB.config.exchangeRate,'Bs')}</b> a la tasa del día.${DB.config.exchangeRateCop?` También: <b>${money(price*DB.config.exchangeRateCop,'COP')}</b>.`:''}` ;"

if "exchangeRateCop,'COP')" in content and "Precio sugerido" in content:
    changes.append("- 9. Calculadora: ya muestra COP, se omite")
elif OLD9 in content:
    content = content.replace(OLD9, NEW9, 1)
    changes.append("✓ 9. Calculadora: equivalente COP añadido")
else:
    # Buscar sin las comillas simples exactas
    idx9 = content.find("preview.innerHTML = `Precio sugerido:")
    if idx9 >= 0:
        end9 = content.find("`;\n", idx9) + 3
        old9_actual = content[idx9:end9]
        changes.append(f"  Patrón actual encontrado: {repr(old9_actual)}")
        new9_actual = old9_actual.rstrip(";\n").rstrip("`") + "${DB.config.exchangeRateCop?` También: <b>${money(price*DB.config.exchangeRateCop,'COP')}</b>.`:''}` ;"
        content = content.replace(old9_actual, new9_actual + "\n", 1)
        changes.append("✓ 9. Calculadora: equivalente COP añadido (búsqueda dinámica)")
    else:
        changes.append("✗ 9. Calculadora: patrón preview.innerHTML no encontrado")

# ── Guardar ──────────────────────────────────────────────────────────────────
if any(c.startswith("✓") for c in changes):
    with open(HTML_FILE, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Archivo guardado ({len(content):,} bytes, era {original_len:,})")
else:
    print("No se hicieron cambios.")

print("\n=== RESULTADO ===")
for c in changes:
    print(c)

# ── Verificación ─────────────────────────────────────────────────────────────
print("\n=== VERIFICACIÓN ===")
with open(HTML_FILE, "r", encoding="utf-8") as f:
    v = f.read()
checks = {
    "money() soporta COP": "if(cur==='COP')" in v,
    "exchangeRateCop en defaultConfig": "exchangeRateCop: 0" in v,
    "rate-pill muestra COP": "exchangeRateCop" in v and "COP/$" in v,
    "cf_rate_cop en formulario": "cf_rate_cop" in v,
    "saveBizConfig guarda COP": "exchangeRateCop = Number" in v,
    "Carrito muestra COP": "totalUsd*DB.config.exchangeRateCop" in v,
    "finalizeSale guarda COP": "exchangeRateCop: DB.config.exchangeRateCop" in v,
    "Ticket muestra COP": "Equiv. COP" in v,
    "Calculadora muestra COP": "exchangeRateCop,'COP')" in v,
}
for name, ok in checks.items():
    print(f"{'✓' if ok else '✗'} {name}")
