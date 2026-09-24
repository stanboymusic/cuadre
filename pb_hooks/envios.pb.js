// envios.pb.js — Rutas atómicas y hooks del módulo de Envíos a Estados.
// PocketBase v0.23+ (probado en v0.39.10).
//
// Correcciones vs. borrador del parche:
//   - Colección "products" (no "productos")
//   - Campo products.stock        (no "existencia")
//   - Campo products.cost         (no "precio_base")
//   - Campo products.name         (no "nombre")
//   - Colección "expenses"        (no "egresos")
//   - expenses.amountUsd          (no "monto")
//   - expenses.type               (no "categoria")
//   - expenses.note               (no "concepto")
//   - expenses requiere date y ts para aparecer en el frontend

// ── Auto-completar código y estado inicial al crear un envío ──────────────────
onRecordCreate((e) => {
  const u = require(`${__hooks}/envios_utils.js`)
  if (!e.record.getString("codigo")) {
    e.record.set("codigo", u.siguienteCodigoEnvio(e.app))
  }
  if (!e.record.getString("estado")) {
    e.record.set("estado", "preparando")
  }
  e.next()
}, "envios")

// ── Primer evento en el timeline ──────────────────────────────────────────────
onRecordAfterCreateSuccess((e) => {
  const u = require(`${__hooks}/envios_utils.js`)
  u.registrarEvento(e.app, e.record.id, "creado", "Envío creado", e.auth ? e.auth.id : "")
  e.next()
}, "envios")

// ── Bloquear edición directa de envíos ya despachados ────────────────────────
onRecordUpdateRequest((e) => {
  const previo = e.record.original().getString("estado")
  if (previo !== "preparando" && !e.hasSuperuserAuth()) {
    throw new BadRequestError("Este envío ya no se puede editar. Usa las acciones Despachar / Recibir / Cancelar.")
  }
  // Nadie cambia el estado directamente por API; solo por las rutas de abajo
  if (e.record.getString("estado") !== previo) {
    throw new BadRequestError("El estado solo cambia con Despachar, Recibir o Cancelar.")
  }
  e.next()
}, "envios")

// ── DESPACHAR ─────────────────────────────────────────────────────────────────
// POST /api/cuadre/envios/{id}/despachar
routerAdd("POST", "/api/cuadre/envios/{id}/despachar", (e) => {
  const u   = require(`${__hooks}/envios_utils.js`)
  const id  = e.request.pathValue("id")
  const uid = e.auth ? e.auth.id : ""
  const cid = e.auth ? e.auth.getString("companyId") : ""  // Punto 1: empresa del usuario

  $app.runInTransaction((tx) => {
    const envio = tx.findRecordById("envios", id)

    // Punto 1: validar que el envío es de la misma empresa
    if (cid && envio.getString("companyId") !== cid)
      throw new ForbiddenError("No tienes acceso a este envío")

    if (envio.getString("estado") !== "preparando") {
      throw new BadRequestError("Solo se puede despachar un envío en preparación")
    }

    const items = tx.findRecordsByFilter("envio_items", "envio = {:id}", "", 0, 0, { id })
    if (!items.length) throw new BadRequestError("El envío no tiene productos")

    // Punto 1: Central de la empresa del usuario (no la de otra empresa)
    const central = u.ubicacionCentral(tx, cid)

    for (const it of items) {
      // Nombres de campos reales: "products", products.stock, products.cost, products.name
      const prod  = tx.findRecordById("products", it.getString("producto"))
      const qty   = it.getFloat("cantidad_enviada")
      const disp  = prod.getFloat("stock")

      // Punto 1: validar que el producto es de la empresa
      if (cid && prod.getString("companyId") !== cid)
        throw new ForbiddenError("Producto fuera de tu empresa")

      if (disp < qty) {
        throw new BadRequestError(
          `Stock insuficiente de "${prod.getString("name")}": hay ${disp}, necesitas ${qty}`
        )
      }

      prod.set("stock", disp - qty)
      tx.save(prod)

      const costo = prod.getFloat("cost")
      it.set("costo_unitario", costo)
      tx.save(it)

      u.registrarMov(tx, {
        producto: prod.id, ubicacion: central.id, tipo: "envio_salida",
        cantidad: -qty, costo, refTipo: "envio", refId: id, usuario: uid,
      })
    }

    // ── Flete = egreso real, una sola vez ─────────────────────────────────────
    // Si costo_flete > 0 y aún no hay egreso creado (idempotente ante reintentos)
    const flete = envio.getFloat("costo_flete")
    if (flete > 0 && !envio.getString("egreso")) {
      const colExp = tx.findCollectionByNameOrId("expenses")
      const eg = new Record(colExp)
      // Campos reales de "expenses":
      eg.set("type",      "Fletes")
      eg.set("note",      "Flete envío " + envio.getString("codigo"))
      eg.set("amountUsd", flete)
      eg.set("method",    "")
      eg.set("date",      new DateTime().string().slice(0, 10)) // YYYY-MM-DD
      eg.set("ts",        Date.now())
      // Propagar companyId del usuario que despacha (necesario para multitenancy)
      if (uid) {
        try {
          const user = tx.findRecordById("users", uid)
          const cid  = user.getString("companyId")
          if (cid) eg.set("companyId", cid)
        } catch (_) {}
      }
      tx.save(eg)
      envio.set("egreso", eg.id)
    }

    envio.set("estado",     "en_transito")
    envio.set("fecha_envio", new DateTime())
    tx.save(envio)
    u.registrarEvento(tx, id, "despachado", "Mercancía despachada", uid)
  })

  return e.json(200, { ok: true })
}, $apis.requireAuth())

