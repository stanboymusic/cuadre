// Helpers compartidos. En el JSVM cada handler está aislado: usar require(`${__hooks}/envios_utils.js`) DENTRO del handler.
// ADAPTAR: campos de "productos" (existencia, precio_base, nombre).

function registrarMov(app, m) {
  const r = new Record(app.findCollectionByNameOrId("movimientos_inventario"))
  r.set("producto", m.producto)
  r.set("ubicacion", m.ubicacion)
  r.set("tipo", m.tipo)
  r.set("cantidad", m.cantidad)
  r.set("costo_unitario", m.costo || 0)
  r.set("referencia_tipo", m.refTipo || "")
  r.set("referencia_id", m.refId || "")
  r.set("nota", m.nota || "")
  r.set("usuario", m.usuario || "")
  app.save(r)
}

function registrarEvento(app, envioId, estado, nota, usuario) {
  const r = new Record(app.findCollectionByNameOrId("envio_eventos"))
  r.set("envio", envioId)
  r.set("estado", estado)
  r.set("nota", nota || "")
  r.set("usuario", usuario || "")
  app.save(r)
}

function ubicacionCentral(app) {
  return app.findFirstRecordByFilter("ubicaciones", "tipo = 'central'")
}

// Suma/resta stock en un estado. Error si quedaría negativo.
function moverStockEstado(app, ubicacionId, productoId, delta) {
  let fila
  try {
    fila = app.findFirstRecordByFilter("stock_ubicacion", "ubicacion = {:u} && producto = {:p}", { u: ubicacionId, p: productoId })
  } catch (_) {
    if (delta < 0) throw new BadRequestError("No hay stock de ese producto en el estado")
    fila = new Record(app.findCollectionByNameOrId("stock_ubicacion"))
    fila.set("ubicacion", ubicacionId)
    fila.set("producto", productoId)
    fila.set("cantidad", 0)
  }
  const nuevo = fila.getFloat("cantidad") + delta
  if (nuevo < 0) throw new BadRequestError("Stock insuficiente en el estado")
  fila.set("cantidad", nuevo)
  app.save(fila)
}

function siguienteCodigoEnvio(app) {
  const ult = app.findRecordsByFilter("envios", "codigo != ''", "-created", 1, 0)
  let n = 0
  if (ult.length) n = parseInt(ult[0].getString("codigo").replace("ENV-", ""), 10) || 0
  return "ENV-" + String(n + 1).padStart(4, "0")
}

module.exports = { registrarMov, registrarEvento, ubicacionCentral, moverStockEstado, siguienteCodigoEnvio }
