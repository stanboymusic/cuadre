import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
c = open('index.html', encoding='utf-8').read()

print('=== CSS Block ===')
idx1 = c.find('.main{')
if idx1 >= 0:
    end1 = c.find('.content{', idx1)
    if end1 >= 0:
        end1 = c.find('}', end1) + 1
        print(repr(c[idx1:end1]))

print('\n=== render() sidebar ===')
idx2 = c.find('<div class="sidebar no-print">')
if idx2 >= 0:
    print(repr(c[max(0, idx2-40):idx2+80]))

print('\n=== render() topbar h1 ===')
idx3 = c.find('<h1>${LABELS[VIEW]||\\\'\\\'}</h1>')
if idx3 < 0:
    idx3 = c.find('<h1>${LABELS[VIEW]||""}</h1>')
if idx3 < 0:
    idx3 = c.find("<h1>${LABELS[VIEW]||''}</h1>")
if idx3 >= 0:
    print(repr(c[max(0, idx3-40):idx3+80]))

print('\n=== navigate() function ===')
idx4 = c.find('function navigate(view)')
if idx4 >= 0:
    # Need to find the end of the function carefully since it might have nested braces or just be a simple one.
    # In minified code, it might be `function navigate(v){...}`
    end4 = c.find('}', idx4) + 1
    print(repr(c[max(0,idx4-20):end4+80]))
else:
    idx4_alt = c.find('function navigate(')
    if idx4_alt >= 0:
        end4 = c.find('}', idx4_alt) + 1
        print(repr(c[max(0,idx4_alt-20):end4+80]))