// ── RECIBIR ───────────────────────────────────────────────────────────────────
// POST /api/cuadre/envios/{id}/recibir
// Body: { items: [{ id: "<envio_item_id>", cantidad_recibida: 5 }], nota: "" }
routerAdd("POST", "/api/cuadre/envios/{id}/recibir", (e) => {
  const u   = require(`${__hooks}/envios_utils.js`)
  const id  = e.request.pathValue("id")
  const uid = e.auth ? e.auth.id : ""
  const cid = e.auth ? e.auth.getString("companyId") : ""  // Punto 1
  const body = new DynamicModel({ items: [], nota: "" })
  e.bindBody(body)

  $app.runInTransaction((tx) => {
    const envio = tx.findRecordById("envios", id)

    // Punto 1: validar empresa
    if (cid && envio.getString("companyId") !== cid)
      throw new ForbiddenError("No tienes acceso a este envío")

    if (envio.getString("estado") !== "en_transito") {
      throw new BadRequestError("El envío no está en tránsito")
    }

    // Permiso: vendedor de estado solo puede recibir su propio envío
    if (e.auth && e.auth.getString("rol") === "vendedor_estado" &&
        e.auth.getString("ubicacion") !== envio.getString("destino")) {
      throw new ForbiddenError("Este envío no es de tu ubicación")
    }

    const destino = envio.getString("destino")
    const items   = tx.findRecordsByFilter("envio_items", "envio = {:id}", "", 0, 0, { id })

    // Índice de cantidades recibidas enviadas en el body
    const recibidoMap = {}
    for (const r of body.items) recibidoMap[r.id] = Number(r.cantidad_recibida)

    let hayDiferencias = false
    const detalle      = []

    for (const it of items) {
      const enviada = it.getFloat("cantidad_enviada")
      const rec = recibidoMap[it.id] !== undefined ? recibidoMap[it.id] : enviada

      if (isNaN(rec) || rec < 0) throw new BadRequestError("Cantidad recibida inválida")
      if (rec > enviada)         throw new BadRequestError("No puedes recibir más de lo enviado; registra una incidencia")

      it.set("cantidad_recibida", rec)
      tx.save(it)

      if (rec > 0) {
        u.moverStockEstado(tx, destino, it.getString("producto"), rec)
        u.registrarMov(tx, {
          producto: it.getString("producto"), ubicacion: destino, tipo: "envio_entrada",
          cantidad: rec, costo: it.getFloat("costo_unitario"), refTipo: "envio", refId: id, usuario: uid,
        })
      }

      if (rec < enviada) {
        hayDiferencias = true
        // Nombre real del campo: "name" (no "nombre")
        const prod = tx.findRecordById("products", it.getString("producto"))
        detalle.push(`${prod.getString("name")}: enviadas ${enviada}, recibidas ${rec}`)
      }
    }

    const estadoFinal = hayDiferencias ? "recibido_parcial" : "recibido"
    envio.set("estado",          estadoFinal)
    envio.set("fecha_recepcion", new DateTime())
    envio.set("recibido_por",    uid)
    tx.save(envio)

    u.registrarEvento(
      tx, id,
      hayDiferencias ? "incidencia" : "recibido",
      hayDiferencias ? "Diferencias: " + detalle.join(" | ") : (body.nota || "Recibido completo"),
      uid
    )
  })

  return e.json(200, { ok: true })
}, $apis.requireAuth())

