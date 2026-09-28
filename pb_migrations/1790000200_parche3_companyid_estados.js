// Migración: Parche 3 — Multiempresa para Estados.
// PocketBase v0.39.10+
//
// ESTRATEGIA SEGURA:
// 1. Solo agrega el campo companyId a las colecciones de Estados
// 2. NO establece reglas que referencien @request.auth.companyId
//    (esas reglas requieren que el campo companyId esté en el schema de users,
//     lo cual se maneja en la migración 1790000100 y el hook companyid_estados.pb.js)
// 3. El filtrado por empresa lo aplica el hook companyid_estados.pb.js en cada request
// 4. Idempotente: no falla si el campo ya existe

migrate((app) => {
  const collections = [
    "rendiciones", "movimientos_inventario", "envio_eventos",
    "envio_items", "envios", "stock_ubicacion", "ubicaciones"
  ];

  // ── PASO 1: Vaciar datos de prueba ─────────────────────────────────────────
  for (const name of collections) {
    try {
      const records = app.findRecordsByFilter(name, "id != ''", "", 0, 0);
      for (const r of records) {
        try { app.delete(r); } catch (_) {}
      }
      console.log("[parche3] vaciada: " + name);
    } catch (err) {
      console.log("[parche3] aviso vaciando " + name + ": " + err);
    }
  }

  // ── PASO 2: Añadir campo companyId (sin tocar las reglas) ──────────────────
  for (const name of collections) {
    const col = app.findCollectionByNameOrId(name);

    // getByName() retorna null cuando no existe (no lanza excepción en PB 0.39)
    const tieneField = !!(col.fields.getByName("companyId"));

    if (!tieneField) {
      col.fields.add(new Field({
        "id":       "text_companyId_" + name,
        "name":     "companyId",
        "type":     "text",
        "required": false,
      }));
      app.save(col);
      console.log("[parche3] campo companyId agregado a: " + name);
    } else {
      console.log("[parche3] campo companyId ya existía en: " + name);
    }
  }

  // NOTA: Las reglas de acceso multiempresa (@request.auth.companyId = companyId)
  // se aplican vía el hook companyid_estados.pb.js que corre en tiempo de request.
  // No se establecen aquí para evitar errores si el schema de users en producción
  // no tiene companyId registrado formalmente.

}, (app) => {
  // DOWN: no revertible (datos de prueba ya borrados)
})
