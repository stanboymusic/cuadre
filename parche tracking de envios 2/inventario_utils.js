// Utilidades de inventario y de multiempresa. Requiere envios_utils.js (Parche 1 corregido).
// ADAPTAR: EMPRESA = nombre real del campo de aislamiento por empresa (ver 1785806900_enforce_company_isolation.js)
//          y cómo el usuario autenticado apunta a su empresa.
const EMPRESA = "company"
const base = require(`${__hooks}/envios_utils.js`)

function empresaDe(e) {
  return e.auth ? e.auth.getString(EMPRESA) : ""
}

// Las rutas personalizadas se saltan las reglas de las colecciones: hay que validar la empresa a mano.
function exigirEmpresa(e, record) {
  const emp = empresaDe(e)
  if (emp && record.getString(EMPRESA) !== emp)
    throw new ForbiddenError("No tienes acceso a este registro")
}

// Central DE ESA EMPRESA (no la de otra)
function centralDe(app, empresa) {
  if (empresa) return app.findFirstRecordByFilter("ubicaciones", `tipo = 'central' && ${EMPRESA} = {:c}`, { c: empresa })
  return app.findFirstRecordByFilter("ubicaciones", "tipo = 'central'")
}

// Suma/resta stock en una ubicación. Central usa products.stock; los estados usan stock_ubicacion.
function moverStock(app, ubicacion, productoId, delta) {
  if (ubicacion.getString("tipo") === "central") {
    const p = app.findRecordById("products", productoId)
    const n = (p.getFloat("stock") || 0) + delta
    if (n < 0) throw new BadRequestError(`Stock insuficiente en Central de ${p.getString("name")}`)
    p.set("stock", n)
    app.save(p)
  } else {
    base.moverStockEstado(app, ubicacion.id, productoId, delta)
  }
}

module.exports = { EMPRESA, empresaDe, exigirEmpresa, centralDe, moverStock }
