/// <reference path="../pb_data/types.d.ts" />
// PARCHE Envíos a Estados — PocketBase v0.23+
// ADAPTAR: nombres reales de colecciones existentes ("ventas", "users") y reglas de acceso.
migrate((app) => {
  const auth = "@request.auth.id != ''"
  const created = [
    { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
  ]

  // ---------- ubicaciones ----------
  const ESTADOS = ["Amazonas","Anzoátegui","Apure","Aragua","Barinas","Bolívar","Carabobo","Cojedes","Delta Amacuro","Distrito Capital","Falcón","Guárico","La Guaira","Lara","Mérida","Miranda","Monagas","Nueva Esparta","Portuguesa","Sucre","Táchira","Trujillo","Yaracuy","Zulia"]
  const ubicaciones = new Collection({
    type: "base", name: "ubicaciones",
    listRule: auth, viewRule: auth, createRule: auth, updateRule: auth, deleteRule: auth,
    fields: [
      { type: "text", name: "nombre", required: true },
      { type: "select", name: "tipo", required: true, maxSelect: 1, values: ["central", "estado"] },
      { type: "select", name: "estado_ve", maxSelect: 1, values: ESTADOS },
      { type: "text", name: "ciudad" },
      { type: "text", name: "responsable" },
      { type: "text", name: "telefono" },
      { type: "number", name: "comision_pct", min: 0, max: 100 },
      { type: "bool", name: "activa" },
      ...created,
    ],
  })
  app.save(ubicaciones)

  // Central (única)
  const central = new Record(ubicaciones)
  central.set("nombre", "Central")
  central.set("tipo", "central")
  central.set("activa", true)
  app.save(central)

  // ---------- stock_ubicacion (solo se toca por hooks) ----------
  const productos = app.findCollectionByNameOrId("productos")
  app.save(new Collection({
    type: "base", name: "stock_ubicacion",
    listRule: auth, viewRule: auth, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { type: "relation", name: "ubicacion", required: true, maxSelect: 1, collectionId: ubicaciones.id },
      { type: "relation", name: "producto", required: true, maxSelect: 1, collectionId: productos.id },
      { type: "number", name: "cantidad", min: 0 },
      { type: "number", name: "stock_minimo", min: 0 },
      ...created,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_stock_ub_prod ON stock_ubicacion (ubicacion, producto)"],
  }))

  // ---------- envios ----------
  const egresos = app.findCollectionByNameOrId("egresos")
  const envios = new Collection({
    type: "base", name: "envios",
    listRule: auth, viewRule: auth, createRule: auth, updateRule: auth, deleteRule: null,
    fields: [
      { type: "text", name: "codigo" },
      { type: "relation", name: "destino", required: true, maxSelect: 1, collectionId: ubicaciones.id },
      { type: "select", name: "estado", maxSelect: 1, values: ["preparando", "en_transito", "recibido", "recibido_parcial", "cancelado"] },
      { type: "text", name: "transportista" },
      { type: "text", name: "guia" },
      { type: "date", name: "fecha_envio" },
      { type: "date", name: "fecha_estimada" },
      { type: "date", name: "fecha_recepcion" },
      { type: "number", name: "costo_flete", min: 0 },
      { type: "relation", name: "egreso", maxSelect: 1, collectionId: egresos.id },
      { type: "text", name: "notas" },
      { type: "text", name: "recibido_por" },
      ...created,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_envios_codigo ON envios (codigo) WHERE codigo != ''"],
  })
  app.save(envios)

  // ---------- envio_items ----------
  app.save(new Collection({
    type: "base", name: "envio_items",
    listRule: auth, viewRule: auth,
    // Solo editable mientras el envío está en preparación
    createRule: "@request.auth.id != '' && envio.estado = 'preparando'",
    updateRule: "@request.auth.id != '' && envio.estado = 'preparando'",
    deleteRule: "@request.auth.id != '' && envio.estado = 'preparando'",
    fields: [
      { type: "relation", name: "envio", required: true, maxSelect: 1, cascadeDelete: true, collectionId: envios.id },
      { type: "relation", name: "producto", required: true, maxSelect: 1, collectionId: productos.id },
      { type: "number", name: "cantidad_enviada", required: true, min: 0.0001 },
      { type: "number", name: "cantidad_recibida", min: 0 },
      { type: "number", name: "costo_unitario", min: 0 },
      ...created,
    ],
  }))

  // ---------- envio_eventos (timeline; solo por hooks/rutas, más nota manual) ----------
  app.save(new Collection({
    type: "base", name: "envio_eventos",
    listRule: auth, viewRule: auth, createRule: auth, updateRule: null, deleteRule: null,
    fields: [
      { type: "relation", name: "envio", required: true, maxSelect: 1, cascadeDelete: true, collectionId: envios.id },
      { type: "text", name: "estado" },
      { type: "text", name: "nota" },
      { type: "text", name: "usuario" },
      ...created,
    ],
  }))

  // ---------- movimientos_inventario (libro; solo por hooks) ----------
  app.save(new Collection({
    type: "base", name: "movimientos_inventario",
    listRule: auth, viewRule: auth, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { type: "relation", name: "producto", required: true, maxSelect: 1, collectionId: productos.id },
      { type: "relation", name: "ubicacion", maxSelect: 1, collectionId: ubicaciones.id },
      { type: "select", name: "tipo", required: true, maxSelect: 1,
        values: ["compra", "apertura", "envio_salida", "envio_entrada", "venta", "ajuste", "merma", "devolucion", "cancelacion_envio"] },
      { type: "number", name: "cantidad" },
      { type: "number", name: "costo_unitario" },
      { type: "text", name: "referencia_tipo" },
      { type: "text", name: "referencia_id" },
      { type: "text", name: "nota" },
      { type: "text", name: "usuario" },
      ...created,
    ],
  }))

  // ---------- rendiciones ----------
  const rend = new Collection({
    type: "base", name: "rendiciones",
    listRule: auth, viewRule: auth, createRule: auth, updateRule: auth, deleteRule: auth,
    fields: [
      { type: "relation", name: "ubicacion", required: true, maxSelect: 1, collectionId: ubicaciones.id },
      { type: "date", name: "fecha" },
      { type: "number", name: "monto", required: true, min: 0.01 },
      { type: "select", name: "metodo", maxSelect: 1, values: ["efectivo", "transferencia", "pago_movil", "zelle", "otro"] },
      { type: "text", name: "referencia" },
      { type: "file", name: "comprobante", maxSelect: 1, maxSize: 5242880 },
      { type: "text", name: "nota" },
      ...created,
    ],
  })
  app.save(rend)

  // ---------- campo ventas.ubicacion (histórico queda vacío = Central) ----------
  const ventas = app.findCollectionByNameOrId("ventas")
  ventas.fields.add(new RelationField({ name: "ubicacion", maxSelect: 1, collectionId: ubicaciones.id }))
  app.save(ventas)

  // ---------- campo users.ubicacion (para vendedor de estado; opcional) ----------
  const users = app.findCollectionByNameOrId("users")
  users.fields.add(new RelationField({ name: "ubicacion", maxSelect: 1, collectionId: ubicaciones.id }))
  app.save(users)

}, (app) => {
  // down: NO borra ventas.ubicacion ni users.ubicacion para no perder datos
  for (const n of ["rendiciones", "movimientos_inventario", "envio_eventos", "envio_items", "envios", "stock_ubicacion", "ubicaciones"]) {
    try { app.delete(app.findCollectionByNameOrId(n)) } catch (_) {}
  }
})
