// Migración: Parche 5 — Campo auto en cashClosings para el cierre automático
// PocketBase v0.39.10+

migrate((app) => {
  const col = app.findCollectionByNameOrId("cashClosings");
  
  // getByName() retorna null cuando no existe (no lanza excepción en PB 0.39)
  const tieneAuto = !!(col.fields.getByName("auto"));
  
  if (!tieneAuto) {
    col.fields.add(new Field({
      "id":       "bool_auto_cierre",
      "name":     "auto",
      "type":     "bool",
      "required": false,
    }));
    
    app.save(col);
    
    // Releer la colección para confirmar
    const confirmCol = app.findCollectionByNameOrId("cashClosings");
    if (confirmCol.fields.getByName("auto")) {
      console.log("[parche5] campo auto agregado a cashClosings exitosamente.");
    }
  } else {
    console.log("[parche5] campo auto ya existía en cashClosings.");
  }
}, (app) => {
  // DOWN
  try {
    const col = app.findCollectionByNameOrId("cashClosings");
    col.fields.removeById("bool_auto_cierre");
    app.save(col);
  } catch (_) {}
})
