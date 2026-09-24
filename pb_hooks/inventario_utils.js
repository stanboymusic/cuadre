// inventario_utils.js — Multiempresa + movimiento de stock unificado.
// Requiere envios_utils.js (Parche 1 corregido).
//
// CAMPO REAL: "companyId" (confirmado en 1785806800_add_companies_multitenancy.js
//             y en 1785806900_enforce_company_isolation.js).
// Originalmente el parche 2 tenía EMPRESA = "company" — corregido aquí.

const EMPRESA = "companyId"
const base = require(`${__hooks}/envios_utils.js`)

/** Extrae el companyId del usuario autenticado en la petición. */
function empresaDe(e) {
  return e.auth ? e.auth.getString(EMPRESA) : ""
}

/**
 * Valida que el record pertenece a la empresa del usuario.
 * Las rutas personalizadas se saltan las reglas de las colecciones;
 * sin esta verificación, una empresa podría leer/modificar datos de otra.
 */
function exigirEmpresa(e, record) {
  const emp = empresaDe(e)
  if (emp && record.getString(EMPRESA) !== emp) {
    throw new ForbiddenError("No tienes acceso a este registro")
  }
}

/**
 * Central de una empresa concreta (no la de otra).
 * usa ubicacionCentral(app, companyId) del Parche 1 corregido.
 */
function centralDe(app, companyId) {
  return base.ubicacionCentral(app, companyId || "")
}

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

module.exports = { EMPRESA, empresaDe, exigirEmpresa, centralDe, moverStock }
