// envios_utils.js — Helpers compartidos para todos los hooks de envíos.
// En el JSVM cada handler está aislado: usar require(`${__hooks}/envios_utils.js`)
// DENTRO de cada handler, nunca en el scope global del archivo de hooks.
//
// Campos reales del proyecto:
//   products.stock  (no "existencia")
//   products.cost   (no "precio_base")
//   products.name   (no "nombre")
//   Colección "products" (no "productos")

function registrarMov(app, m) {
  const col = app.findCollectionByNameOrId("movimientos_inventario")
  const r = new Record(col)
  r.set("producto",        m.producto)
  r.set("ubicacion",       m.ubicacion || "")
  r.set("tipo",            m.tipo)
  r.set("cantidad",        m.cantidad)
  r.set("costo_unitario",  m.costo   || 0)
  r.set("referencia_tipo", m.refTipo || "")
  r.set("referencia_id",   m.refId   || "")
  r.set("nota",            m.nota    || "")
  r.set("usuario",         m.usuario || "")
  app.save(r)
}

function registrarEvento(app, envioId, estado, nota, usuario) {
  const col = app.findCollectionByNameOrId("envio_eventos")
  const r = new Record(col)
  r.set("envio",   envioId)
  r.set("estado",  estado)
  r.set("nota",    nota    || "")
  r.set("usuario", usuario || "")
  app.save(r)
}

/** Devuelve la Central de la empresa del usuario autenticado. Lanza error si no existe.
 *  Acepta opcionalmente la app transaccional (tx) y el companyId explícito.
 *  Si no hay companyId (sistema de una sola empresa), devuelve cualquier central. */
function ubicacionCentral(app, companyId) {
  if (companyId) {
    return app.findFirstRecordByFilter(
      "ubicaciones",
      "tipo = 'central' && companyId = {:c}",
      { c: companyId }
    )
  }
  // Fallback: empresa única / sin aislamiento todavía configurado
  return app.findFirstRecordByFilter("ubicaciones", "tipo = 'central'")
}

/**
 * Suma (delta > 0) o resta (delta < 0) stock en una ubicación de estado.
 * Crea la fila si no existe (solo para deltas positivos).
 * Lanza BadRequestError si el resultado sería negativo.
 */
function moverStockEstado(app, ubicacionId, productoId, delta) {
  let fila
  try {
    fila = app.findFirstRecordByFilter(
      "stock_ubicacion",
      "ubicacion = {:u} && producto = {:p}",
      { u: ubicacionId, p: productoId }
    )
  } catch (_) {
    if (delta < 0) throw new BadRequestError("No hay stock de ese producto en el estado")
    const col = app.findCollectionByNameOrId("stock_ubicacion")
    fila = new Record(col)
    fila.set("ubicacion", ubicacionId)
    fila.set("producto",  productoId)
    fila.set("cantidad",  0)
  }
  const nuevo = fila.getFloat("cantidad") + delta
  if (nuevo < 0) throw new BadRequestError("Stock insuficiente en el estado")
  fila.set("cantidad", nuevo)
  app.save(fila)
}

/** Genera el próximo código ENV-XXXX en base al último registrado. */
function siguienteCodigoEnvio(app) {
  const ult = app.findRecordsByFilter("envios", "codigo != ''", "-created", 1, 0)
  let n = 0
  if (ult.length) {
    n = parseInt(ult[0].getString("codigo").replace("ENV-", ""), 10) || 0
  }
  return "ENV-" + String(n + 1).padStart(4, "0")
}

module.exports = {
  registrarMov,
  registrarEvento,
  ubicacionCentral,
  moverStockEstado,
  siguienteCodigoEnvio,
}
