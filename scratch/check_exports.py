import os, re

# Collect all exported window.X names
exports = set()
for f in os.listdir('js'):
    if f.endswith('.js'):
        with open('js/'+f, 'r', encoding='utf-8') as file:
            for line in file:
                m = re.match(r'window\.(\w+)\s*=', line.strip())
                if m:
                    exports.add(m.group(1))

print('Exported count:', len(exports))

# Find all inline handler function calls in all js files
calls = set()
for f in os.listdir('js'):
    if f.endswith('.js'):
        with open('js/'+f, 'r', encoding='utf-8') as file:
            content = file.read()
        found = re.findall(r'onclick=\\"(\w+)\(', content)
        found += re.findall(r'onchange=\\"(\w+)\(', content)
        found += re.findall(r'oninput=\\"(\w+)\(', content)
        calls.update(found)

missing = calls - exports
print('Called but NOT exported:', sorted(missing))
