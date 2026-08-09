import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
c = open('index.html', encoding='utf-8').read()
original_len = len(c)
changes = []

# 1. CART declarations
old_cart_1 = "let CART = { items:[], clientId:'', vendor: (DB.config&&DB.config.vendors&&DB.config.vendors[0])||'', payments:[], lastTicket:null, priceTier:'price' };"
new_cart_1 = "let CART = { items:[], clientId:'', vendor: (DB.config&&DB.config.vendors&&DB.config.vendors[0])||'', payments:[], lastTicket:null, priceTier:'price', showBs:false, showCop:false };"
if old_cart_1 in c:
    c = c.replace(old_cart_1, new_cart_1, 1)
    changes.append("✓ CART 1")
    
old_cart_2 = "CART = { items:[], clientId:'', vendor:DB.config.vendors[0]||'', payments:[], lastTicket:null, priceTier:'price' };"
new_cart_2 = "CART = { items:[], clientId:'', vendor:DB.config.vendors[0]||'', payments:[], lastTicket:null, priceTier:'price', showBs:false, showCop:false };"
if old_cart_2 in c:
    c = c.replace(old_cart_2, new_cart_2, 1)
    changes.append("✓ CART 2")
    
old_cart_3 = "CART = { items:[], clientId:'', vendor:CART.vendor, payments:[], lastTicket:null, priceTier:'price' };"
new_cart_3 = "CART = { items:[], clientId:'', vendor:CART.vendor, payments:[], lastTicket:null, priceTier:'price', showBs:false, showCop:false };"
if old_cart_3 in c:
    c = c.replace(old_cart_3, new_cart_3, 1)
    changes.append("✓ CART 3")

# 2. Carrito Bs/COP block
old_carrito = """<div class="line" style="display:flex;justify-content:space-between;color:var(--ink-soft);font-size:12.5px;margin-top:2px;"><span>Equivalente</span><span class="amt">${money(totalBs,'Bs')}</span></div>\n          ${DB.config.exchangeRateCop ? `<div class="line" style="display:flex;justify-content:space-between;color:var(--ink-soft);font-size:12.5px;"><span>Equivalente</span><span class="amt">${money(totalUsd*DB.config.exchangeRateCop,'COP')}</span></div>` : ''}"""
new_carrito = """<div class="line" style="display:flex;justify-content:space-between;color:var(--ink-soft);font-size:12.5px;margin-top:2px;"><span>Equivalente</span><span class="amt">${money(totalBs,'Bs')}</span></div>
          <div class="field" style="display:flex;gap:14px;margin:8px 0 0;">
            <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:400;"><input type="checkbox" ${CART.showBs?'checked':''} onchange="CART.showBs=this.checked; render()"> Incluir Bs. en la factura</label>
            ${DB.config.exchangeRateCop ? `<label style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:400;"><input type="checkbox" ${CART.showCop?'checked':''} onchange="CART.showCop=this.checked; render()"> Incluir COP en la factura</label>` : ''}
          </div>
          <div class="hint" style="font-size:11px;margin-top:2px;">El equivalente de arriba es solo referencia para ti al cobrar. Solo aparece en la factura impresa lo que marques aquí — el dólar es siempre la moneda principal.</div>"""
if old_carrito in c:
    c = c.replace(old_carrito, new_carrito, 1)
    changes.append("✓ Carrito checkboxes")
else:
    changes.append("x Carrito checkboxes not found")

# 3. finalizeSale payments line
old_finalize = """subtotalUsd, ivaUsd, totalUsd, totalBs, payments: CART.payments.map(p=>({...p})),\n    changeUsd, creditAmount, exchangeRate: DB.config.exchangeRate, exchangeRateCop: DB.config.exchangeRateCop||0"""
new_finalize = """subtotalUsd, ivaUsd, totalUsd, totalBs, payments: CART.payments.map(p=>({...p})),
    changeUsd, creditAmount, exchangeRate: DB.config.exchangeRate, exchangeRateCop: DB.config.exchangeRateCop||0,
    showBs: !!CART.showBs, showCop: !!(CART.showCop && DB.config.exchangeRateCop)"""
if old_finalize in c:
    c = c.replace(old_finalize, new_finalize, 1)
    changes.append("✓ finalizeSale")
else:
    changes.append("x finalizeSale not found")

# 4. Ticket Equiv. Bs
old_ticket = """<div class="line"><span>Equiv. Bs.</span><span>${money(sale.totalBs,'Bs')}</span></div>\n        ${sale.exchangeRateCop ? `<div class="line"><span>Equiv. COP</span><span>${money(sale.totalUsd*sale.exchangeRateCop,'COP')}</span></div>` : ''}"""
new_ticket = """${sale.showBs ? `<div class="line"><span>Equiv. Bs.</span><span>${money(sale.totalBs,'Bs')}</span></div>` : ''}
        ${sale.showCop ? `<div class="line"><span>Equiv. COP</span><span>${money(sale.totalUsd*sale.exchangeRateCop,'COP')}</span></div>` : ''}"""
if old_ticket in c:
    c = c.replace(old_ticket, new_ticket, 1)
    changes.append("✓ Ticket")
else:
    changes.append("x Ticket not found")

if any(ch.startswith("✓") for ch in changes):
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(c)
    print(f"Archivo guardado ({len(c):,} bytes, era {original_len:,})")
else:
    print("No se hicieron cambios.")
for ch in changes:
    print(ch)
