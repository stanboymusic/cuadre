# PARCHE — Productos sin inversión inicial + Envíos a Estados (Cuadre)

Backend listo en esta carpeta (migración + hooks). El frontend lo programa el agente con el prompt de abajo.
Detalle completo de pantallas, reglas y pruebas: `cuadre-envios-estados-spec.md`.

## Qué trae

| Archivo | Para qué |
|---|---|
| `pb_migrations/1790000000_envios_estados.js` | Crea `ubicaciones` (+ Central), `stock_ubicacion`, `envios`, `envio_items`, `envio_eventos`, `movimientos_inventario`, `rendiciones`. Agrega `ventas.ubicacion` y `users.ubicacion`. |
| `pb_hooks/envios_utils.js` | Helpers: movimientos, stock por estado, código ENV-0001. |
| `pb_hooks/envios.pb.js` | Rutas atómicas `despachar`, `recibir`, `cancelar` + bloqueo de edición directa. |
| `pb_hooks/ventas_estado.pb.js` | Descuenta stock del estado al vender con `ubicacion` de estado. |

## Cómo aplicarlo (en orden)

1. **Respaldo.** Copiar `pb_data` (local) y hacer snapshot del volumen en fly.io antes de migrar.
2. **Auditar nombres.** Confirmar en el repo: colecciones `productos`, `ventas`, `egresos`, `users`, la de ítems de venta (`venta_items`?) y los campos `existencia`, `precio_base`, `nombre`, `total`. Corregirlos en los 4 archivos si difieren.
3. **Versión de PocketBase.** El código es para v0.23+. Si es v0.22 o menor: en hooks usar `$app.dao()`, `routerAdd("POST", path, (c) => {...})`, `c.get("authRecord")`, `c.json(...)`, y la migración con la API `Dao`/`Collection` vieja.
4. Copiar `pb_migrations/` y `pb_hooks/` al proyecto y reiniciar PocketBase (la migración corre sola). Probar primero en local, luego en fly.io.
5. Correr las pruebas 1–9 de la sección 4 del spec.
6. Frontend con el prompt de abajo, por fases.

## Fase 0 (frontend, se despliega ya): productos sin inversión inicial

Buscar en el repo: `inversion`, `inversión`, `capital inicial`, `setup`, `onboarding`, `configuracion`.
- Quitar toda validación/redirección que bloquee Productos, Compras o crear producto si no hay inversión inicial.
- Donde se use el valor: si es `null/0/undefined`, mostrar "—" y el texto "Configura tu inversión inicial (opcional)". Cero divisiones sin comprobar.
- Dashboard: tarjeta descartable "Aún no configuraste tu inversión inicial. Es opcional." con botón Configurar.
- Guardar la inversión inicial como `{ monto, fecha, nota }` sin tocar `existencia`, compras ni egresos.
- Patrimonio se calcula igual sin ella.

## Prompt para el agente (Fases 0 a 4)

```
Trabajas en Cuadre (POS de Mantente). Backend PocketBase; frontend en Vercel.
Ya está preparado el backend del módulo "Envíos a Estados" en pb_migrations/ y pb_hooks/ (archivos adjuntos).
No reescribas ese backend salvo para corregir nombres de campos reales. Lee primero cuadre-envios-estados-spec.md.

Paso 0: audita el repo (stack, versión de PocketBase, colecciones/campos reales, dónde se valida la inversión
inicial, dónde se descuenta stock al vender, dónde se calcula el patrimonio) y dime qué supuestos fallaron.
Espera mi OK antes de tocar código.

Fase 0: la inversión inicial pasa a ser opcional (ver sección "Fase 0" de PARCHE.md).
Fase 1: aplica migración y hooks; pestaña "Estados > Ubicaciones" (CRUD de puntos y responsables).
Fase 2: "Estados > Envíos": lista con filtros, nuevo envío (destino → productos con disponible en Central →
        transportista, guía, fecha estimada), detalle con timeline y botones Despachar / Registrar recepción /
        Cancelar / Nota. Usar las rutas /api/cuadre/envios/{id}/despachar|recibir|cancelar.
        Deshabilitar el botón mientras carga (evitar doble clic).
Fase 3: "Estados > Inventario" (matriz producto × ubicación + en tránsito + total) y selector de ubicación en
        el POS. Si la venta es de un estado, el frontend NO descuenta productos.existencia (lo hace el hook).
Fase 4: "Estados > Panel" (tarjetas por estado: stock a costo, ventas del período, envíos en tránsito, saldo por
        rendir, alertas), "Ventas por estado" y "Rendiciones".

Reglas: módulos nuevos en archivos nuevos (src/modules/estados/…), sin inflar el index; mover mercancía no cambia
el patrimonio; nada de doble conteo; UI en español venezolano y responsive (celular).
Al cerrar cada fase: archivos tocados, cómo probarla y qué falta. No avances a la siguiente sin mi OK.
```

## Ojo antes de subir a producción

- Las reglas de acceso de las colecciones nuevas están en "usuario autenticado". Cuando existan vendedores de estado con login, cerrarlas por `@request.auth.ubicacion` (ver spec, sección 3.7).
- Si hoy el POS descuenta stock desde el frontend, el agente debe confirmar que no se descuenta dos veces en ventas de estado.
- Decisión pendiente tuya: carga de inventario inicial de clientes sin compras (movimiento `apertura`). El tipo ya existe en `movimientos_inventario`; falta la pantalla.
