import io

file_path = 'index.html'

with io.open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = r'${isFinal ? \`<div class="thanks">✔ CRÉDITO SALDADO EN SU TOTALIDAD<br>Gracias por su pago.</div>\` : \`<div class="thanks">Gracias por su abono.</div>\`}'
replacement = r"${isFinal ? '<div class=\"thanks\">✔ CRÉDITO SALDADO EN SU TOTALIDAD<br>Gracias por su pago.</div>' : '<div class=\"thanks\">Gracias por su abono.</div>'}"

if target in content:
    content = content.replace(target, replacement)
    with io.open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Reemplazo exitoso.")
else:
    print("No se encontró el texto objetivo.")
