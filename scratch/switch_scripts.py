with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

files = ['store', 'app', 'dashboard', 'ventas', 'productos', 'servicios', 'proveedores',
         'compras', 'ajustes', 'clientes', 'egresos', 'cierre', 'reportes', 'historial', 'config', 'patrimonio']

lines = ['  <script src="./js/' + f + '.js"></script>' for f in files]
lines.append('  <script>')
lines.append('    (async function init() { await loadDB(); render(); })();')
lines.append('  </script>')
script_tags = '\n'.join(lines)

old_script = '<script type="module" src="./js/index.js"></script>'
new_content = content.replace(old_script, script_tags)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Done! Switched to classic multi-script loading.')
