// Migración: Parche 3b — Aplicar reglas multiempresa a colecciones de Estados.
// PocketBase v0.39.10+
//
// PRERREQUISITO: La migración 1790000200 ya añadió el campo companyId a
// las colecciones de Estados. Esta migración solo aplica las reglas de acceso.
// Se corre DESPUÉS de que el campo existe en la DB (idempotente).

migrate((app) => {
  const rule = "@request.auth.companyId = companyId";

  const configs = [
    { name: "ubicaciones",            create: rule, update: rule, delete: rule },
    { name: "stock_ubicacion",        create: rule, update: rule, delete: rule },
    { name: "envios",                 create: rule, update: rule, delete: rule },
    { name: "envio_eventos",          create: rule, update: rule, delete: null },
    { name: "movimientos_inventario", create: rule, update: null, delete: null },
    { name: "rendiciones",            create: rule, update: rule, delete: rule },
    {
      name: "envio_items",
      create: "@request.auth.companyId = companyId && envio.estado = 'preparando'",
      update: "@request.auth.companyId = companyId && envio.estado = 'preparando'",
      delete: "@request.auth.companyId = companyId && envio.estado = 'preparando'",
    },
  ];

  for (const cfg of configs) {
    let col;
    try {
      col = app.findCollectionByNameOrId(cfg.name);
    } catch (err) {
      console.log("[parche3b] colección no encontrada: " + cfg.name);
      continue;
    }

    // Verificar que el campo companyId existe antes de aplicar la regla
    // getByName() retorna null cuando no existe (no lanza excepción)
    const tieneField = !!(col.fields.getByName("companyId"));

    if (!tieneField) {
      console.log("[parche3b] ALERTA: " + cfg.name + " no tiene companyId — regla omitida");
      continue;
    }

    // Aplicar reglas de lectura
    col.listRule = rule;
    col.viewRule = rule;

    // Aplicar reglas de escritura según config
    if (cfg.create !== null) col.createRule = cfg.create;
    if (cfg.update !== null) col.updateRule = cfg.update;
    if (cfg.delete !== null) col.deleteRule = cfg.delete;

    app.save(col);
    console.log("[parche3b] reglas aplicadas a: " + cfg.name);
  }

}, (app) => {
  // DOWN: quitar las reglas (restaurar a solo autenticado)
  const collections = [
    "ubicaciones", "stock_ubicacion", "envios", "envio_items",
    "envio_eventos", "movimientos_inventario", "rendiciones"
  ];
  for (const name of collections) {
    try {
      const col = app.findCollectionByNameOrId(name);
      col.listRule = "@request.auth.id != ''";
      col.viewRule = "@request.auth.id != ''";
      app.save(col);
    } catch (_) {}
  }
})