// ── CANCELAR ──────────────────────────────────────────────────────────────────
// POST /api/cuadre/envios/{id}/cancelar
// Si estaba en_transito, devuelve el stock a Central y registra movimientos.
routerAdd("POST", "/api/cuadre/envios/{id}/cancelar", (e) => {
  const u   = require(`${__hooks}/envios_utils.js`)
  const id  = e.request.pathValue("id")
  const uid = e.auth ? e.auth.id : ""
  const cid = e.auth ? e.auth.getString("companyId") : ""  // Punto 1

  $app.runInTransaction((tx) => {
    const envio  = tx.findRecordById("envios", id)
    const estado = envio.getString("estado")

    // Punto 1: validar empresa
    if (cid && envio.getString("companyId") !== cid)
      throw new ForbiddenError("No tienes acceso a este envío")

    if (estado !== "preparando" && estado !== "en_transito") {
      throw new BadRequestError("Este envío ya no se puede cancelar")
    }

    if (estado === "en_transito") {
      // Punto 1: Central de la empresa
      const central = u.ubicacionCentral(tx, cid)
      const items   = tx.findRecordsByFilter("envio_items", "envio = {:id}", "", 0, 0, { id })

      for (const it of items) {
        // Campo real: products.stock
        const prod = tx.findRecordById("products", it.getString("producto"))
        const qty  = it.getFloat("cantidad_enviada")
        prod.set("stock", prod.getFloat("stock") + qty)
        tx.save(prod)

        u.registrarMov(tx, {
          producto: prod.id, ubicacion: central.id, tipo: "cancelacion_envio",
          cantidad: qty, costo: it.getFloat("costo_unitario"), refTipo: "envio", refId: id, usuario: uid,
        })
      }
    }

    envio.set("estado", "cancelado")
    tx.save(envio)
    u.registrarEvento(tx, id, "cancelado", "Envío cancelado", uid)
  })

  return e.json(200, { ok: true })
}, $apis.requireAuth())

// ── AGREGAR NOTA al timeline ───────────────────────────────────────────────────
// POST /api/cuadre/envios/{id}/nota  — body: { nota: "texto" }
routerAdd("POST", "/api/cuadre/envios/{id}/nota", (e) => {
  const u   = require(`${__hooks}/envios_utils.js`)
  const id  = e.request.pathValue("id")
  const uid = e.auth ? e.auth.id : ""
  const body = new DynamicModel({ nota: "" })
  e.bindBody(body)

  if (!body.nota || !body.nota.trim()) {
    throw new BadRequestError("La nota no puede estar vacía")
  }

  // Verificar que el envío existe
  $app.findRecordById("envios", id)
  u.registrarEvento($app, id, "nota", body.nota.trim(), uid)

  return e.json(200, { ok: true })
}, $apis.requireAuth())
