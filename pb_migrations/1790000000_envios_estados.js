/// <reference path="../pb_data/types.d.ts" />
// Migración: Envíos a Estados — Cuadre / Mantente
// PocketBase v0.23+ (probado en v0.39.10)
//
// Correcciones vs. el borrador del parche:
//   - Colecciones existentes con nombres en inglés: "products", "sales", "expenses", "users"
//   - Campos de productos: stock (no existencia), cost (no precio_base), name (no nombre)
//   - RelationField → Field({ type: "relation", ... }) para compatibilidad con el sistema de
//     migraciones versionado del proyecto.

migrate((app) => {
  const auth = "@request.auth.id != ''"
  const created = [
    { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
  ]

  const ESTADOS_VE = [
    "Amazonas","Anzoátegui","Apure","Aragua","Barinas","Bolívar",
    "Carabobo","Cojedes","Delta Amacuro","Distrito Capital","Falcón",
    "Guárico","La Guaira","Lara","Mérida","Miranda","Monagas",
    "Nueva Esparta","Portuguesa","Sucre","Táchira","Trujillo","Yaracuy","Zulia"
  ]

  // ---------- ubicaciones ----------
  const ubicaciones = new Collection({
    type: "base", name: "ubicaciones",
    listRule: auth, viewRule: auth, createRule: auth, updateRule: auth, deleteRule: auth,
    fields: [
      { type: "text",   name: "nombre",       required: true },
      { type: "select", name: "tipo",          required: true, maxSelect: 1, values: ["central", "estado"] },
      { type: "select", name: "estado_ve",     maxSelect: 1,   values: ESTADOS_VE },
      { type: "text",   name: "ciudad" },
      { type: "text",   name: "responsable" },
      { type: "text",   name: "telefono" },
      { type: "number", name: "comision_pct",  min: 0, max: 100 },
      { type: "bool",   name: "activa" },
      ...created,
    ],
  })
  app.save(ubicaciones)

  // Seed: Central única (toda la app asume que existe exactamente 1)
  const central = new Record(ubicaciones)
  central.set("nombre", "Central")
  central.set("tipo", "central")
  central.set("activa", true)
  app.save(central)

  // ---------- stock_ubicacion (solo estados; Central = products.stock) ----------
  // Solo se modifica por hooks/rutas — createRule/updateRule/deleteRule = null
  const products = app.findCollectionByNameOrId("products")
  app.save(new Collection({
    type: "base", name: "stock_ubicacion",
    listRule: auth, viewRule: auth, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { type: "relation", name: "ubicacion", required: true, maxSelect: 1, collectionId: ubicaciones.id },
      { type: "relation", name: "producto",  required: true, maxSelect: 1, collectionId: products.id },
      { type: "number",   name: "cantidad",  min: 0 },
      { type: "number",   name: "stock_minimo", min: 0 },
      ...created,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_stock_ub_prod ON stock_ubicacion (ubicacion, producto)"],
  }))

  // ---------- envios ----------
  const expenses = app.findCollectionByNameOrId("expenses")
  const envios = new Collection({
    type: "base", name: "envios",
    listRule: auth, viewRule: auth, createRule: auth, updateRule: auth, deleteRule: null,
    fields: [
      { type: "text",     name: "codigo" },
      { type: "relation", name: "destino",        required: true, maxSelect: 1, collectionId: ubicaciones.id },
      { type: "select",   name: "estado",         maxSelect: 1,
        values: ["preparando", "en_transito", "recibido", "recibido_parcial", "cancelado"] },
      { type: "text",     name: "transportista" },
      { type: "text",     name: "guia" },
      { type: "date",     name: "fecha_envio" },
      { type: "date",     name: "fecha_estimada" },
      { type: "date",     name: "fecha_recepcion" },
      { type: "number",   name: "costo_flete",    min: 0 },
      { type: "relation", name: "egreso",          maxSelect: 1, collectionId: expenses.id },
      { type: "text",     name: "notas" },
      { type: "text",     name: "recibido_por" },
      ...created,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_envios_codigo ON envios (codigo) WHERE codigo != ''"],
  })
  app.save(envios)

  // ---------- envio_items ----------
  app.save(new Collection({
    type: "base", name: "envio_items",
    listRule: auth, viewRule: auth,
    // Solo editable mientras el envío está en estado "preparando"
    createRule: "@request.auth.id != '' && envio.estado = 'preparando'",
    updateRule: "@request.auth.id != '' && envio.estado = 'preparando'",
    deleteRule: "@request.auth.id != '' && envio.estado = 'preparando'",
    fields: [
      { type: "relation", name: "envio",            required: true, maxSelect: 1, cascadeDelete: true, collectionId: envios.id },
      { type: "relation", name: "producto",         required: true, maxSelect: 1, collectionId: products.id },
      { type: "number",   name: "cantidad_enviada", required: true, min: 0.0001 },
      { type: "number",   name: "cantidad_recibida", min: 0 },
      { type: "number",   name: "costo_unitario",   min: 0 },
      ...created,
    ],
  }))

  // ---------- envio_eventos (timeline; se crea por hooks + nota manual del admin) ----------
  app.save(new Collection({
    type: "base", name: "envio_eventos",
    listRule: auth, viewRule: auth, createRule: auth, updateRule: null, deleteRule: null,
    fields: [
      { type: "relation", name: "envio",   required: true, maxSelect: 1, cascadeDelete: true, collectionId: envios.id },
      { type: "text",     name: "estado" },
      { type: "text",     name: "nota" },
      { type: "text",     name: "usuario" },
      ...created,
    ],
  }))

  // ---------- movimientos_inventario (libro de auditoría; solo por hooks) ----------
  app.save(new Collection({
    type: "base", name: "movimientos_inventario",
    listRule: auth, viewRule: auth, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { type: "relation", name: "producto",         required: true, maxSelect: 1, collectionId: products.id },
      { type: "relation", name: "ubicacion",        maxSelect: 1,  collectionId: ubicaciones.id },
      { type: "select",   name: "tipo",             required: true, maxSelect: 1,
        values: ["compra","apertura","envio_salida","envio_entrada","venta","ajuste","merma","devolucion","cancelacion_envio"] },
      { type: "number",   name: "cantidad" },        // positivo = entrada, negativo = salida
      { type: "number",   name: "costo_unitario" },
      { type: "text",     name: "referencia_tipo" }, // "envio", "venta", "compra", etc.
      { type: "text",     name: "referencia_id" },
      { type: "text",     name: "nota" },
      { type: "text",     name: "usuario" },
      ...created,
    ],
  }))

  // ---------- rendiciones ----------
  app.save(new Collection({
    type: "base", name: "rendiciones",
    listRule: auth, viewRule: auth, createRule: auth, updateRule: auth, deleteRule: auth,
    fields: [
      { type: "relation", name: "ubicacion", required: true, maxSelect: 1, collectionId: ubicaciones.id },
      { type: "date",     name: "fecha" },
      { type: "number",   name: "monto",     required: true, min: 0.01 },
      { type: "select",   name: "metodo",    maxSelect: 1,
        values: ["efectivo", "transferencia", "pago_movil", "zelle", "otro"] },
      { type: "text",     name: "referencia" },
      { type: "file",     name: "comprobante", maxSelect: 1, maxSize: 5242880 },
      { type: "text",     name: "nota" },
      ...created,
    ],
  }))

  // ---------- sales.ubicacion — las ventas históricas quedan sin ubicacion (= Central) ----------
  const sales = app.findCollectionByNameOrId("sales")
  sales.fields.add(new Field({
    "id":         "relation_ubicacion_venta",
    "name":       "ubicacion",
    "type":       "relation",
    "collectionId": ubicaciones.id,
    "maxSelect":  1,
    "required":   false,
    "cascadeDelete": false,
  }))
  app.save(sales)

  // ---------- users.ubicacion — para vendedor de estado (opcional, Fase 4) ----------
  const users = app.findCollectionByNameOrId("users")
  users.fields.add(new Field({
    "id":         "relation_ubicacion_user",
    "name":       "ubicacion",
    "type":       "relation",
    "collectionId": ubicaciones.id,
    "maxSelect":  1,
    "required":   false,
    "cascadeDelete": false,
  }))
  app.save(users)

}, (app) => {
  // DOWN: elimina las colecciones nuevas en orden inverso.
  // NO elimina los campos sales.ubicacion ni users.ubicacion para no perder datos.
  for (const n of [
    "rendiciones", "movimientos_inventario", "envio_eventos",
    "envio_items", "envios", "stock_ubicacion", "ubicaciones"
  ]) {
    try { app.delete(app.findCollectionByNameOrId(n)) } catch (_) {}
  }
})
