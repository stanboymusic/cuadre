// Rutas y hooks de envíos. PocketBase v0.23+ (si es v0.22, ver notas en PARCHE.md).

onRecordCreate((e) => {
  const u = require(`${__hooks}/envios_utils.js`)
  if (!e.record.getString("codigo")) e.record.set("codigo", u.siguienteCodigoEnvio(e.app))
  if (!e.record.getString("estado")) e.record.set("estado", "preparando")
  e.next()
}, "envios")

onRecordAfterCreateSuccess((e) => {
  const u = require(`${__hooks}/envios_utils.js`)
  u.registrarEvento(e.app, e.record.id, "creado", "Envío creado", e.auth ? e.auth.id : "")
  e.next()
}, "envios")

// Los envíos ya despachados no se editan a mano (solo por las rutas de abajo)
onRecordUpdateRequest((e) => {
  const previo = e.record.original().getString("estado")
  if (previo !== "preparando" && !e.hasSuperuserAuth())
    throw new BadRequestError("Este envío ya no se puede editar. Usa las acciones del envío.")
  // Nadie cambia el estado por API directa
  if (e.record.getString("estado") !== previo)
    throw new BadRequestError("El estado solo cambia con Despachar, Recibir o Cancelar")
  e.next()
}, "envios")

// ---------- DESPACHAR ----------
routerAdd("POST", "/api/cuadre/envios/{id}/despachar", (e) => {
  const u = require(`${__hooks}/envios_utils.js`)
  const id = e.request.pathValue("id")
  const uid = e.auth ? e.auth.id : ""

  $app.runInTransaction((tx) => {
    const envio = tx.findRecordById("envios", id)
    if (envio.getString("estado") !== "preparando")
      throw new BadRequestError("Solo se puede despachar un envío en preparación")

    const items = tx.findRecordsByFilter("envio_items", "envio = {:id}", "", 0, 0, { id })
    if (!items.length) throw new BadRequestError("El envío no tiene productos")
    const central = u.ubicacionCentral(tx)

    for (const it of items) {
      const prod = tx.findRecordById("productos", it.getString("producto"))
      const qty = it.getFloat("cantidad_enviada")
      const disp = prod.getFloat("existencia")
      if (disp < qty)
        throw new BadRequestError(`Stock insuficiente de ${prod.getString("nombre")}: hay ${disp}, pediste ${qty}`)

      prod.set("existencia", disp - qty)
      tx.save(prod)

      const costo = prod.getFloat("precio_base")
      it.set("costo_unitario", costo)
      tx.save(it)

      u.registrarMov(tx, { producto: prod.id, ubicacion: central.id, tipo: "envio_salida",
        cantidad: -qty, costo, refTipo: "envio", refId: id, usuario: uid })
    }

    // Flete = egreso real, una sola vez. ADAPTAR campos de "egresos".
    const flete = envio.getFloat("costo_flete")
    if (flete > 0 && !envio.getString("egreso")) {
      const eg = new Record(tx.findCollectionByNameOrId("egresos"))
      eg.set("concepto", "Flete envío " + envio.getString("codigo"))
      eg.set("categoria", "Fletes")
      eg.set("monto", flete)
      tx.save(eg)
      envio.set("egreso", eg.id)
    }

    envio.set("estado", "en_transito")
    envio.set("fecha_envio", new DateTime())
    tx.save(envio)
    u.registrarEvento(tx, id, "despachado", "Mercancía despachada", uid)
  })
  return e.json(200, { ok: true })
}, $apis.requireAuth())

// ---------- RECIBIR ---------- body: { items: [{ id, cantidad_recibida }], nota }
routerAdd("POST", "/api/cuadre/envios/{id}/recibir", (e) => {
  const u = require(`${__hooks}/envios_utils.js`)
  const id = e.request.pathValue("id")
  const uid = e.auth ? e.auth.id : ""
  const body = new DynamicModel({ items: [], nota: "" })
  e.bindBody(body)

  $app.runInTransaction((tx) => {
    const envio = tx.findRecordById("envios", id)
    if (envio.getString("estado") !== "en_transito")
      throw new BadRequestError("El envío no está en tránsito")

    if (e.auth && e.auth.getString("rol") === "vendedor_estado" &&
        e.auth.getString("ubicacion") !== envio.getString("destino"))
      throw new ForbiddenError("Este envío no es de tu ubicación")

    const destino = envio.getString("destino")
    const items = tx.findRecordsByFilter("envio_items", "envio = {:id}", "", 0, 0, { id })
    const recibido = {}
    for (const r of body.items) recibido[r.id] = Number(r.cantidad_recibida)

    let dif = false
    const detalle = []
    for (const it of items) {
      const enviada = it.getFloat("cantidad_enviada")
      const rec = recibido[it.id] !== undefined ? recibido[it.id] : enviada
      if (isNaN(rec) || rec < 0) throw new BadRequestError("Cantidad recibida inválida")
      if (rec > enviada) throw new BadRequestError("No puedes recibir más de lo enviado; registra una incidencia")

      it.set("cantidad_recibida", rec)
      tx.save(it)

      if (rec > 0) {
        u.moverStockEstado(tx, destino, it.getString("producto"), rec)
        u.registrarMov(tx, { producto: it.getString("producto"), ubicacion: destino, tipo: "envio_entrada",
          cantidad: rec, costo: it.getFloat("costo_unitario"), refTipo: "envio", refId: id, usuario: uid })
      }
      if (rec < enviada) {
        dif = true
        const p = tx.findRecordById("productos", it.getString("producto"))
        detalle.push(`${p.getString("nombre")}: enviadas ${enviada}, recibidas ${rec}`)
      }
    }

    envio.set("estado", dif ? "recibido_parcial" : "recibido")
    envio.set("fecha_recepcion", new DateTime())
    envio.set("recibido_por", uid)
    tx.save(envio)
    u.registrarEvento(tx, id, dif ? "incidencia" : "recibido",
      dif ? "Diferencias: " + detalle.join(" | ") : (body.nota || "Recibido completo"), uid)
  })
  return e.json(200, { ok: true })
}, $apis.requireAuth())

// ---------- CANCELAR ----------
routerAdd("POST", "/api/cuadre/envios/{id}/cancelar", (e) => {
  const u = require(`${__hooks}/envios_utils.js`)
  const id = e.request.pathValue("id")
  const uid = e.auth ? e.auth.id : ""

  $app.runInTransaction((tx) => {
    const envio = tx.findRecordById("envios", id)
    const estado = envio.getString("estado")
    if (estado !== "preparando" && estado !== "en_transito")
      throw new BadRequestError("Este envío ya no se puede cancelar")

    if (estado === "en_transito") {
      const central = u.ubicacionCentral(tx)
      const items = tx.findRecordsByFilter("envio_items", "envio = {:id}", "", 0, 0, { id })
      for (const it of items) {
        const prod = tx.findRecordById("productos", it.getString("producto"))
        const qty = it.getFloat("cantidad_enviada")
        prod.set("existencia", prod.getFloat("existencia") + qty)
        tx.save(prod)
        u.registrarMov(tx, { producto: prod.id, ubicacion: central.id, tipo: "cancelacion_envio",
          cantidad: qty, costo: it.getFloat("costo_unitario"), refTipo: "envio", refId: id, usuario: uid })
      }
    }
    envio.set("estado", "cancelado")
    tx.save(envio)
    u.registrarEvento(tx, id, "cancelado", "Envío cancelado", uid)
  })
  return e.json(200, { ok: true })
}, $apis.requireAuth())
