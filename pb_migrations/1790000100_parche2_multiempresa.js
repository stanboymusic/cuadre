/// <reference path="../pb_data/types.d.ts" />
// Migración: Parche 2 — campo envios.incidencia_resuelta + Central global.
// Requiere: Parche 1 ya aplicado (1790000000_envios_estados.js).
// PocketBase v0.39.10+

migrate((app) => {
  // ── 1. Campo incidencia_resuelta en envios ────────────────────────────────────
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

  // ── 2. Crear una Central única si no existe ──────────────────────────
  try {
    app.findFirstRecordByFilter("ubicaciones", "tipo = 'central'")
  } catch (_) {
    const col = app.findCollectionByNameOrId("ubicaciones")
    const central = new Record(col)
    central.set("nombre",    "Central")
    central.set("tipo",      "central")
    central.set("activa",    true)
    app.save(central)
  }
}, (app) => {
  // DOWN: revertir solo lo seguro
  try {
    const envios = app.findCollectionByNameOrId("envios")
    envios.fields.removeById("bool_incidencia_resuelta")
    app.save(envios)
  } catch (_) {}
})
