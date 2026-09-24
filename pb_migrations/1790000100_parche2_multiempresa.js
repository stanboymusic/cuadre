/// <reference path="../pb_data/types.d.ts" />
// Migración: Parche 2 — multiempresa en colecciones de estados +
//            campo envios.incidencia_resuelta + Central por empresa.
// Requiere: Parche 1 ya aplicado (1790000000_envios_estados.js).
// PocketBase v0.39.10+

migrate((app) => {
  const COMP_RULE = "@request.auth.id != '' && companyId = @request.auth.companyId"
  const AUTH_RULE = "@request.auth.id != ''"

  // ── 1. Agregar companyId a las colecciones nuevas del Parche 1 ──────────────
  // El campo ya existe en products, sales, expenses, etc. Solo lo añadimos
  // a ubicaciones, stock_ubicacion, envios, envio_items, envio_eventos,
  // movimientos_inventario, rendiciones.
  const nuevas = [
    "ubicaciones", "stock_ubicacion", "envios", "envio_items",
    "envio_eventos", "movimientos_inventario", "rendiciones",
  ]
  for (const nombre of nuevas) {
    const col = app.findCollectionByNameOrId(nombre)
    // Evitar agregar duplicado si ya existe (idempotente)
    try { col.fields.getByName("companyId"); continue } catch (_) {}
    col.fields.add(new Field({
      "id":       "text_companyid_" + nombre.replace(/_/g, ""),
      "name":     "companyId",
      "type":     "text",
      "required": false,
    }))
    app.save(col)
  }

  // ── 2. Aplicar reglas de aislamiento por empresa a las colecciones nuevas ────
  // Las rutas personalizadas (despachar/recibir/etc.) se saltan estas reglas
  // y hacen su propio chequeo. Estas reglas cubren el acceso directo a la API
  // de colecciones (listados, visualización, etc.).
  const colsAislar = [
    "ubicaciones", "envios", "envio_items", "envio_eventos",
    "movimientos_inventario", "rendiciones",
  ]
  for (const nombre of colsAislar) {
    const col = app.findCollectionByNameOrId(nombre)
    col.listRule   = COMP_RULE
    col.viewRule   = COMP_RULE
    col.createRule = COMP_RULE
    col.updateRule = COMP_RULE
    // No se pueden borrar directamente; solo por rutas autorizadas
    col.deleteRule = null
    app.save(col)
  }

  // stock_ubicacion: solo lectura directa; escritura exclusiva por hooks
  const su = app.findCollectionByNameOrId("stock_ubicacion")
  su.listRule   = COMP_RULE
  su.viewRule   = COMP_RULE
  su.createRule = null
  su.updateRule = null
  su.deleteRule = null
  app.save(su)

  // ── 3. Campo incidencia_resuelta en envios ────────────────────────────────────
  // Requiere resolver-incidencia (inventario_estado.pb.js)
  const envios = app.findCollectionByNameOrId("envios")
  try { envios.fields.getByName("incidencia_resuelta") } catch (_) {
    envios.fields.add(new Field({
      "id":       "bool_incidencia_resuelta",
      "name":     "incidencia_resuelta",
      "type":     "bool",
      "required": false,
    }))
    app.save(envios)
  }

  // ── 4. Crear una Central por cada empresa existente ──────────────────────────
  // El Parche 1 creó una Central global sin companyId.
  // Esta migración:
  //   a) Asigna el companyId a la Central existente si hay exactamente 1 empresa.
  //   b) Crea Centrales adicionales si hay más de una empresa.
  //   c) Marca la Central existente sin companyId como "huérfana" si hay
  //      múltiples empresas y no se puede asignar automáticamente.
  let empresas = []
  try {
    empresas = app.findRecordsByFilter("companies", "id != ''", "created", 0, 0)
  } catch (_) {
    // La colección companies no existe o está vacía — sistema de empresa única
  }

  // Buscar la Central sin companyId creada por el Parche 1
  let centralHuerfana = null
  try {
    centralHuerfana = app.findFirstRecordByFilter(
      "ubicaciones",
      "tipo = 'central' && (companyId = '' || companyId = null)"
    )
  } catch (_) {}

  if (empresas.length === 1 && centralHuerfana) {
    // Caso más común: una sola empresa → asignar su companyId a la Central huérfana
    centralHuerfana.set("companyId", empresas[0].id)
    app.save(centralHuerfana)
  } else if (empresas.length > 1) {
    // Múltiples empresas: crear Central para cada una que no tenga aún
    for (const emp of empresas) {
      try {
        app.findFirstRecordByFilter(
          "ubicaciones",
          "tipo = 'central' && companyId = {:c}",
          { c: emp.id }
        )
        // Ya existe Central para esta empresa → no crear otra
      } catch (_) {
        const col = app.findCollectionByNameOrId("ubicaciones")
        const central = new Record(col)
        central.set("nombre",    "Central")
        central.set("tipo",      "central")
        central.set("activa",    true)
        central.set("companyId", emp.id)
        app.save(central)
      }
    }
  }
  // Si empresas.length === 0: sistema sin multiempresa configurado → no crear nada

}, (app) => {
  // DOWN: revertir solo lo seguro (no eliminar datos de producción)
  // Quitar incidencia_resuelta de envios
  try {
    const envios = app.findCollectionByNameOrId("envios")
    envios.fields.removeById("bool_incidencia_resuelta")
    app.save(envios)
  } catch (_) {}

  // Quitar companyId de las colecciones nuevas
  const nuevas = [
    "ubicaciones", "stock_ubicacion", "envios", "envio_items",
    "envio_eventos", "movimientos_inventario", "rendiciones",
  ]
  for (const nombre of nuevas) {
    try {
      const col = app.findCollectionByNameOrId(nombre)
      col.fields.removeById("text_companyid_" + nombre.replace(/_/g, ""))
      app.save(col)
    } catch (_) {}
  }
})
