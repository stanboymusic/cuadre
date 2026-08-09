import os, re

# Re-run the split with improved regex that catches async functions too, and strips leading spaces
with open('scratch/main.js', 'r', encoding='utf-8') as f:
    code = f.read()

os.makedirs('js', exist_ok=True)

blocks = re.split(r'/\* ============================================================\s*(.*?)\s*============================================================ \*/', code)

mapping = {
    'store.js': ['DATA LAYER', 'PRICING CALC', 'DERIVED HELPERS'],
    'app.js': ['ROUTER / STATE', 'RENDER SHELL', 'MODAL HELPERS'],
    'dashboard.js': ['DASHBOARD'],
    'ventas.js': ['VENTAS (POS)'],
    'productos.js': ['PRODUCTOS'],
    'servicios.js': ['SERVICIOS'],
    'proveedores.js': ['PROVEEDORES'],
    'compras.js': ['COMPRAS'],
    'ajustes.js': ['AJUSTES DE INVENTARIO'],
    'clientes.js': ['CLIENTES'],
    'egresos.js': ['EGRESOS'],
    'cierre.js': ['CIERRE DE CAJA'],
    'reportes.js': ['REPORTES'],
    'historial.js': ['HISTORIAL'],
    'config.js': ['CONFIG'],
    'patrimonio.js': ['PATRIMONIO NETO / BRUTO'],
}

files_content = {'store.js': blocks[0]}

for i in range(1, len(blocks), 2):
    header = blocks[i].strip()
    content = blocks[i+1]
    if header == 'INIT':
        continue  # skip, handled in index.js
    target_file = None
    for fname_key, headers in mapping.items():
        if header in headers:
            target_file = fname_key
            break
    if target_file:
        files_content[target_file] = files_content.get(target_file, '') + '\n' + content

for fname, content in files_content.items():
    # strip 4 leading spaces from each line
    stripped = '\n'.join([line[4:] if line.startswith('    ') else line for line in content.splitlines()])
    
    # find all top-level regular + async functions
    funcs = re.findall(r'^(?:async )?function\s+(\w+)', stripped, re.MULTILINE)
    # find top-level let/const/var declarations
    vars_ = re.findall(r'^(?:const|let|var)\s+(\w+)', stripped, re.MULTILINE)
    
    exports = sorted(set(funcs + vars_))
    export_code = '\n// Expose to global scope for inline HTML handlers\n'
    for exp in exports:
        export_code += 'window.' + exp + ' = ' + exp + ';\n'
    
    with open('js/' + fname, 'w', encoding='utf-8') as f:
        f.write(stripped + '\n' + export_code)

# Rewrite index.js - imports + init at the bottom
mods = ['store', 'app', 'dashboard', 'ventas', 'productos', 'servicios', 'proveedores',
        'compras', 'ajustes', 'clientes', 'egresos', 'cierre', 'reportes', 'historial', 'config', 'patrimonio']

index_content = ''
for mod in mods:
    index_content += 'import "./' + mod + '.js";\n'

index_content += '''
// Boot the app after all modules are loaded
(async function init() {
  await loadDB();
  render();
})();
'''

with open('js/index.js', 'w', encoding='utf-8') as f:
    f.write(index_content)

print('Done!')
