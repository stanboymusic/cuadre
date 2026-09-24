# PARCHE 2 — Tracking de envíos (Fase 2) + ajustes de inventario

Hecho con los nombres reales que reportó la auditoría: `products.stock / cost / name / minStock`, `sales.totalUsd` + `sales.items` (JSON), `expenses.amountUsd / type / note`, PocketBase 0.39.10, frontend vanilla (`js/*.js`, `NAV` + `renderers` en `app.js`, SDK 0.22).

## Qué trae esta carpeta

| Archivo | Para qué |
|---|---|
| `pb_hooks/inventario_utils.js` | `moverStock` (Central = `products.stock`, estados = `stock_ubicacion`), `centralDe(empresa)`, validación de empresa. |
| `pb_hooks/inventario_estado.pb.js` | Rutas: `ajuste` (ajuste/merma), `devolucion` (estado → Central), `apertura`, `resolver-incidencia`. |
| `pb_hooks/cuenta_estado.pb.js` | `GET /api/cuadre/estados/{id}/cuenta`: vendido, comisión, rendido, saldo y movimientos. |
| `js/estados-api.js` | `window.EstadosAPI`: todas las llamadas del módulo (envíos, inventario, panel, cuenta). |
| `js/estados-calc.js` | `window.EstadosCalc`: inventario total a costo, en tránsito, retrasos, saldo, chips de estado. |

Requiere que el Parche 1 (corregido por el agente) ya esté aplicado: `envios_utils.js` y las rutas `despachar/recibir/cancelar`.

## Cinco cosas que el agente debe verificar ANTES de programar la UI

1. **Multiempresa.** El repo tiene `1785806900_enforce_company_isolation.js`. Confirmar que:
   - las colecciones nuevas (`ubicaciones`, `envios`, `stock_ubicacion`, etc.) llevan el campo de empresa y las mismas reglas de aislamiento;
   - la ubicación **Central se crea por empresa**, no una sola global (el seed de la migración de Parche 1 crea una sola; si hay varias empresas, hay que crearla para cada una, y al crear una empresa nueva);
   - `ubicacionCentral()` de `envios_utils.js` y las rutas `despachar/recibir/cancelar` usan la Central **de la empresa del usuario** y validan que el envío/producto sea de su empresa (las rutas personalizadas se saltan las reglas de las colecciones).
   El nombre del campo de empresa está en la constante `EMPRESA` de `inventario_utils.js`: ajustarlo al real.
2. **Caché y stock pisado.** El frontend guarda `p.stock` desde su copia en memoria (`save('products')`). Si el servidor cambia el stock (despachar, cancelar, ajuste) y después el frontend guarda un producto viejo, **pisa el stock**. Revisar cómo funciona `save()`; después de cada acción de envío/ajuste, recargar `DB.products`, `stock_ubicacion`, `envios` y `envio_items` antes de dejar editar nada.
3. **Patrimonio.** `patrimonio.js` calcula el inventario desde `DB.products`. Al despachar, el stock de Central baja y el patrimonio bajaría con él. Debe usar `EstadosCalc.inventarioTotal({ products, stockUb, envios, envioItems })` (Central + estados + en tránsito, a `cost`). Es parte de esta fase, no de la siguiente.
4. **Ventas de estado.** Confirmar que el hook reescrito para `sales.items` (JSON) se dispara una sola vez por venta, y qué pasa al **editar o anular** una venta de estado: debe devolver el stock a ese estado, no a Central. Si el POS ya descuenta `p.stock` en `ventas.js`, no debe hacerlo cuando la venta lleva `ubicacion` de estado.
5. **Flete.** El egreso del flete debe salir con los campos reales (`amountUsd`, `type`, `note`, `date`, `ts`) y no duplicarse si se reintenta.

## Prompt para el agente (Fase 2)

