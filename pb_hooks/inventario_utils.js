// inventario_utils.js — Movimiento de stock unificado.
// Requiere envios_utils.js (Parche 1).

const base = require(`${__hooks}/envios_utils.js`)

/**
 * Mueve stock en una ubicación genérica.
 *   - Central (tipo = "central") → modifica products.stock
 *   - Estado                      → modifica stock_ubicacion
 * Delega en base.moverStockEstado para el caso de estado.
 */
function moverStock(app, ubicacion, productoId, delta) {
  if (ubicacion.getString("tipo") === "central") {
    const p = app.findRecordById("products", productoId)
    const n = (p.getFloat("stock") || 0) + delta
    if (n < 0) throw new BadRequestError(`Stock insuficiente en Central de "${p.getString("name")}"`)
    p.set("stock", n)
    app.save(p)
  } else {
    base.moverStockEstado(app, ubicacion.id, productoId, delta)
  }
}

module.exports = { moverStock }
