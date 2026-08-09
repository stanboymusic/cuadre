import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
c = open('index.html', encoding='utf-8').read()

# 1. CART declarations
print('=== CART declarations ===')
pos = 0
found = 0
while found < 5:
    idx = c.find('CART = {', pos)
    if idx < 0: break
    print(f'  @{idx}: {repr(c[max(0,idx-10):idx+160])}')
    print()
    pos = idx + 1
    found += 1

# 2. carrito equivalente Bs block
print('=== Carrito Bs/COP block ===')
idx2 = c.find("money(totalBs,'Bs')")
if idx2 < 0:
    idx2 = c.find("money(totalBs,\\'Bs\\')")
if idx2 >= 0:
    print(repr(c[max(0,idx2-200):idx2+400]))
print()

# 3. finalizeSale payments line
print('=== finalizeSale payments/exchangeRate line ===')
idx3 = c.find('subtotalUsd, ivaUsd, totalUsd, totalBs')
if idx3 >= 0:
    print(repr(c[idx3:idx3+280]))
print()

# 4. Ticket Equiv. Bs
print('=== Ticket Equiv. Bs ===')
idx4 = c.find('Equiv. Bs.')
if idx4 >= 0:
    print(repr(c[max(0,idx4-30):idx4+250]))
