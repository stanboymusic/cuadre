/// <reference path="../pb_data/types.d.ts" />
// Migración: Parche 4 — Refuerzo de seguridad multiempresa
// PocketBase v0.39.10+

migrate((app) => {
  // 1. Asegurar que 'sales' tenga companyId (para que el hook de rendiciones no falle)
  try {
    const sales = app.findCollectionByNameOrId("sales");
    if (!sales.fields.getByName("companyId")) {
      sales.fields.add(new Field({
        "id": "f_companyId_sales",
        "name": "companyId",
        "type": "text",
        "required": false
      }));
      app.save(sales);
      console.log("[parche4] companyId agregado a sales");
    }
  } catch (err) {
    console.log("[parche4] Error revisando sales:", err);
  }

  // 2. Asegurar que 'users' tenga companyId
  try {
    const users = app.findCollectionByNameOrId("users");
    if (!users.fields.getByName("companyId")) {
      users.fields.add(new Field({
        "id": "f_companyId_users",
        "name": "companyId",
        "type": "text",
        "required": false
      }));
      app.save(users);
      console.log("[parche4] companyId agregado a users");
    }
  } catch (err) {
    console.log("[parche4] Error revisando users:", err);
  }

  // 3. Ajustar reglas de envio_eventos y movimientos_inventario
  // movimientos_inventario -> solo servidor
  try {
    const movs = app.findCollectionByNameOrId("movimientos_inventario");
    movs.createRule = null;
    movs.updateRule = null;
    movs.deleteRule = null;
    app.save(movs);
  } catch (_) {}

  // envio_eventos -> frontend solo puede crear
  try {
    const eventos = app.findCollectionByNameOrId("envio_eventos");
    eventos.createRule = "@request.auth.companyId = companyId";
    eventos.updateRule = null;
    eventos.deleteRule = null;
    app.save(eventos);
  } catch (_) {}

}, (app) => {
  // DOWN no soportado
})
