import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
c = open('index.html', encoding='utf-8').read()
original_len = len(c)
changes = []

old1 = "if (k === 'config') {\n        const records = await pb.collection(k).getFullList();\n        return [k, records.length > 0 ? parseRecord(k, records[0]) : null];\n      }"
new1 = "if (k === 'config') {\n        const records = await pb.collection(k).getFullList();\n        if (records.length === 0) return [k, null];\n        const parsed = parseRecord(k, records[0]);\n        parsed.exchangeRateCop = parsed.cop || 0;\n        return [k, parsed];\n      }"

if "parsed.exchangeRateCop = parsed.cop" in c:
    changes.append("✓ loadDB ya parcheado")
elif old1 in c:
    c = c.replace(old1, new1, 1)
    changes.append("✓ loadDB actualizado")
else:
    changes.append("x loadDB no encontrado")


old2 = "if (key === 'config') {\n      const existing = await pb.collection(key).getFullList();\n      const data = serializeRecord(key, DB.config);\n      if (e"
new2 = "if (key === 'config') {\n      const existing = await pb.collection(key).getFullList();\n      const data = serializeRecord(key, DB.config);\n      data.cop = DB.config.exchangeRateCop || 0;\n      delete data.exchangeRateCop;\n      if (e"

if "data.cop = DB.config.exchangeRateCop || 0;" in c:
    changes.append("✓ save() ya parcheado")
elif old2 in c:
    c = c.replace(old2, new2, 1)
    changes.append("✓ save() actualizado")
else:
    changes.append("x save() no encontrado")

if any(ch.startswith("✓") for ch in changes) and not all("ya parcheado" in ch for ch in changes):
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(c)
    print(f"Archivo guardado ({len(c):,} bytes, era {original_len:,})")
else:
    print("No se hicieron cambios.")
for ch in changes:
    print(ch)
