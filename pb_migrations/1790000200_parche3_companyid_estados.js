// Migración: Parche 3 — Multiempresa para Estados.
// PocketBase v0.39.10+

migrate((app) => {
  const collections = [
    "rendiciones", "movimientos_inventario", "envio_eventos", 
    "envio_items", "envios", "stock_ubicacion", "ubicaciones"
  ];
  
  // 1. Vaciar datos de prueba para evitar mezcla de empresas
  for (const name of collections) {
    try {
      const records = app.findRecordsByFilter(name, "id != ''", "", 0, 0);
      for (const r of records) {
        app.delete(r);
      }
    } catch (err) {
      console.error("Error vaciando " + name + ":", err);
    }
  }

  // 2. Agregar campo companyId y reglas a todas las colecciones
  for (const name of collections) {
    const col = app.findCollectionByNameOrId(name);
    
    // Añadir campo companyId si no existe
    try {
      col.fields.getByName("companyId");
    } catch (_) {
      col.fields.add(new Field({
        "id": "text_companyId_" + name,
        "name": "companyId",
        "type": "text",
        "required": true,
      }));
    }

    // Actualizar reglas de acceso multiempresa
    const rule = "@request.auth.companyId = companyId";
    if (col.listRule !== null) col.listRule = rule;
    if (col.viewRule !== null) col.viewRule = rule;
    if (col.createRule !== null && col.createRule !== "") {
      if (name === "envio_items") {
        col.createRule = "@request.auth.companyId = companyId && envio.estado = 'preparando'";
        col.updateRule = "@request.auth.companyId = companyId && envio.estado = 'preparando'";
        col.deleteRule = "@request.auth.companyId = companyId && envio.estado = 'preparando'";
      } else {
        col.createRule = rule;
        if (col.updateRule !== null) col.updateRule = rule;
        if (col.deleteRule !== null) col.deleteRule = rule;
      }
    }

    app.save(col);
  }
}, (app) => {
  // DOWN no necesario
})
