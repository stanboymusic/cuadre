import os, re

store_exports = ['DB', 'pb', 'esc', 'money', 'fmtDate', 'todayISO', 'uid', 'toast', 'save', 
                 'loadDB', 'guardedRun', 'filterAndRerender', 'norm', 'smartMatch', 'defaultConfig',
                 'getProduct', 'getService', 'getClient', 'getSupplier', 'clientBalance', 
                 'salesOnDate', 'expensesOnDate', 'LOGO_ICON', 'calcPriceFromCost', 'STORE_KEYS',
                 'JSON_TEXT_FIELDS', 'parseRecord', 'serializeRecord']

app_exports = ['VIEW', 'render', 'navigate', 'openModal', 'closeModal', 'closeTopModal', 
               'modalStack', 'NAV', 'LABELS', 'todayFmt', 'toggleSidebar']

for fname in os.listdir('js'):
    if fname in ('index.js', 'store.js', 'app.js') or not fname.endswith('.js'):
        continue
    with open('js/'+fname, 'r', encoding='utf-8') as f:
        content = f.read()
    issues = []
    for name in store_exports + app_exports:
        bare_pattern = r'(?<![.\w"' + "'" + r'])' + name + r'(?!\s*=|\w)'
        if re.search(bare_pattern, content) and ('window.' + name) not in content:
            issues.append(name)
    if issues:
        print(fname + ': ' + str(issues[:8]))
