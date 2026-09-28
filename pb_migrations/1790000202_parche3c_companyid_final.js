/// <reference path="../pb_data/types.d.ts" />
// Migración: Parche 3c — Agregar campo companyId + reglas multiempresa.
// PocketBase v0.39.10+
//
// CONTEXTO: Las migraciones 200 y 201 quedaron marcadas como aplicadas
// pero nunca añadieron el campo ni las reglas (bug en detección de campo).
// Esta migración lo hace correctamente desde cero.

migrate((app) => {
  const collections = [
    "rendiciones", "movimientos_inventario", "envio_eventos",
    "envio_items", "envios", "stock_ubicacion", "ubicaciones"
  ];

  const rule = "@request.auth.companyId = companyId";

  // ── PASO 1: Vaciar datos de prueba (idempotente) ──────────────────────────
  for (const name of collections) {
    try {
      const records = app.findRecordsByFilter(name, "id != ''", "", 0, 0);
      for (const r of records) {
        try { app.delete(r); } catch (_) {}
      }
    } catch (_) {}
  }

  // ── PASO 2: Agregar campo companyId a cada colección ──────────────────────
  for (const name of collections) {
    const col = app.findCollectionByNameOrId(name);

    // Intentar añadir el campo siempre. Si ya existe, PB lo ignora o lo actualiza.
    // Usamos un ID determinístico para que sea idempotente.
    const fieldId = "f_companyId_" + name;
    col.fields.add(new Field({
      "id":       fieldId,
      "name":     "companyId",
      "type":     "text",
      "required": false,
    }));

    // Guardar SIN reglas nuevas primero (evitar el error original)
    app.save(col);
    console.log("[parche3c] campo companyId instalado en: " + name);
  }

  // ── PASO 3: Verificar que el campo existe y luego poner reglas ────────────
  for (const name of collections) {
    // Releer la colección desde la DB
    const col = app.findCollectionByNameOrId(name);
    const field = col.fields.getByName("companyId");

    if (!field) {
      console.log("[parche3c] ERROR CRITICO: " + name + " sigue sin companyId después de save!");
      continue;
    }

    console.log("[parche3c] verificado companyId en: " + name);

    // Aplicar reglas de lectura
    col.listRule = rule;
    col.viewRule = rule;

    // Aplicar reglas de escritura según colección
    if (name === "envio_items") {
      const ruleItem = "@request.auth.companyId = companyId && envio.estado = 'preparando'";
      col.createRule = ruleItem;
      col.updateRule = ruleItem;
      col.deleteRule = ruleItem;
    } else if (name === "stock_ubicacion") {
      // stock_ubicacion solo se modifica por hooks del servidor
      // createRule/updateRule/deleteRule deben seguir como null
    } else if (name === "movimientos_inventario") {
      // movimientos solo los crea el servidor
      // createRule/updateRule/deleteRule siguen como null
    } else if (name === "envio_eventos") {
      // eventos solo los crea el servidor
    } else {
      if (col.createRule !== null) col.createRule = rule;
      if (col.updateRule !== null) col.updateRule = rule;
      if (col.deleteRule !== null) col.deleteRule = rule;
    }

    app.save(col);
    console.log("[parche3c] reglas aplicadas a: " + name);
  }

}, (app) => {
  // DOWN: no revertible
})
