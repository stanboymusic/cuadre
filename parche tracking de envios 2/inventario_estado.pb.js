// Ajustes, mermas, devoluciones a Central, inventario de apertura y cierre de incidencias.
// Todo atómico, con movimiento registrado y validando la empresa del usuario.
// Campos reales: products.stock / cost / name.

// AJUSTE o MERMA — body: { ubicacion, producto, tipo: "ajuste"|"merma", cantidad, nota }
//   ajuste: cantidad con signo. merma: cantidad positiva que se resta.
routerAdd("POST", "/api/cuadre/inventario/ajuste", (e) => {
  const u = require(`${__hooks}/envios_utils.js`)
  const inv = require(`${__hooks}/inventario_utils.js`)
  const b = new DynamicModel({ ubicacion: "", producto: "", tipo: "", cantidad: 0, nota: "" })
  e.bindBody(b)

  if (!["ajuste", "merma"].includes(b.tipo)) throw new BadRequestError("Tipo inválido")
  if (!b.nota || !b.nota.trim()) throw new BadRequestError("Escribe el motivo")
  if (!b.cantidad || isNaN(b.cantidad)) throw new BadRequestError("Cantidad inválida")
  if (b.tipo === "merma" && b.cantidad <= 0) throw new BadRequestError("La merma debe ser mayor a 0")
  const delta = b.tipo === "merma" ? -Math.abs(b.cantidad) : b.cantidad

  $app.runInTransaction((tx) => {
    const ub = tx.findRecordById("ubicaciones", b.ubicacion)
    const prod = tx.findRecordById("products", b.producto)
    inv.exigirEmpresa(e, ub)
    inv.exigirEmpresa(e, prod)
    inv.moverStock(tx, ub, b.producto, delta)
    u.registrarMov(tx, { producto: b.producto, ubicacion: ub.id, tipo: b.tipo, cantidad: delta,
      costo: prod.getFloat("cost"), refTipo: "ajuste", nota: b.nota.trim(), usuario: e.auth ? e.auth.id : "" })
  })
  return e.json(200, { ok: true })
}, $apis.requireAuth())

// DEVOLUCIÓN estado → Central — body: { ubicacion, items: [{ producto, cantidad }], nota }
routerAdd("POST", "/api/cuadre/inventario/devolucion", (e) => {
  const u = require(`${__hooks}/envios_utils.js`)
  const inv = require(`${__hooks}/inventario_utils.js`)
  const b = new DynamicModel({ ubicacion: "", items: [], nota: "" })
  e.bindBody(b)
  if (!b.items.length) throw new BadRequestError("No hay productos para devolver")

  $app.runInTransaction((tx) => {
    const ub = tx.findRecordById("ubicaciones", b.ubicacion)
    inv.exigirEmpresa(e, ub)
    if (ub.getString("tipo") === "central") throw new BadRequestError("Elige un estado, no la Central")
    const central = inv.centralDe(tx, inv.empresaDe(e) || ub.getString(inv.EMPRESA))
    const uid = e.auth ? e.auth.id : ""

    for (const it of b.items) {
      const qty = Number(it.cantidad)
      if (!qty || qty <= 0) throw new BadRequestError("Cantidad inválida")
      const prod = tx.findRecordById("products", it.producto)
      inv.exigirEmpresa(e, prod)
      const costo = prod.getFloat("cost")
      inv.moverStock(tx, ub, it.producto, -qty)
      inv.moverStock(tx, central, it.producto, qty)
      u.registrarMov(tx, { producto: it.producto, ubicacion: ub.id, tipo: "devolucion", cantidad: -qty,
        costo, refTipo: "devolucion", nota: b.nota, usuario: uid })
      u.registrarMov(tx, { producto: it.producto, ubicacion: central.id, tipo: "devolucion", cantidad: qty,
        costo, refTipo: "devolucion", nota: b.nota, usuario: uid })
    }
  })
  return e.json(200, { ok: true })
}, $apis.requireAuth())

// APERTURA (inventario inicial sin compras registradas) — body: { items: [{ producto, cantidad, costo }], nota }
// No crea egreso ni compra. Entra a Central y queda marcado "apertura".
// DECISIÓN DEL DUEÑO: si no se quiere esta vía, no mostrar el botón en el frontend.
routerAdd("POST", "/api/cuadre/inventario/apertura", (e) => {
  const u = require(`${__hooks}/envios_utils.js`)
  const inv = require(`${__hooks}/inventario_utils.js`)
  const b = new DynamicModel({ items: [], nota: "" })
  e.bindBody(b)
  if (!b.items.length) throw new BadRequestError("No hay productos")

  $app.runInTransaction((tx) => {
    const central = inv.centralDe(tx, inv.empresaDe(e))
    for (const it of b.items) {
      const qty = Number(it.cantidad)
      if (!qty || qty <= 0) throw new BadRequestError("Cantidad inválida")
      const prod = tx.findRecordById("products", it.producto)
      inv.exigirEmpresa(e, prod)
      inv.moverStock(tx, central, it.producto, qty)
      u.registrarMov(tx, { producto: it.producto, ubicacion: central.id, tipo: "apertura", cantidad: qty,
        costo: Number(it.costo) || prod.getFloat("cost"), refTipo: "apertura",
        nota: b.nota || "Inventario de apertura", usuario: e.auth ? e.auth.id : "" })
    }
  })
  return e.json(200, { ok: true })
}, $apis.requireAuth())

// RESOLVER INCIDENCIA de un envío recibido_parcial — body: { nota }
// Requiere el campo bool envios.incidencia_resuelta (agregar en migración si no existe).
// El faltante en sí se corrige aparte con ajuste/merma.
routerAdd("POST", "/api/cuadre/envios/{id}/resolver-incidencia", (e) => {
  const u = require(`${__hooks}/envios_utils.js`)
  const inv = require(`${__hooks}/inventario_utils.js`)
  const id = e.request.pathValue("id")
  const b = new DynamicModel({ nota: "" })
  e.bindBody(b)
  if (!b.nota || !b.nota.trim()) throw new BadRequestError("Explica cómo se resolvió")

  $app.runInTransaction((tx) => {
    const envio = tx.findRecordById("envios", id)
    inv.exigirEmpresa(e, envio)
    if (envio.getString("estado") !== "recibido_parcial") throw new BadRequestError("Este envío no tiene incidencia")
    envio.set("incidencia_resuelta", true)
    tx.save(envio)
    u.registrarEvento(tx, id, "nota", "Incidencia resuelta: " + b.nota.trim(), e.auth ? e.auth.id : "")
  })
  return e.json(200, { ok: true })
}, $apis.requireAuth())
