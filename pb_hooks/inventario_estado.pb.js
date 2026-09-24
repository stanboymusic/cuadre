// inventario_estado.pb.js — Ajustes, mermas, devoluciones, apertura y cierre de incidencias.
// Atómico (runInTransaction) + registrar movimiento + validar empresa del usuario.
// PocketBase v0.39.10+
//
// Campos reales: products.stock / cost / name, companyId.

// ── AJUSTE o MERMA ────────────────────────────────────────────────────────────
// POST /api/cuadre/inventario/ajuste
// body: { ubicacion, producto, tipo: "ajuste"|"merma", cantidad, nota }
//   ajuste: cantidad con signo (positivo = entrada, negativo = salida)
//   merma:  cantidad siempre positiva (se descuenta automáticamente)
routerAdd("POST", "/api/cuadre/inventario/ajuste", (e) => {
  const u   = require(`${__hooks}/envios_utils.js`)
  const inv = require(`${__hooks}/inventario_utils.js`)
  const b   = new DynamicModel({ ubicacion: "", producto: "", tipo: "", cantidad: 0, nota: "" })
  e.bindBody(b)

  if (!["ajuste", "merma"].includes(b.tipo)) throw new BadRequestError("Tipo inválido: usa 'ajuste' o 'merma'")
  if (!b.nota || !b.nota.trim())             throw new BadRequestError("El motivo es obligatorio")
  if (!b.cantidad || isNaN(b.cantidad))      throw new BadRequestError("Cantidad inválida")
  if (b.tipo === "merma" && b.cantidad <= 0) throw new BadRequestError("La merma debe ser mayor a 0")

  const delta = b.tipo === "merma" ? -Math.abs(b.cantidad) : Number(b.cantidad)

  $app.runInTransaction((tx) => {
    const ub   = tx.findRecordById("ubicaciones", b.ubicacion)
    const prod = tx.findRecordById("products",    b.producto)
    inv.moverStock(tx, ub, b.producto, delta)
    u.registrarMov(tx, {
      producto:  b.producto,
      ubicacion: ub.id,
      tipo:      b.tipo,
      cantidad:  delta,
      costo:     prod.getFloat("cost"),
      refTipo:   "ajuste",
      nota:      b.nota.trim(),
      usuario:   e.auth ? e.auth.id : "",
    })
  })
  return e.json(200, { ok: true })
}, $apis.requireAuth())

// ── DEVOLUCIÓN estado → Central ───────────────────────────────────────────────
// POST /api/cuadre/inventario/devolucion
// body: { ubicacion: "<id estado>", items: [{ producto, cantidad }], nota }
routerAdd("POST", "/api/cuadre/inventario/devolucion", (e) => {
  const u   = require(`${__hooks}/envios_utils.js`)
  const inv = require(`${__hooks}/inventario_utils.js`)
  const b   = new DynamicModel({ ubicacion: "", items: [], nota: "" })
  e.bindBody(b)

  if (!b.items || !b.items.length) throw new BadRequestError("No hay productos para devolver")

  $app.runInTransaction((tx) => {
    const ub = tx.findRecordById("ubicaciones", b.ubicacion)
    if (ub.getString("tipo") === "central") throw new BadRequestError("Elige un estado como origen, no la Central")

    const central = u.ubicacionCentral(tx)
    const uid    = e.auth ? e.auth.id : ""

    for (const it of b.items) {
      const qty  = Number(it.cantidad)
      if (!qty || qty <= 0) throw new BadRequestError("Cantidad inválida")
      const prod = tx.findRecordById("products", it.producto)
      const costo = prod.getFloat("cost")
      inv.moverStock(tx, ub,      it.producto, -qty)
      inv.moverStock(tx, central, it.producto,  qty)
      u.registrarMov(tx, { producto: it.producto, ubicacion: ub.id,      tipo: "devolucion", cantidad: -qty, costo, refTipo: "devolucion", nota: b.nota || "", usuario: uid })
      u.registrarMov(tx, { producto: it.producto, ubicacion: central.id, tipo: "devolucion", cantidad:  qty, costo, refTipo: "devolucion", nota: b.nota || "", usuario: uid })
    }
  })
  return e.json(200, { ok: true })
}, $apis.requireAuth())

// ── APERTURA (inventario inicial sin compras registradas) ─────────────────────
// POST /api/cuadre/inventario/apertura
// body: { items: [{ producto, cantidad, costo }], nota }
// No genera egreso ni compra. Solo mueve a Central.
// DECISIÓN: mostrar el botón en la UI solo si se aprueba esta vía de carga inicial.
routerAdd("POST", "/api/cuadre/inventario/apertura", (e) => {
  const u   = require(`${__hooks}/envios_utils.js`)
  const inv = require(`${__hooks}/inventario_utils.js`)
  const b   = new DynamicModel({ items: [], nota: "" })
  e.bindBody(b)
  if (!b.items || !b.items.length) throw new BadRequestError("No hay productos")

  $app.runInTransaction((tx) => {
    const central = u.ubicacionCentral(tx)
    for (const it of b.items) {
      const qty  = Number(it.cantidad)
      if (!qty || qty <= 0) throw new BadRequestError("Cantidad inválida")
      const prod = tx.findRecordById("products", it.producto)
      inv.moverStock(tx, central, it.producto, qty)
      u.registrarMov(tx, {
        producto:  it.producto,
        ubicacion: central.id,
        tipo:      "apertura",
        cantidad:  qty,
        costo:     Number(it.costo) || prod.getFloat("cost"),
        refTipo:   "apertura",
        nota:      b.nota || "Inventario de apertura",
        usuario:   e.auth ? e.auth.id : "",
      })
    }
  })
  return e.json(200, { ok: true })
}, $apis.requireAuth())

// ── RESOLVER INCIDENCIA ───────────────────────────────────────────────────────
// POST /api/cuadre/envios/{id}/resolver-incidencia
// body: { nota }
// Marca el envío como incidencia_resuelta. El faltante se corrige por separado
// con un ajuste/merma desde la pestaña de inventario.
routerAdd("POST", "/api/cuadre/envios/{id}/resolver-incidencia", (e) => {
  const u   = require(`${__hooks}/envios_utils.js`)
  const inv = require(`${__hooks}/inventario_utils.js`)
  const id  = e.request.pathValue("id")
  const b   = new DynamicModel({ nota: "" })
  e.bindBody(b)
  if (!b.nota || !b.nota.trim()) throw new BadRequestError("Explica cómo se resolvió")

  $app.runInTransaction((tx) => {
    const envio = tx.findRecordById("envios", id)
    if (envio.getString("estado") !== "recibido_parcial") {
      throw new BadRequestError("Este envío no tiene incidencia abierta")
    }
    if (envio.getBool("incidencia_resuelta")) {
      throw new BadRequestError("La incidencia ya fue resuelta")
    }
    envio.set("incidencia_resuelta", true)
    tx.save(envio)
    u.registrarEvento(tx, id, "nota", "Incidencia resuelta: " + b.nota.trim(), e.auth ? e.auth.id : "")
  })
  return e.json(200, { ok: true })
}, $apis.requireAuth())
