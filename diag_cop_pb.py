import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
c = open('index.html', encoding='utf-8').read()

print("=== loadDB() ===")
idx = c.find("if (k === 'config') {")
if idx < 0:
    idx = c.find("if (k === \"config\") {")
if idx >= 0:
    end = c.find("}", idx) + 1
    print(repr(c[idx:end+20]))

print("\n=== save() ===")
idx2 = c.find("if (key === 'config') {")
if idx2 < 0:
    idx2 = c.find("if (key === \"config\") {")
if idx2 >= 0:
    print(repr(c[idx2:idx2+150]))
