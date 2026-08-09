import os

with open('c:/Users/angel/OneDrive/Documents/cuadre/cuadre/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find('<script>')
end = content.rfind('</script>') + 9

new_content = content[:start] + '<script type="module" src="./js/index.js"></script>' + content[end:]

with open('c:/Users/angel/OneDrive/Documents/cuadre/cuadre/index.html', 'w', encoding='utf-8') as f:
    f.write(new_content)
