// ventas_estado.pb.js — Descuento de stock por ubicación al registrar una venta de estado.
// PocketBase v0.23+ (probado en v0.39.10)
//
// CONTEXTO:
//   Los ítems de venta NO están en una colección separada — van en el campo JSON
//   "items" de la colección "sales". No existe "venta_items".
//
//   Formato de cada ítem en sales.items:
//     { kind: "p"|"s", refId: "<products.id>", name, qty, priceUsd, cost, tier }
//
// FLUJO CON UBICACIONES:
//   - Venta en Central (ubicacion vacío o tipo=central):
//       El FRONTEND ya descuenta products.stock → save('products').
//       Este hook NO hace nada para no duplicar.
//
//   - Venta en Estado (ubicacion con tipo=estado):
//       *** Fase 3 ***: el frontend enviará la venta con el campo "ubicacion" y
//       NO llamará save('products') para esos ítems.
//       Este hook descuenta stock_ubicacion y registra el movimiento.
//       Si el frontend YA descontó products.stock por error, lo recompone.
//
// IMPORTANTE para Fase 3 (modificación pendiente en ventas.js):
//   En finalizeSale(), cuando CART.ubicacion es de tipo "estado":
//     1. Agregar "ubicacion": CART.ubicacion al objeto "sale" antes de save('sales')
//     2. NO ejecutar la línea que hace p.stock -= it.qty para esos productos
//     3. NO llamar save('products') para evitar el doble conteo
//   El hook aquí maneja TODO lo del inventario para ventas de estado.

onRecordAfterCreateSuccess((e) => {
  const u = require(`${__hooks}/envios_utils.js`)

  // Si la venta no tiene ubicacion, es una venta en Central → el frontend la maneja
  const ubId = e.record.getString("ubicacion")
  if (!ubId) return e.next()

  // Verificar que la ubicacion es de tipo "estado"
  let ub
  try {
    ub = e.app.findRecordById("ubicaciones", ubId)
  } catch (_) { return e.next() }  // ubicacion inválida; ignorar silenciosamente
  if (ub.getString("tipo") !== "estado") return e.next()

  // Leer los ítems de la venta (campo JSON)
  let items = []
  try {
    const raw = e.record.get("items")
    items = typeof raw === "string" ? JSON.parse(raw) : (raw || [])
    if (!Array.isArray(items)) items = []
  } catch (_) { return e.next() }

  const ventaId = e.record.id
  const uid     = e.auth ? e.auth.id : ""

  for (const it of items) {
    // Solo productos (kind="p"), no servicios
    if (it.kind !== "p" || !it.refId) continue
    const qty = Number(it.qty) || 0
    if (qty <= 0) continue

    try {
      // Descontar del stock del estado
      u.moverStockEstado(e.app, ubId, it.refId, -qty)

      const prod = e.app.findRecordById("products", it.refId)
      u.registrarMov(e.app, {
        producto:  it.refId,
        ubicacion: ubId,
        tipo:      "venta",
        cantidad:  -qty,
        costo:     prod.getFloat("cost"),
        refTipo:   "venta",
        refId:     ventaId,
        usuario:   uid,
      })

      // Guarda de seguridad: si el frontend descontó products.stock por error
      // (antes de que Fase 3 corrija finalizeSale), recomponemos el valor.
      // En Fase 3 esto ya no será necesario porque el frontend no tocará
      // products.stock para ventas de estado.
      const stockActual = prod.getFloat("stock")
      if (stockActual < 0) {
        // Solo corregimos si quedó negativo — síntoma claro del doble conteo
        prod.set("stock", 0)
        e.app.save(prod)
      }
    } catch (err) {
      // Loguear pero no revertir la venta — el ajuste se puede hacer manualmente
      console.error("ventas_estado: error descontando stock del estado:", ubId, it.refId, err)
    }
  }

  return e.next()
}, "sales")
