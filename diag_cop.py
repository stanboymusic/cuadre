import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
c = open('index.html', encoding='utf-8').read()

# money function full
idx = c.find('function money(n, cur)')
print('=== money fn ===')
print(repr(c[idx:idx+220]))
print()

# rate-pill in HTML (not CSS)
pos = 0
while True:
    pos = c.find('rate-pill', pos)
    if pos < 0: break
    ctx = c[pos:pos+250]
    if 'Tasa del d' in ctx:
        print('=== rate-pill in HTML ===')
        print(repr(c[max(0,pos-10):pos+280]))
        print()
        break
    pos += 1

# cf_rate field full
idx3 = c.find('cf_rate" type')
print('=== cf_rate field ===')
print(repr(c[max(0,idx3-80):idx3+380]))
print()

# totalBs carrito
idx4 = c.find("money(totalBs,'Bs')")
print('=== totalBs carrito ===')
print(repr(c[max(0,idx4-140):idx4+220]))
print()

# sale.totalBs ticket
idx5 = c.find("sale.totalBs,'Bs'")
print('=== sale.totalBs ticket ===')
print(repr(c[max(0,idx5-80):idx5+200]))
print()

# preview.innerHTML
idx6 = c.find('preview.innerHTML = ')
print('=== preview.innerHTML ===')
print(repr(c[idx6:idx6+220]))
