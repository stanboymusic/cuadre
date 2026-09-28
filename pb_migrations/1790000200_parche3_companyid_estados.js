// Migración: Parche 3 — Multiempresa para Estados.
// PocketBase v0.39.10+
// CORRECCIÓN: campo companyId se guarda PRIMERO, reglas DESPUÉS (dos pasadas).
// Idempotente: si el campo ya existe no lo duplica; si las reglas ya están no falla.

migrate((app) => {
  const collections = [
    "rendiciones", "movimientos_inventario", "envio_eventos",
    "envio_items", "envios", "stock_ubicacion", "ubicaciones"
  ];

  // ── PASO 1: Vaciar datos de prueba ─────────────────────────────────────────
  // Solo borra si hay registros (prod: no había datos reales de Estados)
  for (const name of collections) {
    try {
      const records = app.findRecordsByFilter(name, "id != ''", "", 0, 0);
      for (const r of records) {
        try { app.delete(r); } catch (_) {}
      }
    } catch (err) {
      console.log("Aviso vaciando " + name + ": " + err);
    }
  }

  // ── PASO 2: Añadir campo companyId y guardar (SIN reglas todavía) ──────────
  for (const name of collections) {
    const col = app.findCollectionByNameOrId(name);

    // Comprobar si el campo ya existe (idempotente)
    let tieneField = false;
    try {
      col.fields.getByName("companyId");
      tieneField = true;
    } catch (_) {
      tieneField = false;
    }

    if (!tieneField) {
      col.fields.add(new Field({
        "id":       "text_companyId_" + name,
        "name":     "companyId",
        "type":     "text",
        "required": false,   // false en este save; true se aplica después de que las reglas pasen
      }));
      // Guardar SOLO el campo — todavía sin reglas nuevas
      app.save(col);
      console.log("[parche3] campo companyId agregado a: " + name);
    } else {
      console.log("[parche3] campo companyId ya existía en: " + name);
    }
  }

  // ── PASO 3: Ahora aplicar las reglas (el campo ya existe en DB) ───────────
  const rule = "@request.auth.companyId = companyId";

  for (const name of collections) {
    const col = app.findCollectionByNameOrId(name);  // releer del disco

    if (col.listRule   !== null) col.listRule   = rule;
    if (col.viewRule   !== null) col.viewRule   = rule;

    if (name === "envio_items") {
      const ruleItem = "@request.auth.companyId = companyId && envio.estado = 'preparando'";
      col.createRule = ruleItem;
      col.updateRule = ruleItem;
      col.deleteRule = ruleItem;
    } else {
      if (col.createRule !== null && col.createRule !== "") col.createRule = rule;
      if (col.updateRule !== null)                          col.updateRule = rule;
      if (col.deleteRule !== null)                          col.deleteRule = rule;
    }

    app.save(col);
    console.log("[parche3] reglas aplicadas a: " + name);
  }

}, (app) => {
  // DOWN: no necesario, no se puede revertir el borrado de datos de prueba
})
