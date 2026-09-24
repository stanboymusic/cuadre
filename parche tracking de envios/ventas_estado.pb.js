// Descuento de stock por ubicación al vender.
// ADAPTAR: nombre de la colección de ítems de venta ("venta_items") y sus campos (venta, producto, cantidad).
// IMPORTANTE: este hook solo actúa cuando la venta tiene ubicación de tipo "estado".
// Para ventas en Central, el flujo actual del POS no cambia.
// El frontend NO debe descontar productos.existencia cuando la venta es de un estado (verificar en la auditoría).

onRecordCreate((e) => {
  const u = require(`${__hooks}/envios_utils.js`)
  e.next() // se guarda dentro de la transacción; si algo falla abajo, todo se revierte

  const venta = e.app.findRecordById("ventas", e.record.getString("venta"))
  const ubId = venta.getString("ubicacion")
  if (!ubId) return

  const ub = e.app.findRecordById("ubicaciones", ubId)
  if (ub.getString("tipo") !== "estado") return

  const prodId = e.record.getString("producto")
  const qty = e.record.getFloat("cantidad")
  u.moverStockEstado(e.app, ubId, prodId, -qty)

  const prod = e.app.findRecordById("productos", prodId)
  u.registrarMov(e.app, { producto: prodId, ubicacion: ubId, tipo: "venta", cantidad: -qty,
    costo: prod.getFloat("precio_base"), refTipo: "venta", refId: venta.id,
    usuario: e.auth ? e.auth.id : "" })
}, "venta_items")