```
Continúa con la Fase 2 de Cuadre: módulo Envíos. Backend PocketBase 0.39.10 (hooks v0.23+ OK), frontend vanilla JS.
Usa los archivos de esta carpeta (pb_hooks/ y js/) y respeta las convenciones de js/estados.js y app.js
(NAV, renderers, helpers de UI, modales y toasts que ya existan). No inventes helpers nuevos si ya hay equivalentes.

Antes de programar: verifica los 5 puntos de "Cosas que verificar" de PARCHE-2.md y dime qué encontraste.
Corrige lo que haga falta (multiempresa, caché, patrimonio) y espera mi OK antes de la UI si algo exige decisión.

Backend:
- Copia inventario_utils.js, inventario_estado.pb.js, cuenta_estado.pb.js a pb_hooks/. Ajusta EMPRESA al campo real.
- Agrega envios.incidencia_resuelta (bool) en una migración nueva (1790000100_...).
- Prueba cada ruta con el usuario de una empresa y confirma que NO puede tocar registros de otra.

Frontend (nuevo archivo js/estados-envios.js, cargado con <script src="./js/estados-envios.js?v=...">, además de
js/estados-api.js y js/estados-calc.js). Solo el módulo; no infles index.html ni app.js más allá de los <script>.
Pestaña "Estados > Envíos":
1. Lista: código, destino, estado (chip con EstadosCalc.ESTADO_ENVIO), guía, transportista, fecha estimada,
   costo de flete. Filtros: estado, destino, rango de fechas. Badge rojo "Retrasado" si envioRetrasado().
2. Nuevo envío: destino (solo ubicaciones tipo estado, activas) → buscador de productos con "Disponible en Central"
   (products.stock) y cantidad (no permitir más que el disponible) → transportista, guía, fecha estimada, flete →
   guardar como "preparando". Mientras esté en preparación se pueden agregar/quitar ítems.
3. Detalle: cabecera, ítems, timeline vertical de envio_eventos, y botones según estado:
   preparando → Despachar / Cancelar; en_transito → Registrar recepción / Cancelar; recibido_parcial → Resolver incidencia.
   Siempre: Agregar nota.
4. Recepción: por cada ítem, campo "recibido" prellenado con lo enviado; no permitir más que lo enviado;
   si hay diferencia mostrar el faltante en rojo antes de confirmar.
5. Cada acción: deshabilitar el botón mientras carga, mostrar el mensaje del servidor si falla (EstadosAPI.msgError),
   y al terminar recargar DB (productos, stock_ubicacion, envios, envio_items) y volver a renderizar.
6. patrimonio.js: usar EstadosCalc.inventarioTotal (ver punto 3).
Responsive: se usa desde el celular (lista en tarjetas, no tabla ancha).

Al terminar: archivos tocados, cómo probar y qué queda. No avances a la Fase 3 sin mi OK.
```

## Pruebas manuales (Fase 2)

1. Producto con 20 en Central. Nuevo envío de 8 a un estado → queda "Preparando", Central sigue en 20.
2. Despachar → Central 12, estado "En tránsito", timeline con "despachado", **patrimonio igual que antes** (salvo el flete).
3. Pedir 50 (más de lo disponible) → el formulario no lo permite; por API responde error claro y no cambia nada.
4. Recibir 6 de 8 → "Recibido parcial", stock del estado = 6, incidencia con el faltante.
5. Resolver incidencia con nota → desaparece la alerta, queda en el timeline. El faltante se corrige con un ajuste/merma.
6. Cancelar un envío en tránsito → Central recupera lo enviado.
7. Doble clic en Despachar → se aplica una sola vez.
8. Con otra empresa, intentar leer/despachar un envío ajeno (por API) → 403/404.
9. Editar un producto justo después de despachar → el stock no se pisa (punto 2).

## Después de esto

- **Fase 3:** inventario por estado (matriz producto × ubicación, ajuste, merma, devolución, apertura) y selector de ubicación en el POS.
- **Fase 4:** panel de estados (ya existe `panel_estados.pb.js`), ventas por estado, rendiciones y estado de cuenta (`cuenta_estado.pb.js`).
- **Pendiente tuyo:** decidir si el cliente puede cargar inventario de apertura (ruta ya lista, botón sin hacer). Roles de vendedor de estado (login limitado a su ubicación) queda para una fase posterior; primero confirmamos cómo se manejan usuarios y empresas hoy.
